// Integrações (API v1 para parceiros): o painel convida o sistema da assessoria, reenvia ou cancela o
// convite e desconecta. Ver docs/api-v1-parceiros.md.

import { json, sha256 } from "../_lib/http.js";
import { assinaturaConfigurada } from "../_lib/assinatura.js";
import { enviaConviteConexao, enviaAviso, origemPublica } from "../_api-v1/avisos.js";
import { Erro, corpo } from "./comum.js";

// ---------- integrações (API v1 para parceiros, docs/api-v1-parceiros.md) ----------
// Tudo por convite: o painel convida a plataforma da assessoria (convite assinado),
// o admin dela aceita ou recusa lá, e a chave vai direto para o servidor dela.
const CAMPOS_INTEGRACAO = "id, parceiro_id, nome, plataforma_url, ambiente, prefixo, webhook_url, usada_em, revogada_em, criada_em";
const CAMPOS_CONEXAO = "id, parceiro_id, plataforma_url, ambiente, situacao, erro, motivo, respondido_por, integracao_id, expira_em, enviado_em, respondido_em, criado_em";
const VALIDADE_CONVITE = 7 * 86400000;

function urlPlataforma(valor, request) {
  let u;
  try { u = new URL(String(valor || "").trim()); } catch (e) { throw new Erro(400, "Endereço do sistema inválido. Exemplo: https://im3-eventos.vercel.app"); }
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname);
  const painelLocal = /^(localhost|127\.0\.0\.1)$/.test(new URL(request.url).hostname);
  if (u.protocol !== "https:" && !(local && painelLocal && u.protocol === "http:")) throw new Erro(400, "O endereço do sistema precisa começar com https://.");
  return u.origin;
}

async function listaIntegracoes(env, parceiroId) {
  const [cx, it] = await Promise.all([
    env.DB.prepare("SELECT " + CAMPOS_CONEXAO + " FROM conexoes WHERE parceiro_id = ? ORDER BY criado_em DESC LIMIT 20").bind(parceiroId).all(),
    env.DB.prepare("SELECT " + CAMPOS_INTEGRACAO + " FROM integracoes WHERE parceiro_id = ? ORDER BY criada_em DESC").bind(parceiroId).all(),
  ]);
  return { conexoes: cx.results, integracoes: it.results, assinatura: assinaturaConfigurada(env) };
}

// Gera código novo, grava e entrega o convite assinado à plataforma
async function entregaConvite(env, cx, url) {
  const p = await env.DB.prepare("SELECT id, nome, responsavel, email FROM parceiros WHERE id = ?").bind(cx.parceiro_id).first();
  const codigo = Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) => x.toString(16).padStart(2, "0")).join("");
  const expira = new Date(Date.now() + VALIDADE_CONVITE).toISOString().slice(0, 19) + "Z";
  await env.DB.prepare("UPDATE conexoes SET codigo_hash = ?, expira_em = ?, situacao = 'enviando', erro = '' WHERE id = ?")
    .bind(await sha256(codigo), expira, cx.id).run();
  const r = await enviaConviteConexao(env, Object.assign({}, cx, { expira_em: expira }), p, codigo, origemPublica(url));
  await env.DB.prepare("UPDATE conexoes SET situacao = ?, erro = ?, enviado_em = ? WHERE id = ? AND situacao = 'enviando'")
    .bind(r.ok ? "enviado" : "falhou", r.ok ? "" : String(r.erro || "").slice(0, 300), new Date().toISOString().slice(0, 19) + "Z", cx.id).run();
  return env.DB.prepare("SELECT " + CAMPOS_CONEXAO + " FROM conexoes WHERE id = ?").bind(cx.id).first();
}

async function convidaConexao(request, env, parceiroId, url) {
  const p = await env.DB.prepare("SELECT id, tipo, situacao, ativo FROM parceiros WHERE id = ?").bind(parceiroId).first();
  if (!p) throw new Erro(404, "Registro não encontrado.");
  if (p.tipo !== "assessoria") throw new Erro(400, "Só assessoria pode ser conectada.");
  if (p.situacao !== "aprovado" || !p.ativo) throw new Erro(400, "Aprove e ative a assessoria antes de convidar.");
  if (!assinaturaConfigurada(env)) throw new Erro(503, "Falta configurar a assinatura dos convites (segredo TARDIM_ASSINATURA_JWK). Veja o README.");
  const d = await corpo(request);
  const plataforma = urlPlataforma(d.plataforma_url, request);
  const ambiente = d.ambiente === "test" ? "test" : "live";
  const id = "cnx_" + crypto.randomUUID();
  // Convites ainda sem resposta para a mesma plataforma deixam de valer
  await env.DB.prepare("UPDATE conexoes SET situacao = 'cancelado' WHERE parceiro_id = ? AND plataforma_url = ? AND situacao IN ('enviando', 'enviado', 'falhou')")
    .bind(parceiroId, plataforma).run();
  await env.DB.prepare("INSERT INTO conexoes (id, parceiro_id, plataforma_url, ambiente, codigo_hash, expira_em) VALUES (?, ?, ?, ?, '', '')")
    .bind(id, parceiroId, plataforma, ambiente).run();
  const cx = await env.DB.prepare("SELECT * FROM conexoes WHERE id = ?").bind(id).first();
  return json(await entregaConvite(env, cx, url), 201);
}

async function alteraConexao(env, m, id, acao, url) {
  const cx = await env.DB.prepare("SELECT * FROM conexoes WHERE id = ?").bind(id).first();
  if (!cx) throw new Erro(404, "Registro não encontrado.");
  if (m !== "POST") throw new Erro(404, "Rota não encontrada.");
  const aberta = ["enviando", "enviado", "falhou"].includes(cx.situacao);
  if (acao === "reenviar") {
    if (!aberta) throw new Erro(400, "Este convite já foi respondido ou cancelado. Faça um convite novo.");
    return json(await entregaConvite(env, cx, url));
  }
  if (acao === "cancelar") {
    if (aberta) await env.DB.prepare("UPDATE conexoes SET situacao = 'cancelado' WHERE id = ?").bind(id).run();
    return json(await env.DB.prepare("SELECT " + CAMPOS_CONEXAO + " FROM conexoes WHERE id = ?").bind(id).first());
  }
  throw new Erro(404, "Rota não encontrada.");
}

// Desconectar: avisa a plataforma (com o segredo desta conexão) e revoga a chave
async function desconecta(env, m, id) {
  if (m !== "POST") throw new Erro(404, "Rota não encontrada.");
  const atual = await env.DB.prepare("SELECT * FROM integracoes WHERE id = ?").bind(id).first();
  if (!atual) throw new Erro(404, "Registro não encontrado.");
  let aviso = null;
  if (!atual.revogada_em) {
    aviso = await enviaAviso(env, atual, "conexao.encerrada", { motivo: "Desconectado pela Tardim Produções." }).catch(() => null);
    await env.DB.prepare("UPDATE integracoes SET revogada_em = ? WHERE id = ?").bind(new Date().toISOString().slice(0, 19) + "Z", id).run();
  }
  return json({ integracao: await env.DB.prepare("SELECT " + CAMPOS_INTEGRACAO + " FROM integracoes WHERE id = ?").bind(id).first(), aviso });
}

export { listaIntegracoes, convidaConexao, alteraConexao, desconecta };
