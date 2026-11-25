// Consulta de perfis do Instagram pela API oficial da Meta (Business Discovery).
//
// A conta profissional configurada em IG_USER_ID (hoje a do Felipe; pode virar a
// @tardimproducoes trocando os dois segredos) consulta os dados públicos de
// outra conta profissional (Comercial ou Criador de conteúdo): seguidores e número
// de posts. Conta pessoal, inexistente ou com o @ errado volta como não encontrada.
// O influenciador não precisa fazer nada. A API é gratuita.
//
// Segredos do projeto (nunca em arquivo do repositório):
//   IG_USER_ID  id, na API, da conta do Instagram que faz a consulta (número, ex.: 17841400000000000)
//   IG_TOKEN    token de acesso que não expira (usuário do sistema do Gerenciador de Negócios)
//               com as permissões instagram_basic, instagram_manage_insights, pages_show_list e pages_read_engagement
//
// Uso (numa Function):  import { consultaInstagram } from "../../_instagram.js";
//   const r = await consultaInstagram(env, "@perfil");
//   r = { ok: true, encontrado: true, usuario, nome, seguidores, posts }
//     | { ok: true, encontrado: false, usuario }
//     | { ok: false, erro: "config" | "usuario" | "token" | "indisponivel" }

const VERSAO = "v23.0";

// "@Perfil", "instagram.com/perfil/", "perfil" -> "perfil"
export function usuarioInstagram(texto) {
  const u = String(texto == null ? "" : texto).trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "").toLowerCase();
  return /^[\w.]{1,30}$/.test(u) ? u : "";
}

export async function consultaInstagram(env, texto) {
  if (!env.IG_USER_ID || !env.IG_TOKEN) return { ok: false, erro: "config" };
  const usuario = usuarioInstagram(texto);
  if (!usuario) return { ok: false, erro: "usuario" };
  const campos = "business_discovery.username(" + usuario + "){username,name,followers_count,media_count}";
  let r, d;
  try {
    // token no cabeçalho, para não aparecer em logs de URL
    r = await fetch("https://graph.facebook.com/" + VERSAO + "/" + encodeURIComponent(env.IG_USER_ID) + "?fields=" + encodeURIComponent(campos), {
      headers: { authorization: "Bearer " + env.IG_TOKEN },
    });
    d = await r.json();
  } catch (e) {
    return { ok: false, erro: "indisponivel" };
  }
  if (d && d.error) {
    // 110 / 2207013: não existe ou não é conta profissional
    if (d.error.code === 110 || d.error.error_subcode === 2207013) return { ok: true, encontrado: false, usuario };
    if (d.error.code === 190) return { ok: false, erro: "token" };
    return { ok: false, erro: "indisponivel" };
  }
  const b = d && d.business_discovery;
  if (!r.ok || !b) return { ok: false, erro: "indisponivel" };
  return {
    ok: true, encontrado: true, usuario: String(b.username || usuario).toLowerCase(), nome: String(b.name || ""),
    seguidores: Number(b.followers_count) || 0, posts: Number(b.media_count) || 0,
  };
}

// Consulta e grava no parceiro (colunas ig_*). Falha de configuração/rede não grava nada.
export async function confereInstagramParceiro(env, id) {
  const p = await env.DB.prepare("SELECT instagram FROM parceiros WHERE id = ?").bind(id).first();
  if (!p) return null;
  const r = await consultaInstagram(env, p.instagram);
  if (!r.ok) return r;
  await env.DB.prepare(
    "UPDATE parceiros SET ig_situacao = ?, ig_seguidores = ?, ig_posts = ?, ig_conferido_em = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?"
  ).bind(r.encontrado ? "ok" : "nao_encontrado", r.seguidores || 0, r.posts || 0, id).run();
  return r;
}
