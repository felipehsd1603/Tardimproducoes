// Mensagens da Tardim para as plataformas das assessorias (docs/api-v1-parceiros.md):
//  - convite de conexão: JWS assinado (functions/_lib/assinatura.ts) para {plataforma}/api/integracoes/organizadoras/convites
//  - avisos (webhooks): POST no webhook_url da integração, assinado com HMAC-SHA256 do webhook_segredo
// Uma tentativa por vez; o resultado fica no banco para o painel mostrar "Reenviar".

import { assinaJws } from "../_lib/assinatura.ts";
import { hmacHex } from "../_lib/http.ts";
import { linhasProvas, formataProva, conviteApi, integracaoAtiva } from "./provas.ts";

const ESPERA = 10000;

// Endereço oficial que assina os convites (iss): o painel pode estar aberto pelo *.pages.dev
export function origemPublica(url) {
  return /(^|\.)tardimproducoes\.com\.br$|(^|\.)tardim-teste\.pages\.dev$/i.test(url.hostname) ? "https://tardimproducoes.com.br" : url.origin;
}

async function posta(url, corpo, cabecalhos) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ESPERA);
  try {
    const r = await fetch(url, { method: "POST", body: corpo, headers: Object.assign({ "content-type": "application/json" }, cabecalhos || {}), signal: ctl.signal, redirect: "manual" });
    if (r.status >= 200 && r.status < 300) return { ok: true, status: r.status };
    let detalhe = "";
    try { detalhe = (await r.text()).slice(0, 200); } catch (e) { /* sem corpo */ }
    return { ok: false, status: r.status, erro: "HTTP " + r.status + (detalhe ? ": " + detalhe : "") };
  } catch (e) {
    return { ok: false, status: 0, erro: ctl.signal.aborted ? "sem resposta em 10 s" : "não conectou (" + String((e && e.message) || e).slice(0, 120) + ")" };
  } finally { clearTimeout(t); }
}

// ---------- convite de conexão ----------
export function endpointConvites(plataformaUrl) { return plataformaUrl.replace(/\/+$/, "") + "/api/integracoes/organizadoras/convites"; }

export async function enviaConviteConexao(env, cx, parceiro, codigo, origem) {
  const agora = Math.floor(Date.now() / 1000);
  const jws = await assinaJws(env, {
    iss: origem,
    aud: cx.plataforma_url,
    tipo: "conexao",
    convite_id: cx.id,
    codigo,
    ambiente: cx.ambiente,
    iat: agora,
    exp: Math.floor(Date.parse(cx.expira_em) / 1000),
    organizadora: { id: "tardim", nome: "Tardim Produções", site: origem, logo_url: origem + "/assets/logo-tardim.png" },
    assessoria: { id: parceiro.id, nome: parceiro.nome, responsavel: parceiro.responsavel || null, email: parceiro.email || null },
    compartilha: [
      "Provas em que a assessoria tiver convite da Tardim",
      "Situação das inscrições que a assessoria enviar",
      "Resultados dos atletas inscritos pela assessoria",
    ],
    aceitar_url: origem + "/api/v1/conexoes/" + cx.id + "/aceitar",
    recusar_url: origem + "/api/v1/conexoes/" + cx.id + "/recusar",
  }, "tardim-convite+jws");
  return posta(endpointConvites(cx.plataforma_url), JSON.stringify({ jws }));
}

// ---------- avisos (webhooks) ----------
// Novas tentativas (minutos depois da 1ª, 2ª... falha). Depois da última, a entrega é dada como perdida.
const ESPERAS_MIN = [1, 5, 30, 120, 360, 1440];
const isoAgora = (mais = 0) => new Date(Date.now() + mais * 60000).toISOString().slice(0, 19) + "Z";

async function entrega(integ, evento, id, corpo) {
  const t = Math.floor(Date.now() / 1000);
  const v1 = await hmacHex(integ.webhook_segredo, t + "." + corpo);
  return posta(integ.webhook_url, corpo, { "x-tardim-evento": evento, "x-tardim-entrega": id, "x-tardim-assinatura": "t=" + t + ",v1=" + v1 });
}

