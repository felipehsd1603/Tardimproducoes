// /api/pagamento-site/* — inscrição coletiva paga pelo site (assessorias.html). Lógica em functions/_lib/pagamento-site.ts.
// Só funciona com PAGAMENTO_SITE = "ligado"; desligado, condicoes responde { ligado: false } e a página fica como antes.
//
//   GET  condicoes?c=<convite>&n=<atletas>   { ligado, pix, cartao, equipe, prova, vagas_restantes, cortesias_restantes, orcamento: { pix, cartao } }
//   POST criar   { c, prova_nome, responsavel, telefone, email, aceite, forma: pix|cartao, atletas: [...] }
//                -> pedido público + { codigo } e o PIX copia e cola, ou { cartao: { url } } (Mercado Pago); vale 24 horas
//   GET  pedido/<id>?k=<codigo>               acompanha o pagamento (consulta o banco ou o Mercado Pago, no máximo a cada 10 s)
//   POST webhook/pix/<PIX_WEBHOOK_SEGREDO>[/pix]   aviso do banco (Inter): só dispara a consulta da cobrança
//   POST webhook/mp                           aviso do Mercado Pago (assinatura x-signature com MP_WEBHOOK_SEGREDO): só dispara a consulta
//
// Erros: { erro: <status>, mensagem }. Limite: 10 pedidos criados por hora por IP (dados inválidos não contam).

import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";
import { json, mesmaOrigem, iguais } from "../../_lib/http.ts";
import { segmentos, metodo, type AppHono, type Ctx } from "../../_lib/hono.ts";
import type { Contexto, Dados } from "../../_lib/tipos.ts";
import { dentroDoLimite } from "../../_lib/limite.ts";
import { pixConfigurado } from "../../_lib/pix.ts";
import { mpConfigurado, referenciaDoPagamento, assinaturaValida } from "../../_lib/mercadopago.ts";
import {
  ErroPagamento, pagamentoLigado, cartaoConfig, condicao, orcamento, criaPedido, confere, publica, pedidoComCodigo,
  pedidoDoTxid, pedidoDoId, MAX_ATLETAS,
} from "../../_lib/pagamento-site.ts";

async function corpo(request: Request): Promise<Dados> {
  const t = await request.text();
  if (t.length > 600000) throw new ErroPagamento(413, "Dados grandes demais.");
  try { return JSON.parse(t || "{}"); } catch (e) { throw new ErroPagamento(400, "Dados inválidos."); }
}

const app = new Hono<AppHono>({ strict: false }).basePath("/api/pagamento-site");

// Escrita só do próprio site (os webhooks vêm do banco e do Mercado Pago)
app.use(async (c, next) => {
  if (c.req.method !== "GET" && !/^\/api\/pagamento-site\/webhook\//.test(new URL(c.req.url).pathname) && !mesmaOrigem(c.req.raw)) {
    throw new ErroPagamento(403, "Origem não permitida.");
  }
  await next();
});

app.get("/condicoes", metodo("GET", async (c) => {
  const env = c.env, url = new URL(c.req.url);
  const pix = pixConfigurado(env), cartao = cartaoConfig(env);
  if (!pagamentoLigado(env) || (!pix && !cartao)) return json({ ligado: false });
  let cond;
  try { cond = await condicao(env, url.searchParams.get("c"), { provaNome: url.searchParams.get("prova") || "" }); } catch (e) {
    // Sem valor combinado, prazo encerrado, convite fora do ar: a página segue só com o WhatsApp
    if (e instanceof ErroPagamento) return json({ ligado: false, motivo: e.message });
    throw e;
  }
  const n = Math.min(MAX_ATLETAS, Math.max(0, parseInt(url.searchParams.get("n") || "0", 10) || 0));
  return json({
    ligado: true, pix, cartao, equipe: cond.equipe, prova: cond.prova,
    vagas_restantes: cond.vagasRestantes, cortesias_restantes: cond.cortesiasRestantes,
    orcamento: n ? { pix: pix ? orcamento(env, cond, n, "pix") : null, cartao: cartao ? orcamento(env, cond, n, "cartao") : null } : null,
  });
}));

