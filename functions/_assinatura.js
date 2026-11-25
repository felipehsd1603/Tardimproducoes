// Assinatura dos convites de conexão (JWS compacto ES256, docs/api-v1-parceiros.md).
// Segredo TARDIM_ASSINATURA_JWK = chave privada P-256 em JWK (gerada por
// scripts/gerar-chave-assinatura.mjs). A parte pública sai em GET /api/v1/chaves-publicas.

const enc = new TextEncoder();

const b64url = (bytes) => {
  let s = "";
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const b64urlTexto = (t) => b64url(enc.encode(t));

function jwkPrivada(env) {
  if (!env.TARDIM_ASSINATURA_JWK) return null;
  try {
    const j = JSON.parse(env.TARDIM_ASSINATURA_JWK);
    return j && j.kty === "EC" && j.crv === "P-256" && j.d && j.kid ? j : null;
  } catch (e) { return null; }
}

export function assinaturaConfigurada(env) { return !!jwkPrivada(env); }

// JWKS público (sem o "d")
export function chavesPublicas(env) {
  const j = jwkPrivada(env);
  if (!j) return { keys: [] };
  return { keys: [{ kty: "EC", crv: "P-256", x: j.x, y: j.y, kid: j.kid, alg: "ES256", use: "sig" }] };
}

export async function assinaJws(env, conteudo, typ) {
  const j = jwkPrivada(env);
  if (!j) throw new Error("Falta o segredo TARDIM_ASSINATURA_JWK.");
  const chave = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: j.x, y: j.y, d: j.d, ext: true },
    { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const cab = b64urlTexto(JSON.stringify({ alg: "ES256", kid: j.kid, typ: typ || "JWT" }));
  const corpo = b64urlTexto(JSON.stringify(conteudo));
  // WebCrypto devolve r||s (64 bytes), que é o formato do JWS
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, chave, enc.encode(cab + "." + corpo)));
  return cab + "." + corpo + "." + b64url(sig);
}
