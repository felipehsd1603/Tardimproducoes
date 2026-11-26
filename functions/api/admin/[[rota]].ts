// /api/admin/* — API do painel (admin.html), no D1 (binding DB). Documentação: /api/admin/docs (com login).
//
// Este arquivo só mapeia rota -> função (tabela ROTAS, registrada numa app Hono); a lógica fica em functions/_admin/:
//   comum.ts (erro, corpo, regras) · sessao.ts (login) · tabelas.ts (CRUD das tabelas do painel)
//   arquivos.ts (imagens, configurações, contrato assinado) · avisos-email.ts ("Me avise")
//   integracoes.ts (API v1: convite, reenviar, desconectar) · inscricoes.ts (o que chega e a conferência)
//
// Erros: { erro: <status>, mensagem }. Escrita só da própria origem (cabeçalho Origin).
// Cadastros feitos pelo site (parceiro.html) chegam como parceiros "pendente";
// aprovar = PUT parceiros/<id> { situacao: "aprovado", ativo: true }.

import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";
import { json, mesmaOrigem } from "../../_lib/http.ts";
import { segmentos, type AppHono } from "../../_lib/hono.ts";
import type { Env, Contexto, Convite } from "../../_lib/tipos.ts";
import { consultaCref6 } from "../../_lib/cref6.ts";
import { confereInstagramParceiro } from "../../_lib/instagram.ts";
import { avisaConvite, avisaConviteCancelado, avisaConvitesDaProva, origemPublica } from "../../_api-v1/avisos.ts";
import { Erro, corpo } from "../../_admin/comum.ts";
import { sessaoValida, login, cookie } from "../../_admin/sessao.ts";
import { TABELAS, lista, uma, cria, altera, apaga } from "../../_admin/tabelas.ts";
import { CONFIGS, config, contratoAssinado, enviaArquivo } from "../../_admin/arquivos.ts";
import { enviaAvisos } from "../../_admin/avisos-email.ts";
import { listaIntegracoes, convidaConexao, alteraConexao, desconecta } from "../../_admin/integracoes.ts";
import { listaOrcamentos, listaInscricoes, atletasDoEnvio, alteraAtleta, confirmaEnvio, medicao, resumoAvisos } from "../../_admin/inscricoes.ts";
import { OPENAPI_ADMIN } from "../../_admin/openapi.ts";
import { paginaSwagger } from "../../_api-v1/openapi.ts";

/** O que cada rota recebe. p = parâmetros (":x") já decodificados; avisa = trabalho depois da resposta. */
interface Chamada {
  request: Request; env: Env; url: URL; p: Record<string, string>;
  avisa: (f: () => Promise<unknown>) => void;
}
type Rota = [metodo: string, padrao: string, fn: (ch: Chamada) => Response | Promise<Response>];

// [método ("*" = qualquer), padrão, função]. ":x" casa um segmento. Todas exigem login (as de entrar e sair ficam antes).
const ROTAS: Rota[] = [
  ["GET", "sessao", () => json({ ok: true })],
  ["GET", "docs", () => paginaSwagger("/api/admin/openapi.json", "API do painel · Tardim Produções")],
  ["GET", "openapi.json", () => json(OPENAPI_ADMIN)],
  ["GET", "dados", async ({ env }) => {
    // Banco sem a tabela de depoimentos: o resto do painel segue funcionando
    const [provas, parceiros, convites, depoimentos] = await Promise.all([lista(env, "provas"), lista(env, "parceiros"), lista(env, "convites"),
      lista(env, "depoimentos").catch(() => null)]);
    return json({ provas, parceiros, convites, depoimentos });
  }],
  ["POST", "arquivos", ({ request, env, url }) => enviaArquivo(request, env, url)],
  // Consulta ao CREF6 só para quem está no painel (não vira proxy aberto do CREF)
  ["GET", "cref6", async ({ url }) => json(await consultaCref6(url.searchParams.get("numero") || ""))],
  ["POST", "parceiros/:id/instagram", async ({ env, p }) => {
    const r = await confereInstagramParceiro(env, p.id);
    if (!r) throw new Erro(404, "Registro não encontrado.");
    return json({ resultado: r, parceiro: await uma(env, "parceiros", p.id) });
  }],
  // Integração com os sistemas das assessorias (API v1)
  ["GET", "parceiros/:id/integracoes", async ({ env, p }) => json(await listaIntegracoes(env, p.id))],
  ["POST", "parceiros/:id/conexao", ({ request, env, url, p }) => convidaConexao(request, env, p.id, url)],
  ["*", "conexoes/:id/:acao", ({ request, env, url, p }) => alteraConexao(env, request.method, p.id, p.acao, url)],
  ["*", "integracoes/:id/desconectar", ({ request, env, p }) => desconecta(env, request.method, p.id)],
  ["POST", "convites/:id/avisar", async ({ env, url, p }) => {
    const r = await avisaConvite(env, p.id, origemPublica(url));
    if (!r) throw new Erro(400, "Nada a avisar: a assessoria não está conectada ou a prova ainda não aparece para ela.");
    return json({ aviso: r, convite: await uma(env, "convites", p.id) });
  }],
  // "Me avise"
  ["GET", "avisos", ({ env }) => resumoAvisos(env)],
  ["POST", "avisos/:prova/enviar", async ({ request, env, url, p }) => json(await enviaAvisos(env, p.prova, await corpo(request), url.origin))],
  // Configurações e contrato assinado
  ["*", "config/:chave", ({ request, env, p }) => { if (!CONFIGS[p.chave]) throw new Erro(404, "Rota não encontrada."); return config(request, env, request.method, p.chave); }],
  ["*", "propostas/:id/assinado", ({ request, env, p }) => contratoAssinado(request, env, request.method, p.id)],
  // O que chega pelo site e pelos sistemas das assessorias
  ["GET", "medicao", ({ env, url }) => medicao(env, url)],
  ["GET", "orcamentos", ({ env }) => listaOrcamentos(env)],
  ["GET", "inscricoes", ({ env }) => listaInscricoes(env)],
  ["GET", "inscricoes/:id/atletas", ({ env, p }) => atletasDoEnvio(env, p.id)],
  ["POST", "inscricoes/:id/confirmar", ({ env, p }) => confirmaEnvio(env, p.id)],
  ["PUT", "atletas/:id", ({ request, env, p }) => alteraAtleta(request, env, p.id)],
  // CRUD das tabelas do painel (provas, parceiros, convites, propostas, minutario, depoimentos).
  // Convites e provas avisam as plataformas das assessorias conectadas, depois da resposta.
  ["GET", ":tabela", async ({ env, p }) => json(await lista(env, p.tabela))],
  ["POST", ":tabela", async ({ request, env, url, p, avisa }) => {
    const novo = (await cria(env, p.tabela, await corpo(request))) as { id: string };
    if (p.tabela === "convites") avisa(() => avisaConvite(env, novo.id, origemPublica(url)));
    // Prova trazida para o painel depois do convite: os convites dela passam a aparecer para as assessorias
    if (p.tabela === "provas") avisa(() => avisaConvitesDaProva(env, novo.id, origemPublica(url)));
    return json(novo, 201);
  }],
  ["PUT", ":tabela/:id", async ({ request, env, url, p, avisa }) => {
    const salvo = await altera(env, p.tabela, p.id, await corpo(request));
    if (p.tabela === "convites") avisa(() => avisaConvite(env, p.id, origemPublica(url)));
    if (p.tabela === "provas") avisa(() => avisaConvitesDaProva(env, p.id, origemPublica(url)));
    return json(salvo);
  }],
  ["DELETE", ":tabela/:id", async ({ env, p }) => {
    if (p.tabela === "convites") {
      const antes = await env.DB.prepare("SELECT * FROM convites WHERE id = ?").bind(p.id).first<Convite>().catch(() => null);
      if (antes) await avisaConviteCancelado(env, antes).catch(() => null);
    }
    return json(await apaga(env, p.tabela, p.id));
  }],
];

