// /api/v1/* — API para parceiros (plataformas de assessoria). Contrato: docs/api-v1-parceiros.md
// Documentação navegável: /api/v1/docs (Swagger UI) e /api/v1/openapi.json
//
// Este arquivo só mapeia rota -> função (tabela ROTAS, registrada numa app Hono); a lógica fica em functions/_api-v1/:
//   comum.ts (erro padrão, corpo, limite de uso) · autenticacao.ts · conexoes.ts · catalogo.ts
//   envios.ts · provas.ts (formato de provas e convites) · avisos.ts (convite assinado e webhooks)
//
// A chave nasce no aceite da conexão e vai direto para o servidor da plataforma: ninguém a copia.
// O banco guarda só o SHA-256 dela. Só servidor chama esta API: não há CORS.

import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";
import { json } from "../../_lib/http.ts";
import { segmentos, type AppHono } from "../../_lib/hono.ts";
import type { Env, Contexto, IntegracaoComParceiro } from "../../_lib/tipos.ts";
import { chavesPublicas } from "../../_lib/assinatura.ts";
import { ErroApi } from "../../_api-v1/comum.ts";
import { autentica } from "../../_api-v1/autenticacao.ts";
import { respondeConexao, desconecta } from "../../_api-v1/conexoes.ts";
import { eu, listaProvas, umaProva, listaConvites, respondeConvite } from "../../_api-v1/catalogo.ts";
import { recebeEnvio, consultaEnvio, situacaoAtletas } from "../../_api-v1/envios.ts";
import { OPENAPI_V1, paginaSwagger } from "../../_api-v1/openapi.ts";

const MAX_ENVIO = 1500000;

/** O que cada rota recebe. integ = integração da chave (só nas rotas com chave). */
interface Chamada { request: Request; env: Env; url: URL; integ: IntegracaoComParceiro; p: Record<string, string> }
type Rota = [metodo: string, padrao: string, comChave: boolean, fn: (ch: Chamada) => Response | Promise<Response>];

// [método, padrão, precisa de chave, função]. ":id" casa um segmento.
const ROTAS: Rota[] = [
  ["GET", "openapi.json", false, ({ url }) => json(Object.assign({}, OPENAPI_V1, { servers: [{ url: url.origin + "/api/v1" }] }))],
  ["GET", "docs", false, () => paginaSwagger("/api/v1/openapi.json", "API v1 para parceiros · Tardim Produções")],
  ["GET", "chaves-publicas", false, ({ env }) => new Response(JSON.stringify(chavesPublicas(env)), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=3600" } })],
  ["POST", "conexoes/:id/aceitar", false, ({ request, env, p }) => respondeConexao(request, env, p.id, "aceitar")],
  ["POST", "conexoes/:id/recusar", false, ({ request, env, p }) => respondeConexao(request, env, p.id, "recusar")],
  ["GET", "eu", true, ({ integ, url }) => eu(integ, url)],
  ["DELETE", "conexao", true, ({ env, integ }) => desconecta(env, integ)],
  ["GET", "provas", true, ({ env, integ, url }) => listaProvas(env, integ, url)],
  ["GET", "provas/:id", true, ({ env, integ, url, p }) => umaProva(env, integ, p.id, url)],
  ["GET", "provas/:id/resultados", true, () => { throw new ErroApi(501, "nao_implementado", "Esta rota chega na próxima etapa da API v1."); }],
  ["GET", "convites", true, ({ env, integ, url }) => listaConvites(env, integ, url)],
  ["POST", "convites/:id/aceitar", true, ({ request, env, integ, p }) => respondeConvite(request, env, integ, p.id, "aceitar")],
  ["POST", "convites/:id/recusar", true, ({ request, env, integ, p }) => respondeConvite(request, env, integ, p.id, "recusar")],
  ["POST", "envios", true, async ({ request, env, integ, url }) => {
    const t = await request.text();
    if (t.length > MAX_ENVIO) throw new ErroApi(413, "muitos_atletas", "Corpo grande demais.");
    const r = await recebeEnvio(request, env, integ, url, t);
    return json(r.corpo, r.status);
  }],
  ["GET", "envios/:id", true, async ({ env, integ, p }) => json(await consultaEnvio(env, integ, p.id))],
  ["GET", "atletas", true, async ({ env, integ, url }) => json(await situacaoAtletas(env, integ, url))],
];

// ---------- app Hono ----------
// Caminho que não casa com nenhuma rota: 404. Casa, mas com outro método: 405 com os métodos aceitos.
const app = new Hono<AppHono>({ strict: false }).basePath("/api/v1");

for (const [m, padrao, comChave, fn] of ROTAS) {
  app.all("/" + padrao, async (c, next) => {
    // Outro método (inclusive HEAD, que o Hono manda para as rotas GET): segue até o 405 abaixo
    if (c.req.method !== m) return next();
    const request = c.req.raw, env = c.env;
    const integ = comChave ? await autentica(request, env, (p) => c.executionCtx.waitUntil(p)) : null;
    return fn({ request, env, url: new URL(c.req.url), integ: integ as IntegracaoComParceiro, p: c.req.param() as Record<string, string> });
  });
}
// 405 por padrão, depois de todas as rotas. Os padrões da tabela não se sobrepõem (um caminho casa no máximo
// um padrão), então "Use X ou Y." lista os mesmos métodos que a tabela inteira listaria.
for (const padrao of [...new Set(ROTAS.map((r) => r[1]))]) {
  const metodos = ROTAS.filter((r) => r[1] === padrao).map((r) => r[0]);
  app.all("/" + padrao, () => { throw new ErroApi(405, "metodo", "Use " + metodos.join(" ou ") + "."); });
}

app.notFound(() => json({ erro: { codigo: "nao_encontrado", mensagem: "Rota não encontrada." } }, 404));

app.onError((e, c) => {
  if (e instanceof ErroApi) return json({ erro: { codigo: e.codigo, mensagem: e.message } }, e.status, e.extra);
  if (/no such (table|column)/i.test(String((e && e.message) || e))) {
    return json({ erro: { codigo: "config", mensagem: "Faltam tabelas no banco: rode as migrações (npm run db:migracoes:producao)." } }, 503);
  }
  console.error("[api/v1]", c.req.method, new URL(c.req.url).pathname, e);
  return json({ erro: { codigo: "erro_interno", mensagem: "Erro no servidor." } }, 500);
});

const hono = handle(app);

// Conferência do banco (503) e a decodificação dos segmentos ficam antes do Hono, como antes.
export async function onRequest(ctx: Contexto<"rota">): Promise<Response> {
  if (!ctx.env.DB) return json({ erro: { codigo: "config", mensagem: "Banco indisponível." } }, 503);
  segmentos(ctx.params, "rota");
  return hono(ctx as unknown as Parameters<typeof hono>[0]);
}
