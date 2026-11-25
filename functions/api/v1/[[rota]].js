// /api/v1/* — API para parceiros (plataformas de assessoria). Contrato: docs/api-v1-parceiros.md
// Documentação navegável: /api/v1/docs (Swagger UI) e /api/v1/openapi.json
//
// Este arquivo só mapeia rota -> função; a lógica fica em functions/_api-v1/:
//   comum.js (erro padrão, corpo, limite de uso) · autenticacao.js · conexoes.js · catalogo.js
//   envios.js · provas.js (formato de provas e convites) · avisos.js (convite assinado e webhooks)
//
// A chave nasce no aceite da conexão e vai direto para o servidor da plataforma: ninguém a copia.
// O banco guarda só o SHA-256 dela. Só servidor chama esta API: não há CORS.

import { json } from "../../_lib/http.js";
import { chavesPublicas } from "../../_lib/assinatura.js";
import { ErroApi } from "../../_api-v1/comum.js";
import { autentica } from "../../_api-v1/autenticacao.js";
import { respondeConexao, desconecta } from "../../_api-v1/conexoes.js";
import { eu, listaProvas, umaProva, listaConvites, respondeConvite } from "../../_api-v1/catalogo.js";
import { recebeEnvio, consultaEnvio, situacaoAtletas } from "../../_api-v1/envios.js";
import { OPENAPI_V1, paginaSwagger } from "../../_api-v1/openapi.js";

const MAX_ENVIO = 1500000;

// [método, padrão, precisa de chave, função]. ":id" casa um segmento.
const ROTAS = [
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

function casa(padrao, segs) {
  const partes = padrao.split("/");
  if (partes.length !== segs.length) return null;
  const p = {};
  for (let i = 0; i < partes.length; i++) {
    if (partes[i].startsWith(":")) p[partes[i].slice(1)] = segs[i];
    else if (partes[i] !== segs[i]) return null;
  }
  return p;
}

async function trata(request, env, segs, url, waitUntil) {
  const achadas = ROTAS.map((r) => [r, casa(r[1], segs)]).filter((x) => x[1]);
  if (!achadas.length) throw new ErroApi(404, "nao_encontrado", "Rota não encontrada.");
  const certa = achadas.find(([r]) => r[0] === request.method);
  if (!certa) throw new ErroApi(405, "metodo", "Use " + achadas.map(([r]) => r[0]).join(" ou ") + ".");
  const [[, , comChave, fn], p] = certa;
  const integ = comChave ? await autentica(request, env, waitUntil) : null;
  return fn({ request, env, url, integ, p });
}

export async function onRequest({ request, env, params, waitUntil }) {
  if (!env.DB) return json({ erro: { codigo: "config", mensagem: "Banco indisponível." } }, 503);
  const url = new URL(request.url);
  const segs = [].concat(params.rota || []).map((x) => decodeURIComponent(x));
  try {
    return await trata(request, env, segs, url, waitUntil);
  } catch (e) {
    if (e instanceof ErroApi) return json({ erro: { codigo: e.codigo, mensagem: e.message } }, e.status, e.extra);
    if (/no such (table|column)/i.test(String((e && e.message) || e))) {
      return json({ erro: { codigo: "config", mensagem: "Faltam tabelas no banco: rode as migrações (npm run db:migracoes:producao)." } }, 503);
    }
    console.error("[api/v1]", request.method, url.pathname, e);
    return json({ erro: { codigo: "erro_interno", mensagem: "Erro no servidor." } }, 500);
  }
}
