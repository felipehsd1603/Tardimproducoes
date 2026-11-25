// Chaves da API v1 para parceiros (docs/api-v1-parceiros.md).
// A chave aparece uma vez, na criação; o banco guarda só o SHA-256 dela
// (tabela integracoes). O segredo do webhook assina os avisos (etapa 2).

const enc = new TextEncoder();

function aleatorio(bytes) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  let s = "";
  for (const x of b) s += x.toString(16).padStart(2, "0");
  return s;
}

export async function sha256(texto) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(texto)));
  let s = "";
  for (const x of h) s += x.toString(16).padStart(2, "0");
  return s;
}

// tdm_live_<48 hex> ou tdm_test_<48 hex>
export function novaChave(ambiente) {
  const chave = "tdm_" + (ambiente === "test" ? "test" : "live") + "_" + aleatorio(24);
  return { chave, prefixo: chave.slice(0, 13) };
}

export function novoSegredo() {
  return "whsec_" + aleatorio(32);
}

export const RE_CHAVE = /^tdm_(live|test)_[0-9a-f]{48}$/;
