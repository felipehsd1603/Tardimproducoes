// Cobrança PIX pela API PIX padrão do Banco Central (cobrança imediata: PUT/GET {PIX_API_URL}/cob/{txid}).
// Banco Inter:
//   PIX_API_URL   = https://cdpj.partners.bancointer.com.br/pix/v2        (testes: https://cdpj-sandbox.partners.uatinter.co/pix/v2)
//   PIX_TOKEN_URL = https://cdpj.partners.bancointer.com.br/oauth/v2/token (testes: https://cdpj-sandbox.partners.uatinter.co/oauth/v2/token)
// Segredos: PIX_CLIENT_ID, PIX_CLIENT_SECRET, PIX_CHAVE (chave PIX que recebe). Opcionais: PIX_ESCOPO
// (padrão "cob.write cob.read"), PIX_CONTA (cabeçalho x-conta-corrente do Inter, quando a empresa tem mais de uma conta).
// O banco exige certificado na conexão (mTLS): o binding PIX_CERT (certificado enviado à Cloudflare) faz as chamadas.
// Sem PIX_CERT (servidor local e testes), usa o fetch comum, contra o banco simulado (tests/apoio/banco-pix.mjs).

import type { Env, Dados } from "./tipos.ts";

export class ErroPix extends Error {
  status: number;
  constructor(message: string, status?: number) { super(message); this.status = status || 502; }
}

export const pixConfigurado = (env: Env): boolean => !!(env.PIX_API_URL && env.PIX_CLIENT_ID && env.PIX_CLIENT_SECRET && env.PIX_CHAVE);

const chama = (env: Env, url: string, opcoes: RequestInit): Promise<Response> => (env.PIX_CERT ? env.PIX_CERT.fetch(url, opcoes) : fetch(url, opcoes));
const tokenUrl = (env: Env): string => env.PIX_TOKEN_URL || (env.PIX_API_URL as string).replace(/\/pix\/v\d+\/?$/, "") + "/oauth/v2/token";

// Token OAuth guardado na memória do servidor até perto de vencer
let token: { chave: string; valor: string; vence: number } | null = null;
async function acesso(env: Env): Promise<string> {
  if (token && token.chave === env.PIX_CLIENT_ID + tokenUrl(env) && token.vence > Date.now() + 30000) return token.valor;
  const corpo = new URLSearchParams({
    client_id: env.PIX_CLIENT_ID as string, client_secret: env.PIX_CLIENT_SECRET as string,
    grant_type: "client_credentials", scope: env.PIX_ESCOPO || "cob.write cob.read",
  });
  const r = await chama(env, tokenUrl(env), { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: corpo.toString() })
    .catch(() => null);
  const j = r ? await r.json<Dados>().catch(() => null) : null;
  if (!r || !r.ok || !j || !j.access_token) throw new ErroPix("O banco não autorizou o acesso à API PIX (" + (r ? r.status : "sem resposta") + ").");
  token = { chave: env.PIX_CLIENT_ID + tokenUrl(env), valor: j.access_token, vence: Date.now() + (Number(j.expires_in) || 300) * 1000 };
  return token.valor;
}

async function api(env: Env, metodo: string, caminho: string, dados?: unknown): Promise<Dados> {
  const cab: Record<string, string> = { authorization: "Bearer " + (await acesso(env)), "content-type": "application/json" };
  if (env.PIX_CONTA) cab["x-conta-corrente"] = env.PIX_CONTA;
  const r = await chama(env, (env.PIX_API_URL as string).replace(/\/$/, "") + caminho, { method: metodo, headers: cab, body: dados ? JSON.stringify(dados) : undefined })
    .catch(() => null);
  const j = r ? await r.json<Dados>().catch(() => null) : null;
  if (!r || !r.ok || !j) {
    if (r && r.status === 401) token = null;
    throw new ErroPix("O banco recusou a cobrança PIX (" + (r ? r.status : "sem resposta") + (j && (j.detail || j.title) ? ": " + (j.detail || j.title) : "") + ").");
  }
  return j;
}

/** Cria a cobrança imediata. txid: 26 a 35 letras e números. Devolve { status, copiaECola }. Sem cpf, a cobrança sai sem devedor. */
export interface PedidoCobranca { txid: string; centavos: number; expiracao: number; cpf?: string; nome?: string; descricao?: string }

export async function criaCobranca(env: Env, { txid, centavos, expiracao, cpf, nome, descricao }: PedidoCobranca): Promise<{ status: string; copiaECola: string }> {
  const j = await api(env, "PUT", "/cob/" + txid, {
    calendario: { expiracao },
    ...(cpf && nome ? { devedor: { cpf, nome: nome.slice(0, 200) } } : {}),
    valor: { original: (centavos / 100).toFixed(2) },
    chave: env.PIX_CHAVE,
    solicitacaoPagador: (descricao || "").slice(0, 140),
  });
  if (!j.pixCopiaECola) throw new ErroPix("O banco criou a cobrança, mas não devolveu o código PIX.");
  return { status: j.status, copiaECola: j.pixCopiaECola };
}

/** Situação da cobrança: { status, pago, centavos (valor recebido), e2e, horario }. */
export interface Cobranca { status: string; pago: boolean; centavos: number; e2e: string; horario: string }

export async function consultaCobranca(env: Env, txid: string): Promise<Cobranca> {
  const j = await api(env, "GET", "/cob/" + txid);
  const pix = Array.isArray(j.pix) ? j.pix : [];
  const centavos = pix.reduce((s: number, p: Dados) => s + Math.round(Number(p.valor || 0) * 100), 0);
  return { status: j.status, pago: j.status === "CONCLUIDA" && pix.length > 0, centavos, e2e: (pix[0] && pix[0].endToEndId) || "", horario: (pix[0] && pix[0].horario) || "" };
}
