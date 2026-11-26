// TikTok dos influenciadores pelo Login Kit (OAuth 2.0) e a Display API do TikTok.
//
// O influenciador clica em "Conectar TikTok" na área do parceiro, entra no TikTok e autoriza.
// Funciona com conta pessoal. Depois disso o painel lê seguidores, curtidas e vídeos dele
// (botão "Conferir TikTok"). Os tokens ficam cifrados na tabela tiktok_contas e são renovados
// aqui mesmo: o de acesso vale 24 horas e o de renovação, 1 ano.
//
// Segredos do projeto (nunca em arquivo do repositório):
//   TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET  credenciais do app no developers.tiktok.com (Sandbox ou Produção)
//   TIKTOK_CHAVE                             32 bytes em base64 que cifram os tokens no banco
//
// Endereços de retorno cadastrados no app (Login Kit > Web):
//   https://tardimproducoes.com.br/api/parceiro/tiktok-retorno e o mesmo com www.

import type { Env, Dados } from "./tipos.ts";
import { b64url, deB64url, enc, hmacB64url, iguais } from "./http.ts";

const AUTORIZA = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN = "https://open.tiktokapis.com/v2/oauth/token/";
const REVOGA = "https://open.tiktokapis.com/v2/oauth/revoke/";
const INFO = "https://open.tiktokapis.com/v2/user/info/?fields=open_id,username,display_name,follower_count,following_count,likes_count,video_count";
export const ESCOPOS = "user.info.basic,user.info.profile,user.info.stats";
const ORIGENS = ["https://tardimproducoes.com.br", "https://www.tardimproducoes.com.br"];
const VALIDADE_ESTADO = 15 * 60;

export type ResultadoTiktok =
  | { ok: true; usuario: string; nome: string; seguidores: number; curtidas: number; videos: number }
  | { ok: false; erro: "config" | "nao_conectado" | "revogado" | "indisponivel"; detalhe?: string };

interface Tokens { acesso: string; renovacao: string; open_id: string; acesso_expira: number; renova_expira: number; escopos: string }

export const configurado = (env: Env): boolean => !!(env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET && env.TIKTOK_CHAVE);
const agora = (): number => Math.floor(Date.now() / 1000);

// O retorno precisa ser um dos endereços cadastrados no app; fora deles (testes, prévias), o principal
export function enderecoRetorno(origem: string): string {
  return (ORIGENS.includes(origem) ? origem : ORIGENS[0]) + "/api/parceiro/tiktok-retorno";
}

// ---------- state do OAuth: conta + perfil + validade, assinado (amarra o retorno a quem pediu) ----------
export async function criaEstado(env: Env, contaId: string, parceiroId: string): Promise<string> {
  const corpo = b64url(enc.encode(JSON.stringify({ c: contaId, p: parceiroId, e: agora() + VALIDADE_ESTADO })));
  return corpo + "." + (await hmacB64url(env.SESSAO_SEGREDO as string, "tiktok." + corpo));
}
export async function leEstado(env: Env, estado: string): Promise<{ c: string; p: string } | null> {
  const [corpo, sig] = String(estado || "").split(".");
  if (!corpo || !sig || !iguais(sig, await hmacB64url(env.SESSAO_SEGREDO as string, "tiktok." + corpo))) return null;
  try {
    const d = JSON.parse(new TextDecoder().decode(deB64url(corpo)));
    return d && d.e > agora() && d.c && d.p ? { c: String(d.c), p: String(d.p) } : null;
  } catch (e) { return null; }
}

export function urlAutorizacao(env: Env, origem: string, estado: string): string {
  const q = new URLSearchParams({ client_key: env.TIKTOK_CLIENT_KEY as string, response_type: "code", scope: ESCOPOS, redirect_uri: enderecoRetorno(origem), state: estado });
  return AUTORIZA + "?" + q.toString();
}

// ---------- tokens cifrados ----------
async function chave(env: Env): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", Uint8Array.from(atob(env.TIKTOK_CHAVE as string), (c) => c.charCodeAt(0)), "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function cifra(env: Env, dados: Dados): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await chave(env), enc.encode(JSON.stringify(dados)));
  return b64url(iv) + "." + b64url(new Uint8Array(c));
}
async function decifra(env: Env, t: string): Promise<Dados | null> {
  try {
    const [iv, c] = t.split(".");
    return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64url(iv) }, await chave(env), deB64url(c))));
  } catch (e) { return null; }
}

// ---------- chamadas ao TikTok ----------
async function pedeToken(env: Env, campos: Record<string, string>): Promise<Tokens | { erro: string }> {
  let d: Dados;
  try {
    const r = await fetch(TOKEN, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "cache-control": "no-cache" },
      body: new URLSearchParams(Object.assign({ client_key: env.TIKTOK_CLIENT_KEY as string, client_secret: env.TIKTOK_CLIENT_SECRET as string }, campos)),
    });
    d = await r.json<Dados>();
  } catch (e) { return { erro: "indisponivel" }; }
  if (!d || !d.access_token) return { erro: String((d && (d.error_description || d.error)) || "sem token") };
  return {
    acesso: String(d.access_token), renovacao: String(d.refresh_token || ""), open_id: String(d.open_id || ""),
    acesso_expira: agora() + (Number(d.expires_in) || 0) - 60, renova_expira: agora() + (Number(d.refresh_expires_in) || 0) - 60,
    escopos: String(d.scope || ""),
  };
}

