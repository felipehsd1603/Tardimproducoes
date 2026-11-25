// Peças comuns da API v1: o erro padrão ({ erro: { codigo, mensagem } }), a leitura do corpo
// e o limite de uso por minuto (tabela api_uso).

import type { Env, Dados } from "../_lib/tipos.ts";

export class ErroApi extends Error {
  status: number;
  codigo: string;
  extra?: Record<string, string>;
  /** @param {number} status @param {string} codigo @param {string} mensagem @param {Record<string,string>} [extra] cabeçalhos */
  constructor(status: number, codigo: string, mensagem: string, extra?: Record<string, string>) { super(mensagem); this.status = status; this.codigo = codigo; this.extra = extra; }
}

export const LIMITE_MINUTO = 120;       // chamadas por minuto por chave
export const LIMITE_CONEXAO_IP = 20;    // aceitar/recusar conexão por IP por minuto

/** Corpo JSON (objeto) de até 20 kB; vazio = {} */
export async function corpoJson(request: Request): Promise<Dados> {
  const t = await request.text();
  if (t.length > 20000) throw new ErroApi(413, "json_invalido", "Corpo grande demais.");
  if (!t.trim()) return {};
  try { const d = JSON.parse(t); if (d && typeof d === "object" && !Array.isArray(d)) return d; } catch (e) { /* cai abaixo */ }
  throw new ErroApi(400, "json_invalido", "JSON inválido.");
}

export const texto = (v: unknown, max: number): string => String(v == null ? "" : v).trim().slice(0, max);

/** Conta uma chamada no minuto atual; passou do limite = 429 com retry-after. "dono" = id da integração ou "ip:<ip>" */
export async function contaUso(env: Env, dono: string, limite: number): Promise<number> {
  const agora = Math.floor(Date.now() / 1000);
  const uso = await env.DB.prepare(
    "INSERT INTO api_uso (integracao_id, minuto, n) VALUES (?, ?, 1) ON CONFLICT (integracao_id, minuto) DO UPDATE SET n = n + 1 RETURNING n"
  ).bind(dono, Math.floor(agora / 60)).first<{ n: number }>();
  if (uso && uso.n > limite) {
    throw new ErroApi(429, "limite_de_uso", "Limite de " + limite + " chamadas por minuto.", { "retry-after": String(60 - (agora % 60)) });
  }
  return agora;
}
