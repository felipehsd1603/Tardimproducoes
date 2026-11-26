// Cartão de crédito pelo Mercado Pago (Checkout Pro): a pessoa paga na página do Mercado Pago (o cartão nunca passa
// pela Tardim) e volta para o site. A confirmação vem sempre da busca do pagamento pela referência (id do pedido), nunca
// do que chega no endereço de volta ou no webhook: na tela de volta, no webhook e no botão "Conferir" do painel.
// Segredos: MP_ACCESS_TOKEN (credencial de teste "TEST-..." ou de produção "APP_USR-...").
// Opcionais: MP_API_URL (padrão https://api.mercadopago.com; nos testes, o simulador tests/apoio/mercadopago.mjs),
// MP_SANDBOX = "1" (usa a página de testes), MP_WEBHOOK_SEGREDO (confere a assinatura x-signature dos webhooks).

import { hmacHex, iguais } from "./http.ts";
import type { Env, Dados } from "./tipos.ts";

export class ErroMp extends Error {
  constructor(message: string) { super(message); }
}

export const mpConfigurado = (env: Env): boolean => !!env.MP_ACCESS_TOKEN;
const base = (env: Env): string => (env.MP_API_URL || "https://api.mercadopago.com").replace(/\/$/, "");

async function api(env: Env, metodo: string, caminho: string, dados?: unknown, idem?: string): Promise<Dados> {
  const cab: Record<string, string> = { authorization: "Bearer " + env.MP_ACCESS_TOKEN, "content-type": "application/json" };
  if (idem) cab["x-idempotency-key"] = idem;
  const r = await fetch(base(env) + caminho, { method: metodo, headers: cab, body: dados ? JSON.stringify(dados) : undefined }).catch(() => null);
  const j = r ? await r.json<Dados>().catch(() => null) : null;
  if (!r || !r.ok || !j) throw new ErroMp("O Mercado Pago recusou o pedido (" + (r ? r.status : "sem resposta") + (j && j.message ? ": " + j.message : "") + ").");
  return j;
}

/** Cria o checkout. Devolve { id, url } (a página de pagamento do Mercado Pago). */
export interface PedidoCheckout {
  referencia: string; centavos: number; titulo: string; email: string; nome: string; cpf?: string; parcelas: number; volta: string; expira: string;
  /** Endereço do webhook (notification_url); sem ele, a confirmação fica só na consulta. */
  aviso?: string;
}

export async function criaCheckout(env: Env, { referencia, centavos, titulo, email, nome, cpf, parcelas, volta, expira, aviso }: PedidoCheckout): Promise<{ id: string; url: string }> {
  const [primeiro, ...resto] = nome.split(" ");
  const j = await api(env, "POST", "/checkout/preferences", {
    items: [{ id: referencia, title: titulo.slice(0, 250), quantity: 1, currency_id: "BRL", unit_price: centavos / 100 }],
    payer: { email, name: primeiro, surname: resto.join(" "), ...(cpf ? { identification: { type: "CPF", number: cpf } } : {}) },
    external_reference: referencia,
    ...(aviso ? { notification_url: aviso } : {}),
    back_urls: { success: volta, failure: volta, pending: volta },
    auto_return: "approved",
    // Só cartão (o PIX da Tardim é pelo banco, sem tarifa)
    payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "bank_transfer" }, { id: "atm" }, { id: "digital_currency" }], installments: parcelas },
    statement_descriptor: "TARDIM",
    expires: true, expiration_date_to: expira,
  }, referencia);
  const url = env.MP_SANDBOX === "1" && j.sandbox_init_point ? j.sandbox_init_point : j.init_point;
  if (!url) throw new ErroMp("O Mercado Pago não devolveu a página de pagamento.");
  return { id: j.id, url };
}

/** Pagamento aprovado da referência, se houver: { aprovado, centavos, id }. */
export async function pagamentoDaReferencia(env: Env, referencia: string): Promise<{ aprovado: boolean; centavos?: number; id?: string }> {
  const j = await api(env, "GET", "/v1/payments/search?sort=date_created&criteria=desc&external_reference=" + encodeURIComponent(referencia));
  const lista = Array.isArray(j.results) ? j.results : [];
  const ok = lista.find((p: Dados) => p.status === "approved");
  return ok ? { aprovado: true, centavos: Math.round(Number(ok.transaction_amount || 0) * 100), id: String(ok.id) } : { aprovado: false };
}

/** Referência (external_reference) de um pagamento pelo id que o webhook mandou. null = não achou. */
export async function referenciaDoPagamento(env: Env, id: string): Promise<string | null> {
  if (!/^\d{1,30}$/.test(id)) return null;
  const j = await api(env, "GET", "/v1/payments/" + id).catch(() => null);
  return j && j.external_reference ? String(j.external_reference) : null;
}

/**
 * Assinatura do webhook (cabeçalho x-signature "ts=...,v1=..."): HMAC-SHA256 de "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 * com o segredo do painel do Mercado Pago. Sem MP_WEBHOOK_SEGREDO, não confere (o webhook só dispara uma consulta, nunca confirma sozinho).
 */
export async function assinaturaValida(env: Env, request: Request, dataId: string): Promise<boolean> {
  if (!env.MP_WEBHOOK_SEGREDO) return true;
  const partes: Record<string, string> = {};
  for (const p of (request.headers.get("x-signature") || "").split(",")) {
    const i = p.indexOf("=");
    if (i > 0) partes[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  }
  if (!partes.ts || !partes.v1) return false;
  const req = request.headers.get("x-request-id");
  const manifesto = "id:" + dataId.toLowerCase() + ";" + (req ? "request-id:" + req + ";" : "") + "ts:" + partes.ts + ";";
  return iguais(await hmacHex(env.MP_WEBHOOK_SEGREDO, manifesto), partes.v1);
}
