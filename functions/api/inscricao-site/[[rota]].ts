// /api/inscricao-site/* — inscrição direta no site, para quem chega pelo link de embaixador ou influenciador
// (inscricao.html?prova=<id>&cupom=<CUPOM>). Lógica em functions/_lib/inscricoes-site.ts.
//
//   GET  prova/<id>?cupom=X     { prova, lote: { nome, valor_cheio, desconto, valor }, modalidades, camisetas, parceiro }
//   POST criar                  { prova, cupom, nome, cpf, email, telefone, nascimento, sexo, camiseta, modalidade, aceite, forma: pix|cartao }
//                               -> inscrição pública + { codigo } e o PIX copia e cola, ou { cartao: { url } } (Mercado Pago); vale 1 hora
//   GET  <id>?c=<codigo>        acompanha o pagamento (consulta a cobrança no banco, no máximo a cada 10 s)
//
// Erros: { erro: <status>, mensagem }. Limite: 20 inscrições criadas por hora por IP (dados inválidos não contam).

import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";
import { json, mesmaOrigem } from "../../_lib/http.ts";
import { segmentos, metodo, type AppHono } from "../../_lib/hono.ts";
import type { Contexto, Dados, Prova } from "../../_lib/tipos.ts";
import { dentroDoLimite } from "../../_lib/limite.ts";
import {
  ErroInscricao, provaAberta, conviteDoCupom, loteAtual, descontoDe, validaAtleta, criaInscricao, confere, publica, inscricaoComCodigo,
  acrescimoCartao, cartaoAtivo,
} from "../../_lib/inscricoes-site.ts";

async function corpo(request: Request): Promise<Dados> {
  const t = await request.text();
  if (t.length > 20000) throw new ErroInscricao(413, "Dados grandes demais.");
  try { return JSON.parse(t || "{}"); } catch (e) { throw new ErroInscricao(400, "Dados inválidos."); }
}

// ---------- app Hono ----------
// Escrita de outra origem (403) -> rotas -> 404. Rota GET não atende HEAD (segue para o 404), como antes.
const app = new Hono<AppHono>({ strict: false }).basePath("/api/inscricao-site");

app.use(async (c, next) => {
  if (c.req.method !== "GET" && !mesmaOrigem(c.req.raw)) throw new ErroInscricao(403, "Origem não permitida.");
  await next();
});

app.get("/prova/:id", metodo("GET", async (c) => {
  const env = c.env, url = new URL(c.req.url);
  const { prova, cfg } = await provaAberta(env, c.req.param("id"));
  const convite = await conviteDoCupom(env, prova.id, url.searchParams.get("cupom"));
  if (!convite) throw new ErroInscricao(404, "Cupom não encontrado para esta prova. Confira o link que o parceiro mandou.");
  const lote = await loteAtual(env, prova, cfg);
  if (!lote) throw new ErroInscricao(410, "As inscrições desta prova estão encerradas ou esgotadas.");
  const desconto = descontoDe(convite.desconto, lote.centavos);
  return json({
    prova: { id: prova.id, nome: prova.nome, data: prova.data, hora: prova.hora, local: prova.local, regulamento: prova.regulamento, poster: prova.poster },
    lote: { nome: lote.nome, ate: lote.ate, valor_cheio: lote.centavos, desconto, valor: lote.centavos - desconto },
    modalidades: cfg.modalidades, camisetas: cfg.camisetas,
    // Cartão (Mercado Pago): valor do PIX + a taxa repassada ao atleta; parcelas com juros do comprador
    cartao: cartaoAtivo(env, cfg)
      ? { acrescimo_pct: cfg.cartao.acrescimo_pct, parcelas: cfg.cartao.parcelas, valor: lote.centavos - desconto + acrescimoCartao(cfg, lote.centavos - desconto) }
      : null,
    cupom: convite.cupom, parceiro: convite.parceiro_nome,
  });
}));

app.post("/criar", async (c) => {
  const env = c.env, request = c.req.raw, url = new URL(c.req.url);
  const d = await corpo(request);
  const { prova, cfg } = await provaAberta(env, d.prova);
  const convite = await conviteDoCupom(env, prova.id, d.cupom);
  if (!convite) throw new ErroInscricao(404, "Cupom não encontrado para esta prova. Confira o link que o parceiro mandou.");
  const atleta = validaAtleta(d, cfg);
  // Conta só o que vai ao banco (erros de digitação no formulário não gastam o limite)
  if (!(await dentroDoLimite(env, request, "inscricao-site", 20, 3600))) throw new ErroInscricao(429, "Muitas inscrições deste endereço. Tente de novo mais tarde.");
  return json(await criaInscricao(env, c.executionCtx, { prova, cfg, convite, origem: "link", atleta, site: url.origin, forma: d.forma }), 201);
});

app.get("/:id", metodo("GET", async (c) => {
  const env = c.env, url = new URL(c.req.url);
  let l = await inscricaoComCodigo(env, c.req.param("id") as string, url.searchParams.get("c"));
  if (!l) throw new ErroInscricao(404, "Inscrição não encontrada.");
  l = await confere(env, l, { ctx: c.executionCtx, site: url.origin });
  const prova = await env.DB.prepare("SELECT id, nome, data, local FROM provas WHERE id = ?").bind(l.prova_id)
    .first<Pick<Prova, "id" | "nome" | "data" | "local">>();
  return json(publica(l, prova));
}));

app.notFound(() => json({ erro: 404, mensagem: "Rota não encontrada." }, 404));

app.onError((e, c) => {
  if (e instanceof ErroInscricao) return json({ erro: e.status, mensagem: e.message }, e.status);
  if (/no such (table|column)/i.test(String((e && e.message) || e))) {
    return json({ erro: 503, mensagem: "A inscrição pelo site ainda não foi ativada no banco (migração 016)." }, 503);
  }
  console.error("[api/inscricao-site]", c.req.method, new URL(c.req.url).pathname, e);
  return json({ erro: 500, mensagem: "Erro no servidor." }, 500);
});

const hono = handle(app);

// Conferência do banco (503) e a decodificação dos segmentos ficam antes do Hono, como antes.
export async function onRequest(ctx: Contexto<"rota">): Promise<Response> {
  if (!ctx.env.DB) return json({ erro: 503, mensagem: "Banco indisponível." }, 503);
  segmentos(ctx.params, "rota");
  return hono(ctx as unknown as Parameters<typeof hono>[0]);
}
