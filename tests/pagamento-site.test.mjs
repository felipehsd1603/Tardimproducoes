// Inscrição coletiva paga pelo site (functions/_lib/pagamento-site.ts e functions/api/pagamento-site):
// contas e conferências sem servidor; depois a Tardim inteira (wrangler pages dev) com o banco PIX e o
// Mercado Pago simulados (tests/apoio/banco-pix.mjs e mercadopago.mjs). Nenhuma chamada sai da máquina.
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { createServer } from "node:net";
import { sobeTardim, cliente, BASE, RAIZ } from "./apoio/ambiente.mjs";
import { sobeBancoPix, CLIENTE } from "./apoio/banco-pix.mjs";
import { sobeMercadoPago, TOKEN } from "./apoio/mercadopago.mjs";
import { leConvite, orcamento, validaAtletas, pagamentoLigado, cartaoConfig } from "../functions/_lib/pagamento-site.ts";
import { assinaturaValida } from "../functions/_lib/mercadopago.ts";
import { onRequest } from "../functions/api/pagamento-site/[[rota]].ts";

// O mesmo gerador de links do painel (js/convite.js)
const sandbox = { window: {}, btoa, atob, unescape, escape, encodeURIComponent, decodeURIComponent };
vm.runInNewContext(readFileSync(join(RAIZ, "js", "convite.js"), "utf8"), sandbox);
const CONVITE = sandbox.window.CONVITE;

// CPFs válidos em sequência
function cpf(n) {
  const b = String(100000000 + n).slice(-9).split("").map(Number);
  for (let t = 9; t < 11; t++) {
    let s = 0;
    for (let i = 0; i < t; i++) s += b[i] * (t + 1 - i);
    b.push((s * 10) % 11 % 10);
  }
  return b.join("");
}
let seq = 1;
const atleta = (extra = {}) => {
  const c = cpf(seq++);
  return { nome: "Atleta Teste " + seq, cpf: c.slice(0, 3) + "." + c.slice(3, 6) + "." + c.slice(6, 9) + "-" + c.slice(9), nasc: "20/05/1990", sexo: "F", dist: "10 km", cam: "M",
    email: "atleta" + seq + "@exemplo.com", tel: "(31) 98888-0000", equipe: "", ...extra };
};
const atletas = (n) => Array.from({ length: n }, () => atleta());
// Porta livre para os simuladores (outra sessão pode estar com 8895/8897 abertos)
const portaLivre = () => new Promise((ok, erro) => { const s = createServer().once("error", erro).listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => ok(p)); }); });