// ---------- app Hono ----------
// Ordem das conferências (igual à de antes): escrita de outra origem (403) -> entrar/sair -> login (401) -> rotas -> 404.
const app = new Hono<AppHono>({ strict: false }).basePath("/api/admin");

app.use(async (c, next) => {
  if (c.req.method !== "GET" && !mesmaOrigem(c.req.raw)) throw new Erro(403, "Origem não permitida.");
  await next();
});
app.post("/login", (c) => login(c.req.raw, c.env));
app.post("/sair", () => json({ ok: true }, 200, { "set-cookie": cookie("", 0) }));
app.use(async (c, next) => {
  if (!(await sessaoValida(c.req.raw, c.env))) throw new Erro(401, "Entre no painel.");
  await next();
});

// Cada linha da tabela vira uma rota. Método diferente (inclusive HEAD, que o Hono manda para as rotas GET)
// ou ":tabela" fora das tabelas do painel: segue para a próxima linha que casar, como o laço de antes.
for (const [m, padrao, fn] of ROTAS) {
  app.all("/" + padrao, (c, next) => {
    if (m !== "*" && m !== c.req.method) return next();
    const p = c.req.param() as Record<string, string>;
    if ("tabela" in p && !TABELAS[p.tabela]) return next();
    const avisa = (f: () => Promise<unknown>) => { c.executionCtx.waitUntil(f().catch(() => {})); };
    return fn({ request: c.req.raw, env: c.env, url: new URL(c.req.url), p, avisa });
  });
}

app.notFound(() => json({ erro: 404, mensagem: "Rota não encontrada." }, 404));

app.onError((e, c) => {
  if (e instanceof Erro) return json({ erro: e.status, mensagem: e.message }, e.status);
  const msg = String((e && e.message) || e);
  if (/UNIQUE/i.test(msg)) return json({ erro: 409, mensagem: "Já existe um registro com esse identificador, cupom ou arquivo." }, 409);
  if (/FOREIGN KEY/i.test(msg)) return json({ erro: 400, mensagem: "Registro ligado a outro que não existe." }, 400);
  if (/no such table/i.test(msg)) return json({ erro: 503, mensagem: "Faltam tabelas no banco: rode as migrações (npm run db:migracoes:producao)." }, 503);
  console.error("[api/admin]", c.req.method, new URL(c.req.url).pathname, e);
  return json({ erro: 500, mensagem: "Erro no servidor." }, 500);
});

const hono = handle(app);

// Conferências de configuração (503) e a decodificação dos segmentos ficam antes do Hono, como antes.
export async function onRequest(ctx: Contexto<"rota">): Promise<Response> {
  const { env, params } = ctx;
  if (!env.DB) return json({ erro: "config", mensagem: "O banco D1 (binding DB) não está ligado a este projeto." }, 503);
  if (!env.ADMIN_SENHA || !env.SESSAO_SEGREDO) {
    return json({ erro: "config", mensagem: "Defina os segredos ADMIN_SENHA e SESSAO_SEGREDO no projeto do Cloudflare Pages." }, 503);
  }
  segmentos(params, "rota");
  return hono(ctx as unknown as Parameters<typeof hono>[0]);
}
