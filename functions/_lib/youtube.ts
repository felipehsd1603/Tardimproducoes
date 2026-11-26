// Consulta de canais do YouTube pela YouTube Data API v3 (dados públicos do canal).
//
// Funciona com qualquer canal (não precisa ser conta "profissional") e o influenciador
// não precisa fazer nada: basta o @ ou o link do canal. A API é gratuita (cota de
// 10 mil unidades por dia; cada consulta gasta 1).
// O YouTube arredonda os inscritos (1.234 -> 1.230) e o dono do canal pode escondê-los.
//
// Segredo do projeto (nunca em arquivo do repositório):
//   YOUTUBE_API_KEY  chave de API do Google Cloud com a "YouTube Data API v3" ativada
//
// Uso (numa Function):  import { consultaYoutube } from "../../_lib/youtube.ts";
//   const r = await consultaYoutube(env, "@canal");
//   r = { ok: true, encontrado: true, canal, nome, inscritos, oculto, videos, views }
//     | { ok: true, encontrado: false, canal }
//     | { ok: false, erro: "config" | "canal" | "chave" | "cota" | "indisponivel" }

import type { Env, Dados } from "./tipos.ts";

export type ResultadoYoutube =
  | { ok: true; encontrado: true; canal: string; nome: string; inscritos: number; oculto: boolean; videos: number; views: number }
  | { ok: true; encontrado: false; canal: string; inscritos?: undefined; oculto?: undefined; videos?: undefined; views?: undefined }
  | { ok: false; erro: "config" | "canal" | "chave" | "cota" | "indisponivel" };

// "@Canal", "canal", "youtube.com/@canal/videos", "youtube.com/channel/UC..." -> "@canal" ou "UC..."
export function canalYoutube(texto: unknown): string {
  let u = String(texto == null ? "" : texto).trim()
    .replace(/^https?:\/\//i, "").replace(/^(www\.|m\.)?youtube\.com\//i, "").replace(/[?#].*$/, "");
  const id = /^channel\/(UC[\w-]{22})(\/|$)/.exec(u);
  if (id) return id[1];
  if (/^UC[\w-]{22}$/.test(u)) return u;
  // link de vídeo, playlist, /c/ ou /user/ antigos ou de outro site: não dá para saber o canal
  if (/\//.test(u) && !u.startsWith("@")) return "";
  u = u.replace(/^@/, "").replace(/\/.*$/, "").toLowerCase();
  if (/^(watch|shorts|playlist|results|feed|live)$/.test(u)) return "";
  return /^[\w.-]{3,30}$/.test(u) ? "@" + u : "";
}

export async function consultaYoutube(env: Env, texto: unknown): Promise<ResultadoYoutube> {
  if (!env.YOUTUBE_API_KEY) return { ok: false, erro: "config" };
  const canal = canalYoutube(texto);
  if (!canal) return { ok: false, erro: "canal" };
  const filtro = canal.startsWith("@") ? "forHandle=" + encodeURIComponent(canal) : "id=" + encodeURIComponent(canal);
  let r: Response, d: Dados;
  try {
    // chave no cabeçalho, para não aparecer em logs de URL
    r = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&" + filtro, {
      headers: { "x-goog-api-key": env.YOUTUBE_API_KEY },
    });
    d = await r.json<Dados>();
  } catch (e) {
    return { ok: false, erro: "indisponivel" };
  }
  if (d && d.error) {
    const motivo = String((d.error.errors && d.error.errors[0] && d.error.errors[0].reason) || "");
    if (/quota/i.test(motivo)) return { ok: false, erro: "cota" };
    if (/keyInvalid|accessNotConfigured|forbidden/i.test(motivo) || r.status === 400 || r.status === 403) return { ok: false, erro: "chave" };
    return { ok: false, erro: "indisponivel" };
  }
  if (!r.ok) return { ok: false, erro: "indisponivel" };
  const c = d && Array.isArray(d.items) ? d.items[0] : null;
  if (!c) return { ok: true, encontrado: false, canal };
  const s = c.statistics || {};
  const sn = c.snippet || {};
  return {
    ok: true, encontrado: true,
    canal: sn.customUrl ? "@" + String(sn.customUrl).replace(/^@/, "").toLowerCase() : canal,
    nome: String(sn.title || ""), oculto: !!s.hiddenSubscriberCount,
    inscritos: Number(s.subscriberCount) || 0, videos: Number(s.videoCount) || 0, views: Number(s.viewCount) || 0,
  };
}

// Consulta e grava no parceiro (colunas yt_*). Falha de configuração/rede não grava nada.
export async function confereYoutubeParceiro(env: Env, id: string): Promise<ResultadoYoutube | null> {
  const p = await env.DB.prepare("SELECT youtube FROM parceiros WHERE id = ?").bind(id).first<{ youtube: string }>();
  if (!p) return null;
  const r = await consultaYoutube(env, p.youtube);
  if (!r.ok) return r;
  const situacao = !r.encontrado ? "nao_encontrado" : r.oculto ? "oculto" : "ok";
  await env.DB.prepare(
    "UPDATE parceiros SET yt_situacao = ?, yt_inscritos = ?, yt_videos = ?, yt_views = ?, yt_conferido_em = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?"
  ).bind(situacao, r.inscritos || 0, r.videos || 0, r.views || 0, id).run();
  return r;
}
