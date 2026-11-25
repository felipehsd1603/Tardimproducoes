// Mensagens da Tardim para as plataformas das assessorias (docs/api-v1-parceiros.md):
//  - convite de conexão: JWS assinado (functions/_assinatura.js) para {plataforma}/api/integracoes/organizadoras/convites
//  - avisos (webhooks): POST no webhook_url da integração, assinado com HMAC-SHA256 do webhook_segredo
// Uma tentativa por vez; o resultado fica no banco para o painel mostrar "Reenviar".

import { assinaJws } from "./_assinatura.js";
import { linhasProvas, formataProva, conviteApi, integracaoAtiva } from "./_provas_api.js";

const enc = new TextEncoder();
const ESPERA = 10000;

// Endereço oficial que assina os convites (iss): o painel pode estar aberto pelo *.pages.dev
export function origemPublica(url) {
  return /(^|\.)tardimproducoes\.com\.br$|(^|\.)tardim-teste\.pages\.dev$/i.test(url.hostname) ? "https://tardimproducoes.com.br" : url.origin;
}

async function hmacHex(segredo, msg) {
  const k = await crypto.subtle.importKey("raw", enc.encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(msg)));
  let h = "";
  for (const x of s) h += x.toString(16).padStart(2, "0");
  return h;
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
export async function enviaAviso(integ, evento, dados) {
  if (!integ || !integ.webhook_url || !integ.webhook_segredo) return { ok: false, status: 0, erro: "sem endereço de avisos" };
  const id = "ent_" + crypto.randomUUID();
  const corpo = JSON.stringify({ id, evento, criado_em: new Date().toISOString().slice(0, 19) + "Z", dados });
  const t = Math.floor(Date.now() / 1000);
  const v1 = await hmacHex(integ.webhook_segredo, t + "." + corpo);
  return posta(integ.webhook_url, corpo, { "x-tardim-evento": evento, "x-tardim-entrega": id, "x-tardim-assinatura": "t=" + t + ",v1=" + v1 });
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
  const r = await enviaAviso(integ, evento, { convite: conviteApi(l), prova: await formataProva(env, l, integ, origem) });
  await marcaAviso(env, conviteId, r);
  return r;
}

// Convite apagado no painel (chamar ANTES de apagar, com os dados da linha)
export async function avisaConviteCancelado(env, convite) {
  if (!convite || !convite.api_situacao) return null;
  const integ = await integracaoAtiva(env, convite.parceiro_id);
  if (!integ) return null;
  return enviaAviso(integ, "convite.cancelado", { convite_id: convite.id, prova_id: convite.prova_id });
}

// Prova alterada ou publicada: avisa os convites dela de assessorias conectadas
export async function avisaConvitesDaProva(env, provaId, origem) {
  const r = await env.DB.prepare(
    "SELECT c.id FROM convites c WHERE c.prova_id = ? AND EXISTS (SELECT 1 FROM integracoes i WHERE i.parceiro_id = c.parceiro_id AND i.revogada_em = '')"
  ).bind(provaId).all();
  for (const x of r.results) await avisaConvite(env, x.id, origem).catch(() => null);
}