describe("contas e conferências (sem servidor)", () => {
  const cond = { valorAtleta: 10000, faixas: [[3, 10], [10, 20]], cortesiasRestantes: 1 };
  test("cortesias, faixa de desconto e total", () => {
    const o = orcamento({}, cond, 4, "pix");
    assert.deepEqual([o.cortesias, o.pagantes, o.desconto_pct, o.valor_unit, o.valor, o.valor_cheio, o.desconto], [1, 3, 10, 9000, 27000, 40000, 13000]);
    assert.equal(orcamento({}, cond, 2, "pix").valor, 10000); // abaixo da faixa: sem desconto, 1 cortesia
    assert.equal(orcamento({}, cond, 1, "pix").valor, 0); // tudo em cortesia
  });
  test("cartão: taxa repassada só com o Mercado Pago configurado", () => {
    const env = { MP_ACCESS_TOKEN: "x", PAGAMENTO_CARTAO_ACRESCIMO_PCT: "5", PAGAMENTO_CARTAO_PARCELAS: "3" };
    assert.deepEqual(cartaoConfig(env), { acrescimo_pct: 5, parcelas: 3 });
    assert.equal(orcamento(env, cond, 4, "cartao").valor, 27000 + 1350);
    assert.equal(cartaoConfig({}), null);
    assert.equal(orcamento({}, cond, 4, "cartao").acrescimo, 0);
    assert.deepEqual(cartaoConfig({ MP_ACCESS_TOKEN: "x", PAGAMENTO_CARTAO_ACRESCIMO_PCT: "99", PAGAMENTO_CARTAO_PARCELAS: "40" }), { acrescimo_pct: 0, parcelas: 12 });
  });
  test("só liga com PAGAMENTO_SITE = ligado", () => {
    assert.equal(pagamentoLigado({}), false);
    assert.equal(pagamentoLigado({ PAGAMENTO_SITE: "desligado" }), false);
    assert.equal(pagamentoLigado({ PAGAMENTO_SITE: "Ligado" }), true);
  });
  test("link do convite: lido igual ao js/convite.js; alterado ou da página dos atletas não vale", () => {
    const c = CONVITE.gera({ p: "prova-x", e: "Equipe Ágil", a: "par-1", v: 100 });
    assert.deepEqual(leConvite(c), { p: "prova-x", e: "Equipe Ágil", a: "par-1" });
    assert.equal(leConvite(c.replace(/^./, "x")), null);
    assert.equal(leConvite(CONVITE.publico({ p: "prova-x", e: "Equipe" })), null);
    assert.equal(leConvite(""), null);
  });
  test("atletas: CPF inválido ou repetido aponta o atleta", () => {
    const a = atleta();
    assert.throws(() => validaAtletas([a, { ...a }], "Eq"), /Atleta 2: CPF repetido/);
    assert.throws(() => validaAtletas([{ ...atleta(), cpf: "123" }], "Eq"), /Atleta 1: CPF inválido/);
    assert.throws(() => validaAtletas([{ ...atleta(), nasc: "1990-05-20" }], "Eq"), /nascimento/);
    assert.equal(validaAtletas([atleta()], "Eq")[0].equipe, "Eq");
  });
  test("webhook do Mercado Pago: assinatura conferida com MP_WEBHOOK_SEGREDO", async () => {
    const { hmacHex } = await import("../functions/_lib/http.ts");
    const env = { MP_WEBHOOK_SEGREDO: "s3gredo" };
    const ts = "1700000000";
    const v1 = await hmacHex("s3gredo", "id:123;request-id:req-1;ts:" + ts + ";");
    const req = (sig) => new Request("https://x/", { method: "POST", headers: { "x-signature": sig, "x-request-id": "req-1" } });
    assert.equal(await assinaturaValida(env, req("ts=" + ts + ",v1=" + v1), "123"), true);
    assert.equal(await assinaturaValida(env, req("ts=" + ts + ",v1=" + "0".repeat(64)), "123"), false);
    assert.equal(await assinaturaValida({}, req(""), "123"), true); // sem segredo: só dispara a consulta
  });
  test("desligado: condicoes responde { ligado: false } e criar não existe (a página fica como antes)", async () => {
    const ctx = (caminho, metodo = "GET") => ({
      request: new Request("https://tardim.test/api/pagamento-site/" + caminho, { method: metodo, headers: { origin: "https://tardim.test", "content-type": "application/json" }, body: metodo === "POST" ? "{}" : undefined }),
      env: { DB: {}, PIX_API_URL: "x", PIX_CLIENT_ID: "x", PIX_CLIENT_SECRET: "x", PIX_CHAVE: "x" },
      params: { rota: caminho.split("?")[0].split("/") }, waitUntil() {}, passThroughOnException() {}, next: async () => new Response(""), data: {}, functionPath: "",
    });
    const r = await onRequest(ctx("condicoes?c=qualquer&n=3"));
    assert.deepEqual(await r.json(), { ligado: false });
    assert.equal((await onRequest(ctx("criar", "POST"))).status, 404);
  });
});

