// Plataforma de assessoria falsa (como o IM3): recebe o convite de conexão e confere o JWS com a chave
// pública da Tardim, aceita/recusa, chama a API v1 com a chave e confere o HMAC de cada aviso.
import http from "node:http";
import crypto from "node:crypto";

const b64d = (s) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

export async function sobePlataforma(tardim, porta = 8898) {
  const aqui = `http://127.0.0.1:${porta}`;
  // falhar: quantos próximos avisos responder com 503 (para testar as novas tentativas)
  const estado = { convites: [], avisos: [], conexao: null, erros: [], falhar: 0 };

  async function confereJws(jws) {
    const [h, p, s] = jws.split(".");
    const cab = JSON.parse(b64d(h)), c = JSON.parse(b64d(p));
    if (cab.alg !== "ES256" || cab.typ !== "tardim-convite+jws") throw new Error("cabeçalho");
    if (c.iss !== tardim) throw new Error("iss");
    const jwks = await (await fetch(tardim + "/api/v1/chaves-publicas")).json();
    const jwk = jwks.keys.find((k) => k.kid === cab.kid);
    if (!jwk) throw new Error("kid");
    const ok = crypto.verify("sha256", Buffer.from(h + "." + p), { key: crypto.createPublicKey({ key: jwk, format: "jwk" }), dsaEncoding: "ieee-p1363" }, b64d(s));
    if (!ok) throw new Error("assinatura");
    if (c.aud !== aqui) throw new Error("aud");
    if (c.exp * 1000 < Date.now()) throw new Error("exp");
    if (!c.aceitar_url.startsWith(c.iss + "/") || !c.recusar_url.startsWith(c.iss + "/")) throw new Error("urls");
    return c;
  }

  const ler = (req) => new Promise((ok) => { let d = ""; req.on("data", (x) => (d += x)); req.on("end", () => ok(d)); });
  const srv = http.createServer(async (req, res) => {
    const fim = (st, o) => { res.writeHead(st, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    try {
      if (req.method === "POST" && req.url === "/api/integracoes/organizadoras/convites") {
        try { estado.convites.push(await confereJws(JSON.parse(await ler(req)).jws)); return fim(202, { recebido: true }); }
        catch (e) { estado.erros.push("convite: " + e.message); return fim(401, { erro: e.message }); }
      }
      if (req.method === "POST" && req.url === "/webhook") {
        const corpo = await ler(req);
        if (estado.falhar > 0) { estado.falhar--; return fim(503, { erro: "fora do ar (teste)" }); }
        const m = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(req.headers["x-tardim-assinatura"] || "");
        let hmac = "sem conexão";
        if (estado.conexao && m) {
          const esperado = crypto.createHmac("sha256", estado.conexao.webhook_segredo).update(m[1] + "." + corpo).digest("hex");
          hmac = crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(m[2])) && Math.abs(Date.now() / 1000 - Number(m[1])) < 300 ? "ok" : "assinatura";
        }
        estado.avisos.push({ evento: req.headers["x-tardim-evento"], entrega: req.headers["x-tardim-entrega"], hmac, corpo: JSON.parse(corpo) });
        return fim(hmac === "ok" ? 200 : 401, { ok: hmac === "ok" });
      }
      fim(404, { erro: "nao_encontrado" });
    } catch (e) { fim(500, { erro: String(e.message || e) }); }
  });
  await new Promise((ok) => srv.listen(porta, "127.0.0.1", ok));

  const ultimoConvite = () => estado.convites.at(-1);
  async function responde(acao, extra = {}) {
    const c = ultimoConvite();
    const corpo = acao === "aceitar"
      ? { codigo: c.codigo, plataforma: { nome: "Plataforma de teste", url: aqui }, webhook_url: aqui + "/webhook", aceito_por: "Teste", ...extra }
      : { codigo: c.codigo, motivo: "teste", recusado_por: "Teste", ...extra };
    const r = await fetch(acao === "aceitar" ? c.aceitar_url : c.recusar_url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });
    const j = await r.json();
    if (acao === "aceitar" && r.status === 201) estado.conexao = j;
    return { status: r.status, json: j };
  }
  async function api(metodo, caminho, corpo, cab = {}) {
    const h = { authorization: "Bearer " + (estado.conexao ? estado.conexao.chave : ""), ...cab };
    if (corpo !== undefined) h["content-type"] = "application/json";
    const r = await fetch(tardim + "/api/v1/" + caminho, { method: metodo, headers: h, body: corpo === undefined ? undefined : (typeof corpo === "string" ? corpo : JSON.stringify(corpo)) });
    return { status: r.status, json: await r.json().catch(() => null), headers: r.headers };
  }
  const espera = async (fn, ms = 8000) => { const fim = Date.now() + ms; while (Date.now() < fim) { const v = fn(); if (v) return v; await new Promise((r) => setTimeout(r, 150)); } return fn(); };
  return { aqui, estado, responde, api, espera, ultimoConvite, desce: () => new Promise((ok) => srv.close(ok)) };
}