app.post("/criar", async (c) => {
  const env = c.env, request = c.req.raw, url = new URL(c.req.url);
  if (!pagamentoLigado(env)) throw new ErroPagamento(404, "O pagamento pelo site não está ativo. Envie a planilha pelo WhatsApp.");
  const d = await corpo(request);
  // Confere convite e atletas antes de contar o limite (erros de planilha não gastam)
  await condicao(env, d.c, { provaNome: d.prova_nome });
  if (!Array.isArray(d.atletas) || !d.atletas.length) throw new ErroPagamento(400, "A planilha não tem atletas.");
  if (!(await dentroDoLimite(env, request, "pagamento-site", 10, 3600))) throw new ErroPagamento(429, "Muitos pedidos deste endereço. Tente de novo mais tarde.");
  return json(await criaPedido(env, c.executionCtx, { codigoConvite: String(d.c), dados: d, site: url.origin }), 201);
});

app.get("/pedido/:id", metodo("GET", async (c) => {
  const env = c.env, url = new URL(c.req.url);
  let l = await pedidoComCodigo(env, c.req.param("id") as string, url.searchParams.get("k"));
  if (!l) throw new ErroPagamento(404, "Pedido não encontrado.");
  l = await confere(env, l, { ctx: c.executionCtx });
  return json(publica(l!));
}));

// Banco Inter: o endereço cadastrado leva o segredo; o banco acrescenta "/pix". O corpo só diz quais txid olhar.
async function webhookPix(c: Ctx): Promise<Response> {
  const env = c.env;
  const segredo = c.req.param("segredo") || "";
  if (!env.PIX_WEBHOOK_SEGREDO || !iguais(segredo, env.PIX_WEBHOOK_SEGREDO)) throw new ErroPagamento(404, "Rota não encontrada.");
  const d = await corpo(c.req.raw).catch(() => ({} as Dados));
  const txids = (Array.isArray(d.pix) ? d.pix : []).map((p: Dados) => String((p && p.txid) || "")).filter((t: string) => /^[a-zA-Z0-9]{26,35}$/.test(t));
  for (const t of [...new Set(txids)].slice(0, 50) as string[]) await confere(env, await pedidoDoTxid(env, t), { forcar: true, ctx: c.executionCtx });
  return json({ ok: true });
}
app.post("/webhook/pix/:segredo", (c) => webhookPix(c));
app.post("/webhook/pix/:segredo/pix", (c) => webhookPix(c));

// Mercado Pago: ?data.id=<pagamento>&type=payment (ou { type, data: { id } } no corpo)
app.post("/webhook/mp", async (c) => {
  const env = c.env, url = new URL(c.req.url);
  if (!mpConfigurado(env)) throw new ErroPagamento(404, "Rota não encontrada.");
  const d = await corpo(c.req.raw).catch(() => ({} as Dados));
  const tipo = url.searchParams.get("type") || url.searchParams.get("topic") || d.type || "";
  const dataId = String(url.searchParams.get("data.id") || url.searchParams.get("id") || (d.data && d.data.id) || "");
  if (!(await assinaturaValida(env, c.req.raw, dataId))) throw new ErroPagamento(401, "Assinatura inválida.");
  if (tipo === "payment" && dataId) {
    const ref = await referenciaDoPagamento(env, dataId);
    if (ref) await confere(env, await pedidoDoId(env, ref), { forcar: true, ctx: c.executionCtx });
  }
  return json({ ok: true });
});

app.notFound(() => json({ erro: 404, mensagem: "Rota não encontrada." }, 404));

app.onError((e, c) => {
  if (e instanceof ErroPagamento) return json({ erro: e.status, mensagem: e.message }, e.status);
  if (/no such (table|column)/i.test(String((e && e.message) || e))) {
    return json({ erro: 503, mensagem: "O pagamento pelo site ainda não foi ativado no banco (migração 020)." }, 503);
  }
  console.error("[api/pagamento-site]", c.req.method, new URL(c.req.url).pathname, e);
  return json({ erro: 500, mensagem: "Erro no servidor." }, 500);
});

const hono = handle(app);

export async function onRequest(ctx: Contexto<"rota">): Promise<Response> {
  if (!ctx.env.DB) return json({ erro: 503, mensagem: "Banco indisponível." }, 503);
  segmentos(ctx.params, "rota");
  return hono(ctx as unknown as Parameters<typeof hono>[0]);
}
