// Utilitários compartilhados por todas as Functions: resposta JSON, origem da chamada,
// codificação, HMAC/SHA-256, comparação em tempo constante e validação de CPF.
// Cada área mantém o próprio formato de erro (ver docs/arquitetura.md).

export const enc = new TextEncoder();

/** Resposta JSON sem cache. `extra` = cabeçalhos a mais (set-cookie, retry-after...). */
export function json(corpo, status, extra) {
  return new Response(JSON.stringify(corpo), {
    status: status || 200,
    headers: Object.assign({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }, extra || {}),
  });
}

/** A chamada veio de uma página do próprio site? (cabeçalho Origin com o mesmo host) */
export function mesmaOrigem(request) {
  try { return new URL(request.headers.get("Origin")).host === new URL(request.url).host; } catch (e) { return false; }
}

export function b64url(bytes) {
  let b = "";
  for (const x of bytes) b += String.fromCharCode(x);
  return btoa(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function deB64url(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
export function hex(bytes) {
  let h = "";
  for (const x of bytes) h += x.toString(16).padStart(2, "0");
  return h;
}
export const aleatorioHex = (bytes) => hex(crypto.getRandomValues(new Uint8Array(bytes)));

async function hmacBytes(segredo, msg) {
  const k = await crypto.subtle.importKey("raw", enc.encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(msg)));
}
/** HMAC-SHA256 em base64url (cookies de sessão) */
export const hmacB64url = async (segredo, msg) => b64url(await hmacBytes(segredo, msg));
/** HMAC-SHA256 em hex (assinatura dos avisos às plataformas) */
export const hmacHex = async (segredo, msg) => hex(await hmacBytes(segredo, msg));
/** SHA-256 em hex (o que o banco guarda das chaves e códigos) */
export const sha256 = async (texto) => hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(texto))));

/** Compara dois textos em tempo constante (assinaturas, senhas já derivadas) */
export function iguais(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** CPF só com dígitos e dígitos verificadores corretos */
export function cpfValido(d) {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  for (let t = 9; t < 11; t++) {
    let s = 0;
    for (let i = 0; i < t; i++) s += Number(d[i]) * (t + 1 - i);
    if ((s * 10) % 11 % 10 !== Number(d[t])) return false;
  }
  return true;
}
