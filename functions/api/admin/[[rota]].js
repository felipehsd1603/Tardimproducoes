// /api/admin/* — API do painel (admin.html), no D1 (binding DB). Documentação: /api/admin/docs (com login).
//
// Este arquivo só mapeia rota -> função; a lógica fica em functions/_admin/:
//   comum.js (erro, corpo, regras) · sessao.js (login) · tabelas.js (CRUD das tabelas do painel)
//   arquivos.js (imagens, configurações, contrato assinado) · avisos-email.js ("Me avise")
//   integracoes.js (API v1: convite, reenviar, desconectar) · inscricoes.js (o que chega e a conferência)
//
// Erros: { erro: <status>, mensagem }. Escrita só da própria origem (cabeçalho Origin).
// Cadastros feitos pelo site (parceiro.html) chegam como parceiros "pendente";
// aprovar = PUT parceiros/<id> { situacao: "aprovado", ativo: true }.

import { json, mesmaOrigem } from "../../_lib/http.js";
import { consultaCref6 } from "../../_lib/cref6.js";
import { confereInstagramParceiro } from "../../_lib/instagram.js";
import { avisaConvite, avisaConviteCancelado, avisaConvitesDaProva, origemPublica } from "../../_api-v1/avisos.js";
import { Erro, corpo } from "../../_admin/comum.js";
import { sessaoValida, login, cookie } from "../../_admin/sessao.js";
import { TABELAS, lista, uma, cria, altera, apaga } from "../../_admin/tabelas.js";
import { CONFIGS, config, contratoAssinado, enviaArquivo } from "../../_admin/arquivos.js";
import { enviaAvisos } from "../../_admin/avisos-email.js";
import { listaIntegracoes, convidaConexao, alteraConexao, desconecta } from "../../_admin/integracoes.js";
import { listaOrcamentos, listaInscricoes, atletasDoEnvio, alteraAtleta, confirmaEnvio, medicao, resumoAvisos } from "../../_admin/inscricoes.js";
import { OPENAPI_ADMIN } from "../../_admin/openapi.js";
import { paginaSwagger } from "../../_api-v1/openapi.js";

// [método ("*" = qualquer), padrão, função]. ":x" casa um segmento. Todas exigem login (as de entrar e sair ficam antes).
const ROTAS = [
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
    const novo = await cria(env, p.tabela, await corpo(request));
    if (p.tabela === "convites") avisa(() => avisaConvite(env, novo.id, origemPublica(url)));
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
      const antes = await env.DB.prepare("SELECT * FROM convites WHERE id = ?").bind(p.id).first().catch(() => null);
      if (antes) await avisaConviteCancelado(env, antes).catch(() => null);
    }
    return json(await apaga(env, p.tabela, p.id));
  }],
];

function casa(padrao, segs) {
  const partes = padrao.split("/");
  if (partes.length !== segs.length) return null;
  const p = {};
  for (let i = 0; i < partes.length; i++) {
    if (partes[i].startsWith(":")) p[partes[i].slice(1)] = segs[i];
    else if (partes[i] !== segs[i]) return null;
  }
  // ":tabela" só casa as tabelas que o painel edita
  if ("tabela" in p && !TABELAS[p.tabela]) return null;
  return p;
}

async function trata(request, env, segs, url, waitUntil) {
  const m = request.method;
  if (m !== "GET" && !mesmaOrigem(request)) throw new Erro(403, "Origem não permitida.");
  if (segs.join("/") === "login" && m === "POST") return login(request, env);
  if (segs.join("/") === "sair" && m === "POST") return json({ ok: true }, 200, { "set-cookie": cookie("", 0) });
  if (!(await sessaoValida(request, env))) throw new Erro(401, "Entre no painel.");

  for (const [metodo, padrao, fn] of ROTAS) {
    if (metodo !== "*" && metodo !== m) continue;
    const p = casa(padrao, segs);
    if (!p) continue;
    const avisa = (f) => { if (waitUntil) waitUntil(f().catch(() => {})); };
    return fn({ request, env, url, p, avisa });
  }
  throw new Erro(404, "Rota não encontrada.");
}

export async function onRequest({ request, env, params, waitUntil }) {
  if (!env.DB) return json({ erro: "config", mensagem: "O banco D1 (binding DB) não está ligado a este projeto." }, 503);
  if (!env.ADMIN_SENHA || !env.SESSAO_SEGREDO) {
    return json({ erro: "config", mensagem: "Defina os segredos ADMIN_SENHA e SESSAO_SEGREDO no projeto do Cloudflare Pages." }, 503);
  }
  const url = new URL(request.url);
  const segs = [].concat(params.rota || []).map((x) => decodeURIComponent(x));
  try {
    return await trata(request, env, segs, url, waitUntil);
  } catch (e) {
    if (e instanceof Erro) return json({ erro: e.status, mensagem: e.message }, e.status);
    const msg = String((e && e.message) || e);
    if (/UNIQUE/i.test(msg)) return json({ erro: 409, mensagem: "Já existe um registro com esse identificador, cupom ou arquivo." }, 409);
    if (/FOREIGN KEY/i.test(msg)) return json({ erro: 400, mensagem: "Registro ligado a outro que não existe." }, 400);
    if (/no such table/i.test(msg)) return json({ erro: 503, mensagem: "Faltam tabelas no banco: rode as migrações (npm run db:migracoes:producao)." }, 503);
    console.error("[api/admin]", request.method, url.pathname, e);
    return json({ erro: 500, mensagem: "Erro no servidor." }, 500);
  }
}
