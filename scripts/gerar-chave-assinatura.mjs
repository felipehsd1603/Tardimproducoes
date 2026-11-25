// Gera a chave privada que assina os convites de conexão da API v1 (ES256).
// Uso (uma vez; a saída NÃO vai para o repositório):
//   node scripts/gerar-chave-assinatura.mjs | npx wrangler pages secret put TARDIM_ASSINATURA_JWK --project-name tardim-teste
// Para o servidor local, cole a linha em .dev.vars como TARDIM_ASSINATURA_JWK='...'.
// Trocar a chave invalida só os convites ainda não respondidos.

const par = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const jwk = await crypto.subtle.exportKey("jwk", par.privateKey);
const hoje = new Date().toISOString().slice(0, 7);
const sufixo = Math.random().toString(36).slice(2, 6);
process.stdout.write(JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d, kid: "tdm-" + hoje + "-" + sufixo }));
