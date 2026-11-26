// Mercado Pago simulado (Checkout Pro): cria o checkout, mostra uma página de pagamento falsa (aprovar ou recusar,
// como os cartões de teste "APRO" e "OTHE" do Mercado Pago) e responde à busca do pagamento pela referência.
// Só para testes: nenhum cartão de verdade, nenhuma chamada sai daqui.
//
//   POST /checkout/preferences                 (Bearer TOKEN)  -> { id, init_point }
//   GET  /checkout?pref=<id>                   página de pagamento
//   POST /checkout/pagar                       resultado = aprovado | recusado -> volta para back_urls
//   GET  /v1/payments/search?external_reference=<ref>   (Bearer TOKEN)
//   GET  /v1/payments/<id>                     (Bearer TOKEN) um pagamento (o webhook só manda o id)
//   GET  /simulador                            lista checkouts e pagamentos
//
// Uso direto: node tests/apoio/mercadopago.mjs [porta]   (padrão 8895)
// e suba a Tardim com --binding MP_API_URL=http://127.0.0.1:8895 --binding MP_ACCESS_TOKEN=TEST-tardim-simulado

import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

export const TOKEN = "TEST-tardim-simulado";
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const reais = (n) => "R$ " + Number(n).toFixed(2).replace(".", ",");