export const trocaCodigo = (env: Env, origem: string, codigo: string) =>
  pedeToken(env, { code: codigo, grant_type: "authorization_code", redirect_uri: enderecoRetorno(origem) });

async function leUsuario(acesso: string): Promise<{ ok: true; u: Dados } | { ok: false; revogado: boolean; detalhe: string }> {
  let d: Dados;
  try {
    const r = await fetch(INFO, { headers: { authorization: "Bearer " + acesso } });
    d = await r.json<Dados>();
  } catch (e) { return { ok: false, revogado: false, detalhe: "sem resposta" }; }
  const cod = String((d && d.error && d.error.code) || "");
  if (cod && cod !== "ok") return { ok: false, revogado: /access_token_invalid|scope_not_authorized/.test(cod), detalhe: cod + ": " + String(d.error.message || "") };
  const u = d && d.data && d.data.user;
  return u ? { ok: true, u } : { ok: false, revogado: false, detalhe: "resposta sem usuário" };
}

async function grava(env: Env, id: string, t: Tokens, u: Dados): Promise<ResultadoTiktok> {
  const usuario = String(u.username || "").toLowerCase();
  const r = { ok: true as const, usuario, nome: String(u.display_name || ""), seguidores: Number(u.follower_count) || 0, curtidas: Number(u.likes_count) || 0, videos: Number(u.video_count) || 0 };
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO tiktok_contas (parceiro_id, open_id, tokens, acesso_expira, renova_expira, escopos) VALUES (?1, ?2, ?3, ?4, ?5, ?6) " +
      "ON CONFLICT(parceiro_id) DO UPDATE SET open_id = ?2, tokens = ?3, acesso_expira = ?4, renova_expira = ?5, escopos = ?6"
    ).bind(id, t.open_id, await cifra(env, { acesso: t.acesso, renovacao: t.renovacao }), t.acesso_expira, t.renova_expira, t.escopos),
    env.DB.prepare(
      "UPDATE parceiros SET tiktok = ?, tt_situacao = 'conectado', tt_seguidores = ?, tt_curtidas = ?, tt_videos = ?, tt_conferido_em = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?"
    ).bind(usuario, r.seguidores, r.curtidas, r.videos, id),
  ]);
  return r;
}

async function marcaDesconectado(env: Env, id: string): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM tiktok_contas WHERE parceiro_id = ?").bind(id),
    env.DB.prepare("UPDATE parceiros SET tt_situacao = 'desconectado' WHERE id = ? AND tt_situacao <> ''").bind(id),
  ]);
}

// Retorno do "Conectar TikTok": tokens novos -> lê o perfil e grava
export async function conectaParceiro(env: Env, id: string, t: Tokens): Promise<ResultadoTiktok> {
  const l = await leUsuario(t.acesso);
  if (!l.ok) return { ok: false, erro: "indisponivel", detalhe: l.detalhe };
  return grava(env, id, t, l.u);
}

// Painel ("Conferir TikTok"): renova o token se precisar e atualiza os números
export async function confereTiktokParceiro(env: Env, id: string): Promise<ResultadoTiktok | null> {
  if (!configurado(env)) return { ok: false, erro: "config" };
  const p = await env.DB.prepare("SELECT id FROM parceiros WHERE id = ?").bind(id).first();
  if (!p) return null;
  const linha = await env.DB.prepare("SELECT * FROM tiktok_contas WHERE parceiro_id = ?").bind(id).first<Dados>();
  if (!linha) return { ok: false, erro: "nao_conectado" };
  const seg = await decifra(env, linha.tokens);
  if (!seg) return { ok: false, erro: "config", detalhe: "não consegui abrir os tokens (TIKTOK_CHAVE mudou?)" };
  let t: Tokens = { acesso: seg.acesso, renovacao: seg.renovacao, open_id: linha.open_id, acesso_expira: linha.acesso_expira, renova_expira: linha.renova_expira, escopos: linha.escopos };
  if (t.acesso_expira <= agora()) {
    if (!t.renovacao || t.renova_expira <= agora()) { await marcaDesconectado(env, id); return { ok: false, erro: "revogado" }; }
    const n = await pedeToken(env, { grant_type: "refresh_token", refresh_token: t.renovacao });
    if ("erro" in n) {
      if (n.erro === "indisponivel") return { ok: false, erro: "indisponivel" };
      await marcaDesconectado(env, id);
      return { ok: false, erro: "revogado", detalhe: n.erro };
    }
    t = Object.assign(n, { open_id: n.open_id || t.open_id });
  }
  const l = await leUsuario(t.acesso);
  if (!l.ok) {
    if (l.revogado) { await marcaDesconectado(env, id); return { ok: false, erro: "revogado", detalhe: l.detalhe }; }
    return { ok: false, erro: "indisponivel", detalhe: l.detalhe };
  }
  return grava(env, id, t, l.u);
}

// Parceiro tira a conexão: avisa o TikTok (revoga) e apaga os tokens; os últimos números ficam
export async function desconectaParceiro(env: Env, id: string): Promise<void> {
  const linha = await env.DB.prepare("SELECT tokens FROM tiktok_contas WHERE parceiro_id = ?").bind(id).first<Dados>();
  const seg = linha && configurado(env) ? await decifra(env, linha.tokens) : null;
  if (seg && seg.acesso) {
    await fetch(REVOGA, {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_key: env.TIKTOK_CLIENT_KEY as string, client_secret: env.TIKTOK_CLIENT_SECRET as string, token: seg.acesso }),
    }).catch(() => null);
  }
  await marcaDesconectado(env, id);
}