/** Manda um aviso agora; se falhar, entra na fila (avisos_fila) com o mesmo id de entrega. */
export async function enviaAviso(env, integ, evento, dados) {
  if (!integ || !integ.webhook_url || !integ.webhook_segredo) return { ok: false, status: 0, erro: "sem endereço de avisos" };
  const id = "ent_" + crypto.randomUUID();
  const corpo = JSON.stringify({ id, evento, criado_em: isoAgora(), dados });
  const r = await entrega(integ, evento, id, corpo);
  if (!r.ok) {
    await env.DB.prepare("INSERT INTO avisos_fila (id, integracao_id, evento, corpo, tentativas, proxima_em, ultimo_erro) VALUES (?, ?, ?, ?, 1, ?, ?)")
      .bind(id, integ.id, evento, corpo, isoAgora(ESPERAS_MIN[0]), String(r.erro || "").slice(0, 300)).run().catch(() => {});
  }
  return Object.assign(r, { entrega: id });
}

// Entregue depois de falhar: as marcas de "aviso não entregue" do painel passam a "ok"
async function marcaEntregue(env, x) {
  try {
    const c = JSON.parse(x.corpo).dados || {};
    if (x.evento.startsWith("convite.") && (c.convite?.id || c.convite_id)) {
      await env.DB.prepare("UPDATE convites SET api_aviso = 'ok' WHERE id = ?").bind(c.convite?.id || c.convite_id).run();
    }
    if (x.evento === "atleta.situacao" && Array.isArray(c.atletas) && c.atletas.length) {
      await env.DB.prepare("UPDATE atletas SET aviso = 'ok' WHERE prova_id = ? AND parceiro_id = (SELECT parceiro_id FROM integracoes WHERE id = ?) AND id_externo IN (" +
        c.atletas.map(() => "?").join(",") + ")").bind(c.prova_id, x.integracao_id, ...c.atletas.map((a) => a.id_externo)).run();
    }
  } catch (e) { /* marca é só informativa */ }
}

/**
 * Tenta de novo os avisos vencidos da fila (até `limite` por chamada). Roda em segundo plano nas
 * requisições que chegam (Pages não tem tarefa agendada). Cada linha é "reservada" antes do envio
 * para duas chamadas simultâneas não mandarem o mesmo aviso.
 */
export async function processaFila(env, limite = 10) {
  const lista = (await env.DB.prepare(
    "SELECT f.*, i.webhook_url, i.webhook_segredo, i.revogada_em FROM avisos_fila f LEFT JOIN integracoes i ON i.id = f.integracao_id " +
    "WHERE f.entregue_em = '' AND f.desistido_em = '' AND f.proxima_em <= ? ORDER BY f.proxima_em LIMIT ?"
  ).bind(isoAgora(), limite).all()).results;
  let entregues = 0;
  for (const x of lista) {
    const reserva = await env.DB.prepare("UPDATE avisos_fila SET proxima_em = ? WHERE id = ? AND proxima_em = ?").bind(isoAgora(2), x.id, x.proxima_em).run();
    if (!reserva.meta || !reserva.meta.changes) continue;
    // Conexão encerrada: só o próprio aviso de encerramento ainda vai
    if (!x.webhook_url || (x.revogada_em && x.evento !== "conexao.encerrada")) {
      await env.DB.prepare("UPDATE avisos_fila SET desistido_em = ?, ultimo_erro = 'conexão encerrada' WHERE id = ?").bind(isoAgora(), x.id).run();
      continue;
    }
    const r = await entrega(x, x.evento, x.id, x.corpo);
    if (r.ok) {
      entregues++;
      await env.DB.prepare("UPDATE avisos_fila SET entregue_em = ?, tentativas = tentativas + 1 WHERE id = ?").bind(isoAgora(), x.id).run();
      await marcaEntregue(env, x);
    } else if (x.tentativas >= ESPERAS_MIN.length) {
      await env.DB.prepare("UPDATE avisos_fila SET desistido_em = ?, tentativas = tentativas + 1, ultimo_erro = ? WHERE id = ?").bind(isoAgora(), String(r.erro || "").slice(0, 300), x.id).run();
    } else {
      await env.DB.prepare("UPDATE avisos_fila SET tentativas = tentativas + 1, proxima_em = ?, ultimo_erro = ? WHERE id = ?")
        .bind(isoAgora(ESPERAS_MIN[x.tentativas]), String(r.erro || "").slice(0, 300), x.id).run();
    }
  }
  return { vistos: lista.length, entregues };
}