export function sobeMercadoPago(porta = 8895) {
  const prefs = new Map();
  const pagamentos = [];
  let seq = 1000;
  const base = "http://127.0.0.1:" + porta;
  const resp = (res, status, corpo) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(corpo)); };
  const lerCorpo = (req) => new Promise((ok) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => ok(d)); });
  const autorizado = (req) => String(req.headers.authorization || "") === "Bearer " + TOKEN;
  const html = (res, corpo) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mercado Pago simulado</title>
      <style>body{font:15px system-ui;margin:0;background:#f5f5f5;color:#333}header{background:#ffe600;padding:14px 20px;font-weight:700}
      main{max-width:520px;margin:24px auto;background:#fff;border-radius:10px;padding:20px;box-shadow:0 1px 4px #0002}
      label{display:block;margin:10px 0 4px;font-size:13px;color:#666}input,select{width:100%;padding:9px;border:1px solid #ccc;border-radius:6px;box-sizing:border-box}
      .bt{display:flex;gap:10px;margin-top:18px}button{flex:1;border:0;border-radius:6px;padding:12px;font-size:15px;cursor:pointer;color:#fff}
      .ok{background:#009ee3}.nao{background:#999}.aviso{background:#fff4d6;padding:10px;border-radius:8px;font-size:13px}
      table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #eee;padding:6px;text-align:left;font-size:13px}</style>
      <header>Mercado Pago · SIMULADO</header><main>${corpo}</main>`);
  };

  const servidor = createServer(async (req, res) => {
    const url = new URL(req.url, base);
    const corpo = await lerCorpo(req);

    if (req.method === "POST" && url.pathname === "/checkout/preferences") {
      if (!autorizado(req)) return resp(res, 401, { message: "invalid access token" });
      let d;
      try { d = JSON.parse(corpo); } catch (e) { return resp(res, 400, { message: "invalid json" }); }
      const item = d.items && d.items[0];
      if (!item || !(item.unit_price > 0) || !d.external_reference || !d.back_urls || !d.back_urls.success) {
        return resp(res, 400, { message: "items[0].unit_price, external_reference e back_urls são obrigatórios" });
      }
      const id = "pref-" + (++seq);
      prefs.set(id, { id, d, criado: new Date().toISOString() });
      return resp(res, 201, { id, init_point: base + "/checkout?pref=" + id, sandbox_init_point: base + "/checkout?pref=" + id, external_reference: d.external_reference });
    }

    if (req.method === "GET" && url.pathname === "/checkout") {
      const p = prefs.get(url.searchParams.get("pref") || "");
      if (!p) return html(res, "<p>Checkout não encontrado.</p>");
      const item = p.d.items[0];
      const max = (p.d.payment_methods && p.d.payment_methods.installments) || 1;
      const opcoes = Array.from({ length: max }, (_, i) => i + 1).map((n) => {
        const total = n === 1 ? item.unit_price : item.unit_price * (1 + 0.0299 * n); // juros de exemplo, pagos por quem compra
        return `<option value="${n}">${n}x de ${reais(total / n)}${n > 1 ? " (total " + reais(total) + ")" : " sem juros"}</option>`;
      }).join("");
      return html(res, `<p class="aviso">Página de testes: nenhum cartão de verdade. Escolha aprovar ou recusar.</p>
        <h2 style="margin:12px 0 4px">${esc(item.title)}</h2><p style="font-size:22px;margin:0 0 10px"><b>${reais(item.unit_price)}</b></p>
        <form method="post" action="/checkout/pagar"><input type="hidden" name="pref" value="${esc(p.id)}">
        <label>Número do cartão</label><input value="5031 4332 1540 6351" readonly>
        <label>Nome no cartão</label><input name="nome" value="APRO">
        <label>Parcelas</label><select name="parcelas">${opcoes}</select>
        <div class="bt"><button class="ok" name="resultado" value="aprovado">Pagar (aprovar)</button>
        <button class="nao" name="resultado" value="recusado">Pagar (recusar)</button></div></form>`);
    }

    if (req.method === "POST" && url.pathname === "/checkout/pagar") {
      const f = new URLSearchParams(corpo);
      const p = prefs.get(f.get("pref") || "");
      if (!p) return html(res, "<p>Checkout não encontrado.</p>");
      const aprovado = f.get("resultado") === "aprovado" && (f.get("nome") || "APRO").toUpperCase() !== "OTHE";
      const pg = {
        id: ++seq, status: aprovado ? "approved" : "rejected", status_detail: aprovado ? "accredited" : "cc_rejected_other_reason",
        external_reference: p.d.external_reference, transaction_amount: p.d.items[0].unit_price, installments: Number(f.get("parcelas")) || 1,
        payment_type_id: "credit_card", date_created: new Date().toISOString(), date_approved: aprovado ? new Date().toISOString() : null,
      };
      pagamentos.push(pg);
      const volta = new URL(aprovado ? p.d.back_urls.success : p.d.back_urls.failure);
      for (const [k, v] of Object.entries({ collection_id: pg.id, collection_status: pg.status, payment_id: pg.id, status: pg.status,
        external_reference: pg.external_reference, payment_type: "credit_card", preference_id: p.id })) volta.searchParams.set(k, String(v));
      res.writeHead(303, { location: volta.toString() });
      return res.end();
    }

    const mPg = /^\/v1\/payments\/(\d+)$/.exec(url.pathname);
    if (req.method === "GET" && mPg) {
      if (!autorizado(req)) return resp(res, 401, { message: "invalid access token" });
      const pg = pagamentos.find((p) => String(p.id) === mPg[1]);
      return pg ? resp(res, 200, pg) : resp(res, 404, { message: "Payment not found" });
    }
    if (req.method === "GET" && url.pathname === "/v1/payments/search") {
      if (!autorizado(req)) return resp(res, 401, { message: "invalid access token" });
      const ref = url.searchParams.get("external_reference");
      const results = pagamentos.filter((p) => p.external_reference === ref).slice().reverse();
      return resp(res, 200, { results, paging: { total: results.length } });
    }

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/simulador")) {
      const linhas = [...prefs.values()].reverse().map((p) => {
        const pgs = pagamentos.filter((x) => x.external_reference === p.d.external_reference).map((x) => x.status).join(", ") || "sem pagamento";
        return `<tr><td>${esc(new Date(p.criado).toLocaleTimeString("pt-BR"))}</td><td>${esc(p.d.items[0].title)}</td><td>${reais(p.d.items[0].unit_price)}</td>
          <td>${esc(pgs)}</td><td><a href="/checkout?pref=${esc(p.id)}">abrir</a></td></tr>`;
      }).join("");
      return html(res, `<h2>Checkouts criados</h2><table><tr><th>Criado</th><th>Item</th><th>Valor</th><th>Pagamentos</th><th></th></tr>${linhas || '<tr><td colspan="5">Nenhum ainda.</td></tr>'}</table>`);
    }
    resp(res, 404, { message: "not found" });
  });
  // Porta ocupada (outro simulador rodando): falha na hora em vez de travar
  return new Promise((ok, erro) => servidor.once("error", erro).listen(porta, "127.0.0.1", () => ok({ porta, prefs, pagamentos, base, fecha: () => new Promise((f) => servidor.close(f)) })));
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const porta = Number(process.argv[2]) || 8895;
  await sobeMercadoPago(porta);
  console.log("Mercado Pago simulado em http://127.0.0.1:" + porta + "  (token: " + TOKEN + ")");
}
