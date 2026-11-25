// Cartão de crédito pelo Mercado Pago (Checkout Pro): a pessoa paga na página do Mercado Pago (o cartão nunca passa
// pela Tardim) e volta para inscricao.html. A confirmação vem da busca do pagamento pela referência (id da inscrição),
// como no PIX: na tela de volta, nas visitas ao site e no botão "Conferir" do painel.
// Segredos: MP_ACCESS_TOKEN (credencial de teste "TEST-..." ou de produção "APP_USR-...").
// Opcionais: MP_API_URL (padrão https://api.mercadopago.com; nos testes, o simulador tests/apoio/mercadopago.mjs).

export class ErroMp extends Error {
  constructor(message) { super(message); }
}

export const mpConfigurado = (env) => !!env.MP_ACCESS_TOKEN;
const base = (env) => (env.MP_API_URL || "https://api.mercadopago.com").replace(/\/$/, "");

async function api(env, metodo, caminho, dados, idem) {
  const cab = { authorization: "Bearer " + env.MP_ACCESS_TOKEN, "content-type": "application/json" };
  if (idem) cab["x-idempotency-key"] = idem;
  const r = await fetch(base(env) + caminho, { method: metodo, headers: cab, body: dados ? JSON.stringify(dados) : undefined }).catch(() => null);
  const j = r ? await r.json().catch(() => null) : null;
  if (!r || !r.ok || !j) throw new ErroMp("O Mercado Pago recusou o pedido (" + (r ? r.status : "sem resposta") + (j && j.message ? ": " + j.message : "") + ").");
  return j;
}

/** Cria o checkout. Devolve { id, url } (a página de pagamento do Mercado Pago). */
export async function criaCheckout(env, { referencia, centavos, titulo, email, nome, cpf, parcelas, volta, expira }) {
  const [primeiro, ...resto] = nome.split(" ");
  const j = await api(env, "POST", "/checkout/preferences", {
    items: [{ id: referencia, title: titulo.slice(0, 250), quantity: 1, currency_id: "BRL", unit_price: centavos / 100 }],
    payer: { email, name: primeiro, surname: resto.join(" "), identification: { type: "CPF", number: cpf } },
    external_reference: referencia,
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
export async function pagamentoDaReferencia(env, referencia) {
  const j = await api(env, "GET", "/v1/payments/search?sort=date_created&criteria=desc&external_reference=" + encodeURIComponent(referencia));
  const lista = Array.isArray(j.results) ? j.results : [];
  const ok = lista.find((p) => p.status === "approved");
  return ok ? { aprovado: true, centavos: Math.round(Number(ok.transaction_amount || 0) * 100), id: String(ok.id) } : { aprovado: false };
}
