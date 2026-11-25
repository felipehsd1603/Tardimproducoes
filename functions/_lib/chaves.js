// Chaves da API v1 para parceiros (docs/api-v1-parceiros.md). A chave nasce no aceite da conexão
// e vai direto para o servidor da plataforma; o banco guarda só o SHA-256 dela (tabela integracoes).
// O segredo do webhook assina os avisos (HMAC-SHA256).

import { aleatorioHex, sha256 } from "./http.js";

export { sha256 };

// tdm_live_<48 hex> ou tdm_test_<48 hex>
export function novaChave(ambiente) {
  const chave = "tdm_" + (ambiente === "test" ? "test" : "live") + "_" + aleatorioHex(24);
  return { chave, prefixo: chave.slice(0, 13) };
}

export const novoSegredo = () => "whsec_" + aleatorioHex(32);
export const novoCodigo = () => aleatorioHex(32);

export const RE_CHAVE = /^tdm_(live|test)_[0-9a-f]{48}$/;
