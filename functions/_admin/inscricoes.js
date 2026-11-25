// O que chega pelo site e pelos sistemas das assessorias: orçamentos, inscrições coletivas (planilha e
// API v1), a conferência dos atletas (cada mudança avisa a plataforma com atleta.situacao) e a medição.

import { json } from "../_lib/http.js";
import { avisaAtletas } from "../_api-v1/avisos.js";
import { Erro, corpo } from "./comum.js";

const SITUACOES = ["recebido", "aguardando_pagamento", "inscrito", "recusado", "cancelado"];
const agora = () => new Date().toISOString().slice(0, 19) + "Z";

/** GET orcamentos */
export async function listaOrcamentos(env) {
  return json((await env.DB.prepare("SELECT * FROM orcamentos ORDER BY id DESC LIMIT 500").all()).results);
}

/** GET inscricoes (cada envio, com o total de atletas) */
export async function listaInscricoes(env) {
  return json((await env.DB.prepare(
    "SELECT i.*, (SELECT COUNT(*) FROM atletas t WHERE t.inscricao_id = i.id) AS atletas FROM inscricoes i ORDER BY i.criado_em DESC LIMIT 500"
  ).all()).results);
}

/** GET inscricoes/<id>/atletas */
export async function atletasDoEnvio(env, inscricaoId) {
  return json((await env.DB.prepare("SELECT * FROM atletas WHERE inscricao_id = ? ORDER BY id").bind(inscricaoId).all()).results);
}

/** PUT atletas/<id> { situacao, numero_peito, motivo } */
export async function alteraAtleta(request, env, id) {
  const d = await corpo(request);
  const at = await env.DB.prepare("SELECT * FROM atletas WHERE id = ?").bind(Number(id)).first();
  if (!at) throw new Erro(404, "Registro não encontrado.");
  const situacao = d.situacao === undefined ? at.situacao : String(d.situacao);
  if (at.origem === "api" && !SITUACOES.includes(situacao)) throw new Erro(400, "Situação inválida.");
  const peito = d.numero_peito === undefined ? at.numero_peito : String(d.numero_peito || "").trim().slice(0, 10);
  const motivo = d.motivo === undefined ? (situacao === "recusado" || situacao === "cancelado" ? at.motivo : "") : String(d.motivo || "").trim().slice(0, 300);
  await env.DB.prepare("UPDATE atletas SET situacao = ?, numero_peito = ?, motivo = ?, atualizado_em = ? WHERE id = ?")
    .bind(situacao, peito, motivo, agora(), at.id).run();
  const aviso = at.origem === "api" ? (await avisaAtletas(env, [at.id]))[0] || null : null;
  return json({ atleta: await env.DB.prepare("SELECT * FROM atletas WHERE id = ?").bind(at.id).first(), aviso });
}

/** POST inscricoes/<id>/confirmar: recebidos e aguardando deste envio viram inscritos */
export async function confirmaEnvio(env, inscricaoId) {
  const ids = (await env.DB.prepare("SELECT id FROM atletas WHERE inscricao_id = ? AND origem = 'api' AND situacao IN ('recebido', 'aguardando_pagamento')")
    .bind(inscricaoId).all()).results.map((x) => x.id);
  if (ids.length) {
    await env.DB.prepare("UPDATE atletas SET situacao = 'inscrito', motivo = '', atualizado_em = ? WHERE id IN (" + ids.map(() => "?").join(",") + ")")
      .bind(agora(), ...ids).run();
  }
  return json({ confirmados: ids.length, avisos: await avisaAtletas(env, ids) });
}

/** GET medicao?dias=30 (functions/api/evento.js): totais por evento e página */
export async function medicao(env, url) {
  const dias = Math.min(Math.max(parseInt(url.searchParams.get("dias"), 10) || 30, 1), 365);
  const desde = new Date(Date.now() - 3 * 3600 * 1000 - (dias - 1) * 86400000).toISOString().slice(0, 10);
  return json((await env.DB.prepare("SELECT evento, ref, SUM(n) AS n FROM medicao WHERE dia >= ? GROUP BY evento, ref").bind(desde).all()).results);
}

/** GET avisos: pedidos de "Me avise" por prova */
export async function resumoAvisos(env) {
  return json((await env.DB.prepare(
    "SELECT prova_id, SUM(enviado_em = '') AS pendentes, SUM(enviado_em <> '') AS enviados FROM avisos GROUP BY prova_id"
  ).all()).results);
}