describe("pelo site, com o banco e o Mercado Pago simulados", () => {
  let T, B, M, PIX, MP;
  const painel = cliente();
  const site = cliente();
  const SEGREDO = "segredo-webhook-teste";
  let link, linkCartao, linkCortesia;
  before(async () => {
    const pb = await portaLivre(), pm = await portaLivre();
    PIX = "http://127.0.0.1:" + pb; MP = "http://127.0.0.1:" + pm;
    B = await sobeBancoPix(pb);
    M = await sobeMercadoPago(pm);
    T = await sobeTardim({
      PAGAMENTO_SITE: "ligado", PIX_API_URL: PIX + "/pix/v2", PIX_CLIENT_ID: CLIENTE.id, PIX_CLIENT_SECRET: CLIENTE.segredo,
      PIX_CHAVE: "pix@tardim.test", PIX_WEBHOOK_SEGREDO: SEGREDO, MP_API_URL: MP, MP_ACCESS_TOKEN: TOKEN,
      PAGAMENTO_CARTAO_ACRESCIMO_PCT: "5", PAGAMENTO_CARTAO_PARCELAS: "3",
    });
    T.sql(`INSERT INTO provas (id, nome, data, percursos, publicada) VALUES ('coletiva-2099', 'Coletiva 2099', '2099-06-01', '["5 km","10 km"]', 1)`);
    T.sql(`INSERT INTO parceiros (id, tipo, nome) VALUES ('eq-a', 'assessoria', 'Equipe A'), ('eq-b', 'equipe', 'Equipe B'), ('eq-c', 'assessoria', 'Equipe C'), ('emb-1', 'embaixador', 'Fulana')`);
    T.sql(`INSERT INTO convites (id, parceiro_id, prova_id, cupom, cortesias, coletiva) VALUES
      ('cv-a', 'eq-a', 'coletiva-2099', 'EQA', 1, '{"v":100,"f":[[3,10]],"m":5}'),
      ('cv-b', 'eq-b', 'coletiva-2099', 'EQB', 0, '{"v":80}'),
      ('cv-c', 'eq-c', 'coletiva-2099', 'EQC', 5, '{"v":80}'),
      ('cv-e', 'emb-1', 'coletiva-2099', 'EMB', 0, '{"v":80}')`);
    link = CONVITE.gera({ p: "coletiva-2099", e: "Equipe A", a: "eq-a", v: 100, k: 1, f: [[3, 10]], m: 5 });
    linkCartao = CONVITE.gera({ p: "coletiva-2099", e: "Equipe B", a: "eq-b", v: 80 });
    linkCortesia = CONVITE.gera({ p: "coletiva-2099", e: "Equipe C", a: "eq-c", v: 80, k: 5 });
    await painel.entra();
  });
  after(async () => { await T?.desce(); await B?.fecha(); await M?.fecha(); });

  const pedido = (c, lista, extra = {}) => site.chama("POST", "/api/pagamento-site/criar",
    { c, prova_nome: "Coletiva 2099", responsavel: "Treinador Teste", telefone: "(31) 99999-0000", email: "treinador@exemplo.com", aceite: true, forma: "pix", atletas: lista, ...extra });
  const situacao = (id) => T.sql(`SELECT situacao FROM pagamentos_site WHERE id = '${id}'`)[0].situacao;

  test("condições: preço do convite no banco (o link alterado não muda nada)", async () => {
    const r = await site.chama("GET", "/api/pagamento-site/condicoes?n=4&c=" + encodeURIComponent(link));
    assert.equal(r.json.ligado, true, r.texto);
    assert.equal(r.json.orcamento.pix.valor, 27000);
    assert.equal(r.json.orcamento.cartao.valor, 28350);
    assert.deepEqual([r.json.vagas_restantes, r.json.cortesias_restantes], [5, 1]);
    const barato = CONVITE.gera({ p: "coletiva-2099", e: "Equipe A", a: "eq-a", v: 1, k: 50 });
    assert.equal((await site.chama("GET", "/api/pagamento-site/condicoes?n=4&c=" + encodeURIComponent(barato))).json.orcamento.pix.valor, 27000);
  });
  test("condições: link inválido ou de embaixador não liga o pagamento", async () => {
    assert.equal((await site.chama("GET", "/api/pagamento-site/condicoes?n=2&c=lixo.123")).json.ligado, false);
    const emb = CONVITE.gera({ p: "coletiva-2099", e: "Fulana", a: "emb-1", v: 80 });
    assert.equal((await site.chama("GET", "/api/pagamento-site/condicoes?n=2&c=" + encodeURIComponent(emb))).json.ligado, false);
  });
  test("criar: outra origem é recusada; sem a autorização dos atletas, não cria", async () => {
    const r = await fetch(BASE + "/api/pagamento-site/criar", { method: "POST", headers: { origin: "https://golpe.test", "content-type": "application/json" }, body: "{}" });
    assert.equal(r.status, 403);
    assert.equal((await pedido(link, atletas(2), { aceite: false })).status, 400);
  });

  let p1;
  test("PIX: cria a cobrança no banco, acompanha e, pago, registra os atletas", async () => {
    const r = await pedido(link, atletas(4));
    assert.equal(r.status, 201, r.texto);
    p1 = r.json;
    assert.equal(p1.situacao, "aguardando");
    assert.equal(p1.valor, 27000);
    assert.equal(p1.cortesias, 1);
    assert.match(p1.pix.copia_cola, /^000201/);
    assert.match(p1.codigo, /^[0-9a-f]{32}$/);
    const [cob] = [...B.cobs.values()];
    assert.equal(cob.valor.original, "270.00");
    assert.equal((await site.chama("GET", "/api/pagamento-site/pedido/" + p1.id + "?k=" + "0".repeat(32))).status, 404);
    assert.equal((await site.chama("GET", "/api/pagamento-site/pedido/" + p1.id + "?k=" + p1.codigo)).json.situacao, "aguardando");
    await fetch(PIX + "/simulador/pagar/" + cob.txid, { method: "POST" });
    T.sql(`UPDATE pagamentos_site SET conferido_em = '' WHERE id = '${p1.id}'`);
    const pago = await site.chama("GET", "/api/pagamento-site/pedido/" + p1.id + "?k=" + p1.codigo);
    assert.equal(pago.json.situacao, "pago", pago.texto);
    const [ins] = T.sql(`SELECT * FROM inscricoes WHERE id = '${p1.id}'`);
    assert.deepEqual([ins.canal, ins.origem, ins.equipe, ins.total], ["site", "site", "Equipe A", 4]);
    const at = T.sql(`SELECT nome, cpf, origem, situacao FROM atletas WHERE inscricao_id = '${p1.id}' ORDER BY id`);
    assert.equal(at.length, 4);
    assert.ok(at.every((a) => a.origem === "site" && a.situacao === "inscrito"));
    // Conferir de novo não duplica
    T.sql(`UPDATE pagamentos_site SET conferido_em = '' WHERE id = '${p1.id}'`);
    await site.chama("GET", "/api/pagamento-site/pedido/" + p1.id + "?k=" + p1.codigo);
    assert.equal(T.sql(`SELECT COUNT(*) AS n FROM atletas WHERE inscricao_id = '${p1.id}'`)[0].n, 4);
  });

  test("vagas e cortesias usadas contam para o próximo pedido; webhook do banco confirma pela consulta", async () => {
    const c = await site.chama("GET", "/api/pagamento-site/condicoes?n=1&c=" + encodeURIComponent(link));
    assert.deepEqual([c.json.vagas_restantes, c.json.cortesias_restantes, c.json.orcamento.pix.valor], [1, 0, 10000]);
    assert.equal((await pedido(link, atletas(2))).status, 409);
    const r = await pedido(link, atletas(1));
    assert.equal(r.status, 201, r.texto);
    const cob = [...B.cobs.values()].find((x) => x.valor.original === "100.00");
    await fetch(PIX + "/simulador/pagar/" + cob.txid, { method: "POST" });
    const avisa = (segredo) => fetch(BASE + "/api/pagamento-site/webhook/pix/" + segredo + "/pix", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pix: [{ txid: cob.txid, valor: "1.00" }] }) });
    assert.equal((await avisa("errado")).status, 404);
    assert.equal(situacao(r.json.id), "aguardando");
    assert.equal((await avisa(SEGREDO)).status, 200);
    assert.equal(situacao(r.json.id), "pago");
  });

  test("área do parceiro: mostra as inscrições pagas pelo site no convite dele", async () => {
    const { webcrypto } = await import("node:crypto");
    const sal = webcrypto.getRandomValues(new Uint8Array(16));
    const k = await webcrypto.subtle.importKey("raw", new TextEncoder().encode("senha-parceiro-1"), "PBKDF2", false, ["deriveBits"]);
    const bits = new Uint8Array(await webcrypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: 1000 }, k, 256));
    const b64 = (u) => Buffer.from(u).toString("base64url");
    const guardada = ["pbkdf2", "1000", b64(sal), b64(bits)].join("$");
    T.sql("UPDATE parceiros SET situacao = 'aprovado', ativo = 1 WHERE id = 'eq-a'");
    T.sql("INSERT INTO contas (id, parceiro_id, email, senha) VALUES ('ct-a', 'eq-a', 'eqa@exemplo.com', '" + guardada + "')");
    const parc = cliente();
    assert.equal((await parc.chama("GET", "/api/parceiro/inscricoes-site")).status, 401);
    assert.equal((await parc.chama("POST", "/api/parceiro/login", { email: "eqa@exemplo.com", senha: "senha-parceiro-1" })).status, 200);
    const eu = await parc.chama("GET", "/api/parceiro/eu");
    const cv = eu.json.perfis[0].convites.find((x) => x.id === "cv-a");
    assert.deepEqual([cv.site.atletas, cv.site.pedidos], [5, 2]);
    const n = await parc.chama("GET", "/api/parceiro/inscricoes-site");
    assert.equal(n.json.convites["cv-a"].atletas, 5);
    assert.equal(n.json.convites["cv-b"], undefined); // convite de outra equipe não aparece
  });

  test("cartão: checkout do Mercado Pago com a taxa repassada; aprovado, o pedido fica pago", async () => {
    const r = await pedido(linkCartao, atletas(2), { forma: "cartao" });
    assert.equal(r.status, 201, r.texto);
    assert.equal(r.json.valor, 16000 + 800);
    assert.ok(r.json.cartao.url.startsWith(MP + "/checkout?pref="));
    const pref = new URL(r.json.cartao.url).searchParams.get("pref");
    const volta = await fetch(MP + "/checkout/pagar", { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "pref=" + pref + "&resultado=aprovado&parcelas=1" });
    const destino = new URL(volta.headers.get("location"));
    assert.equal(destino.pathname, "/assessorias.html");
    assert.equal(destino.searchParams.get("pedido"), r.json.id);
    const k = destino.searchParams.get("k");
    const pago = await site.chama("GET", "/api/pagamento-site/pedido/" + r.json.id + "?k=" + k);
    assert.equal(pago.json.situacao, "pago", pago.texto);
    assert.equal(T.sql(`SELECT COUNT(*) AS n FROM atletas WHERE inscricao_id = '${r.json.id}'`)[0].n, 2);
  });

  test("tudo em cortesia: confirma na hora, sem cobrança", async () => {
    const antes = B.cobs.size;
    const r = await pedido(linkCortesia, atletas(3));
    assert.equal(r.status, 201, r.texto);
    assert.equal(r.json.situacao, "cortesia");
    assert.equal(B.cobs.size, antes);
    assert.equal(T.sql(`SELECT COUNT(*) AS n FROM atletas WHERE inscricao_id = '${r.json.id}'`)[0].n, 3);
  });

  test("painel: lista, atletas e conferir (só com login)", async () => {
    assert.equal((await cliente().chama("GET", "/api/admin/pagamentos-site")).status, 401);
    const l = await painel.chama("GET", "/api/admin/pagamentos-site");
    assert.equal(l.status, 200, l.texto);
    assert.ok(l.json.length >= 4);
    assert.ok(l.json.every((x) => !("codigo_hash" in x) && !("atletas_json" in x) && !("pix_copia_cola" in x)));
    const a = await painel.chama("GET", "/api/admin/pagamentos-site/" + p1.id + "/atletas");
    assert.equal(a.json.length, 4);
    const c = await painel.chama("POST", "/api/admin/pagamentos-site/" + p1.id + "/conferir", {});
    assert.equal(c.json.situacao, "pago");
    assert.equal(c.json.valor_pago, 27000);
  });
});