const marcaAviso = (env, id, r) => env.DB.prepare("UPDATE convites SET api_aviso = ? WHERE id = ?")
  .bind(r.ok ? "ok" : "erro: " + String(r.erro || "").slice(0, 200), id).run();

// Convite de prova criado ou alterado: se a assessoria está conectada e a prova aparece para ela,
// marca como pendente (primeira vez) e manda convite.criado / convite.alterado.
// Devolve null quando não há o que avisar (sem conexão, prova passada ou não publicada).
export async function avisaConvite(env, conviteId, origem) {
  const c = await env.DB.prepare("SELECT id, parceiro_id FROM convites WHERE id = ?").bind(conviteId).first();
  if (!c) return null;
  const integ = await integracaoAtiva(env, c.parceiro_id);
  if (!integ) return null;
  const [l] = await linhasProvas(env, integ, { conviteId, todosConvites: true });
  if (!l) return null;
  const evento = l.c_situacao ? "convite.alterado" : "convite.criado";
  if (!l.c_situacao) {
    await env.DB.prepare("UPDATE convites SET api_situacao = 'pendente' WHERE id = ? AND api_situacao = ''").bind(conviteId).run();
    l.c_situacao = "pendente";
  }
  const r = await enviaAviso(env, integ, evento, { convite: conviteApi(l), prova: await formataProva(env, l, integ, origem) });
  await marcaAviso(env, conviteId, r);
  return r;
}

// Convite apagado no painel (chamar ANTES de apagar, com os dados da linha)
export async function avisaConviteCancelado(env, convite) {
  if (!convite || !convite.api_situacao) return null;
  const integ = await integracaoAtiva(env, convite.parceiro_id);
  if (!integ) return null;
  return enviaAviso(env, integ, "convite.cancelado", { convite_id: convite.id, prova_id: convite.prova_id });
}

// Situação de atletas mudou no painel: um aviso atleta.situacao por assessoria e prova
export function atletaApi(a) {
  return { id_externo: a.id_externo, situacao: a.situacao, motivo: a.motivo || null, numero_peito: a.numero_peito || null, percurso_id: a.percurso_id || null };
}
export async function avisaAtletas(env, ids) {
  if (!ids || !ids.length) return [];
  const linhas = (await env.DB.prepare(
    "SELECT * FROM atletas WHERE origem = 'api' AND id IN (" + ids.map(() => "?").join(",") + ")"
  ).bind(...ids).all()).results;
  const grupos = {};
  for (const a of linhas) (grupos[a.parceiro_id + "|" + a.prova_id] = grupos[a.parceiro_id + "|" + a.prova_id] || []).push(a);
  const res = [];
  for (const k of Object.keys(grupos)) {
    const g = grupos[k];
    const integ = await integracaoAtiva(env, g[0].parceiro_id);
    const r = integ ? await enviaAviso(env, integ, "atleta.situacao", { prova_id: g[0].prova_id, atletas: g.map(atletaApi) }) : { ok: false, erro: "assessoria desconectada" };
    const marca = r.ok ? "ok" : "erro: " + String(r.erro || "").slice(0, 200);
    await env.DB.batch(g.map((a) => env.DB.prepare("UPDATE atletas SET aviso = ? WHERE id = ?").bind(marca, a.id)));
    res.push(Object.assign({ prova_id: g[0].prova_id, atletas: g.length }, r));
  }
  return res;
}

// Prova alterada ou publicada: avisa os convites dela de assessorias conectadas
export async function avisaConvitesDaProva(env, provaId, origem) {
  const r = await env.DB.prepare(
    "SELECT c.id FROM convites c WHERE c.prova_id = ? AND EXISTS (SELECT 1 FROM integracoes i WHERE i.parceiro_id = c.parceiro_id AND i.revogada_em = '')"
  ).bind(provaId).all();
  for (const x of r.results) await avisaConvite(env, x.id, origem).catch(() => null);
}
