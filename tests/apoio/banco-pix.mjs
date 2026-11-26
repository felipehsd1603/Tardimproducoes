// Banco PIX simulado: responde como a API PIX padrão do Banco Central no formato do Banco Inter
// (POST /oauth/v2/token, PUT e GET /pix/v2/cob/{txid}) para testar o pagamento pelo site sem banco de verdade.
//
// Só para testes: nenhuma chamada sai daqui, e o "PIX copia e cola" usa uma chave inexistente.
//   POST /simulador/pagar/{txid}   { valor? }   marca a cobrança como paga (valor menor = pagamento a menos)
//   POST /simulador/remover/{txid}              a cobrança vence (REMOVIDA_PELO_PSP)
//   GET  /simulador/cobrancas                   lista o que foi criado
//
// Uso direto (servidor local):  node tests/apoio/banco-pix.mjs [porta]   (padrão 8897)
// e suba a Tardim com --binding PIX_API_URL=http://127.0.0.1:8897/pix/v2 PIX_CLIENT_ID=teste PIX_CLIENT_SECRET=teste PIX_CHAVE=pix@tardim.test

import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";

export const CLIENTE = { id: "teste", segredo: "teste" };

function crc16(s) {
  let crc = 0xffff;
  for (const b of Buffer.from(s, "utf8")) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
const campo = (id, v) => id + String(v.length).padStart(2, "0") + v;
// BR Code no formato do PIX dinâmico (aponta para um endereço que não existe)
function copiaECola(txid, valor) {
  const conta = campo("00", "br.gov.bcb.pix") + campo("25", "pix.banco-simulado.test/qr/v2/" + txid);
  const s = campo("00", "01") + campo("01", "12") + campo("26", conta) + campo("52", "0000") + campo("53", "986") +
    campo("54", valor) + campo("58", "BR") + campo("59", "TARDIM PRODUCOES TESTE") + campo("60", "BELO HORIZONTE") +
    campo("62", campo("05", "***")) + "6304";
  return s + crc16(s);
}

export function sobeBancoPix(porta = 8897) {
  const tokens = new Set();
  const cobs = new Map();
  const resp = (res, status, corpo) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(corpo)); };
  const lerCorpo = (req) => new Promise((ok) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => ok(d)); });
  const situacao = (c) => {
    if (c.status === "ATIVA" && Date.now() > c.criadoMs + c.calendario.expiracao * 1000) c.status = "REMOVIDA_PELO_PSP";
    return c;
  };
  const visivel = (c) => { const o = Object.assign({}, situacao(c)); delete o.criadoMs; return o; };

  const servidor = createServer(async (req, res) => {
    const url = new URL(req.url, "http://banco");
    const corpo = await lerCorpo(req);
    if (req.method === "POST" && url.pathname === "/oauth/v2/token") {
      const f = new URLSearchParams(corpo);
      if (f.get("client_id") !== CLIENTE.id || f.get("client_secret") !== CLIENTE.segredo || f.get("grant_type") !== "client_credentials") {
        return resp(res, 401, { title: "Credenciais inválidas" });
      }
      const t = randomBytes(16).toString("hex");
      tokens.add(t);
      return resp(res, 200, { access_token: t, token_type: "Bearer", expires_in: 3600, scope: f.get("scope") || "" });
    }
    let m = /^\/pix\/v2\/cob\/([a-zA-Z0-9]{26,35})$/.exec(url.pathname);
    if (m) {
      if (!tokens.has(String(req.headers.authorization || "").replace(/^Bearer /, ""))) return resp(res, 401, { title: "Não autorizado" });
      const txid = m[1];
      if (req.method === "PUT") {
        let d;
        try { d = JSON.parse(corpo); } catch (e) { return resp(res, 400, { title: "JSON inválido" }); }
        if (!d.valor || !/^\d+\.\d{2}$/.test(d.valor.original || "") || !d.chave || !d.calendario || !d.calendario.expiracao) {
          return resp(res, 400, { title: "Cobrança inválida", detail: "valor.original, chave e calendario.expiracao são obrigatórios" });
        }
        if (cobs.has(txid)) return resp(res, 400, { title: "txid já usado" });
        const c = {
          calendario: { criacao: new Date().toISOString(), expiracao: d.calendario.expiracao }, txid, revisao: 0, status: "ATIVA",
          devedor: d.devedor, valor: d.valor, chave: d.chave, solicitacaoPagador: d.solicitacaoPagador || "",
          pixCopiaECola: copiaECola(txid, d.valor.original), criadoMs: Date.now(),
        };
        cobs.set(txid, c);
        return resp(res, 201, visivel(c));
      }
      if (req.method === "GET") {
        const c = cobs.get(txid);
        return c ? resp(res, 200, visivel(c)) : resp(res, 404, { title: "Cobrança não encontrada" });
      }
    }
    m = /^\/simulador\/(pagar|remover)\/([a-zA-Z0-9]{26,35})$/.exec(url.pathname);
    if (m && req.method === "POST") {
      const c = cobs.get(m[2]);
      if (!c) return resp(res, 404, { title: "Cobrança não encontrada" });
      situacao(c);
      const volta = url.searchParams.get("voltar") ? () => { res.writeHead(303, { location: "/simulador" }); res.end(); } : null;
      if (m[1] === "remover") { c.status = "REMOVIDA_PELO_PSP"; return volta ? volta() : resp(res, 200, visivel(c)); }
      if (c.status !== "ATIVA") return volta ? volta() : resp(res, 400, { title: "Cobrança não está ativa: " + c.status });
      let valor = c.valor.original;
      try { const d = JSON.parse(corpo || "{}"); if (d.valor) valor = Number(d.valor).toFixed(2); } catch (e) { /* valor cheio (ou formulário) */ }
      c.status = "CONCLUIDA";
      c.pix = [{ endToEndId: "E00000000" + Date.now() + randomBytes(4).toString("hex"), txid: c.txid, valor, horario: new Date().toISOString() }];
      return volta ? volta() : resp(res, 200, visivel(c));
    }
    if (req.method === "GET" && url.pathname === "/simulador/cobrancas") return resp(res, 200, [...cobs.values()].map(visivel));
    // Página para testar com o navegador: lista os PIX e paga com um clique
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/simulador")) {
      const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
      const linhas = [...cobs.values()].reverse().map((c0) => {
        const c = visivel(c0);
        const acao = c.status === "ATIVA"
          ? `<form method="post" action="/simulador/pagar/${c.txid}?voltar=1"><button>Pagar R$ ${esc(c.valor.original)}</button></form>
             <form method="post" action="/simulador/remover/${c.txid}?voltar=1"><button class="sec">Vencer</button></form>`
          : "";
        return `<tr><td>${esc(new Date(c.calendario.criacao).toLocaleTimeString("pt-BR"))}</td><td>${esc(c.devedor && c.devedor.nome)}</td>
          <td>${esc(c.solicitacaoPagador)}</td><td>R$ ${esc(c.valor.original)}</td><td><b>${esc(c.status)}</b></td><td class="ac">${acao}</td></tr>`;
      }).join("");
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(`<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="5"><title>Banco PIX simulado</title>
        <style>body{font:15px system-ui;margin:24px;color:#1c2233}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left}
        .ac{display:flex;gap:8px}button{background:#0a7d3b;color:#fff;border:0;border-radius:6px;padding:8px 12px;cursor:pointer}button.sec{background:#888}
        .aviso{background:#fff4d6;padding:10px 14px;border-radius:8px}</style>
        <h1>Banco PIX simulado</h1><p class="aviso">Só para testes: nenhum dinheiro de verdade. A página se atualiza sozinha a cada 5 segundos.</p>
        <table><tr><th>Criado</th><th>Pagador</th><th>Descrição</th><th>Valor</th><th>Situação</th><th></th></tr>${linhas || '<tr><td colspan="6">Nenhum PIX criado ainda.</td></tr>'}</table>`);
    }
    resp(res, 404, { title: "Rota não encontrada" });
  });
  // Porta ocupada (outro simulador rodando): falha na hora em vez de travar
  return new Promise((ok, erro) => servidor.once("error", erro).listen(porta, "127.0.0.1", () => ok({ porta, cobs, fecha: () => new Promise((f) => servidor.close(f)) })));
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const porta = Number(process.argv[2]) || 8897;
  await sobeBancoPix(porta);
  console.log("Banco PIX simulado em http://127.0.0.1:" + porta + "  (cliente: teste / teste)");
}
