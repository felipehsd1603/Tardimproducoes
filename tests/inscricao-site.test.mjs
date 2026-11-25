// Inscrição direta no site com PIX e cartão (functions/_lib/inscricoes-site.js), contra o banco PIX simulado
// (tests/apoio/banco-pix.mjs, no formato da API do Banco Inter) e o Mercado Pago simulado (tests/apoio/mercadopago.mjs).
// Rodar: npm test
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { sobeTardim, cliente, BASE } from "./apoio/ambiente.mjs";
import { sobeBancoPix, CLIENTE } from "./apoio/banco-pix.mjs";
import { sobeMercadoPago, TOKEN as TOKEN_MP } from "./apoio/mercadopago.mjs";

const PORTA_BANCO = Number(process.env.TESTE_BANCO_PORTA || 8896);
const PORTA_MP = Number(process.env.TESTE_MP_PORTA || 8894);
let T, B, M;
const painel = cliente();
const site = cliente();
const parceiro = cliente();
const PROVA = "prova-pix-2099";
const CPFS = ["52998224725", "11144477735", "39053344705", "86288366757", "71428793860", "15350946056"];
const dados = (cpf, extra = {}) => ({ prova: PROVA, nome: "Atleta " + cpf.slice(0, 3) + " Silva", cpf, email: cpf + "@exemplo.com", telefone: "31988880000",
  nascimento: "1990-05-20", sexo: "F", camiseta: "M", modalidade: "Corrida 5 km", aceite: true, ...extra });
const txid = (id) => "tdm" + id.replace(/-/g, "");
const paga = (id, valor) => fetch(`http://127.0.0.1:${PORTA_BANCO}/simulador/pagar/${txid(id)}`, { method: "POST", body: JSON.stringify(valor ? { valor } : {}) });
// CPF válido a partir de um número (para os testes que precisam de muitos)
function cpf(n) {
  const d = String(100000000 + n).slice(-9).split("").map(Number);
  for (let t = 9; t < 11; t++) { let s = 0; for (let i = 0; i < t; i++) s += d[i] * (t + 1 - i); d.push((s * 10) % 11 % 10); }
  return d.join("");
}
// Cada inscrição de um IP diferente (o limite é 20 criadas por hora por IP; ele tem teste próprio)
let n = 0;
const ip = () => ({ "cf-connecting-ip": "10.9.0." + (++n) });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let conviteId, cupom;

before(async () => {
  B = await sobeBancoPix(PORTA_BANCO);
  M = await sobeMercadoPago(PORTA_MP);
  T = await sobeTardim({
    PIX_API_URL: `http://127.0.0.1:${PORTA_BANCO}/pix/v2`, PIX_CLIENT_ID: CLIENTE.id, PIX_CLIENT_SECRET: CLIENTE.segredo, PIX_CHAVE: "pix@tardim.test",
    MP_API_URL: `http://127.0.0.1:${PORTA_MP}`, MP_ACCESS_TOKEN: TOKEN_MP,
  });
  await painel.entra();
  const cfg = { aberta: true, modalidades: ["Corrida 5 km", "Corrida 10 km"], camisetas: ["P", "M", "G"], lotes: [{ nome: "1º lote", valor: 80, vagas: 2 }, { nome: "2º lote", valor: 95 }],
    cartao: { ativo: true, acrescimo_pct: 5, parcelas: 3 } };
  assert.equal((await painel.chama("POST", "/api/admin/provas", { id: PROVA, nome: "Prova PIX 2099", data: "2099-06-01", publicada: true, inscricao_site: cfg })).status, 201);
  // Embaixador com conta na área do parceiro (cadastro direto: sem e-mail configurado no teste)
  const cad = await parceiro.chama("POST", "/api/parceiro/cadastro", { tipos: ["embaixador"], nome: "Embaixadora Teste", whatsapp: "31999990000", uf: "MG",
    cidade: "Belo Horizonte", aceite: true, email: "embaixadora@exemplo.com", senha: "senha-forte-123" });
  assert.equal(cad.status, 200, cad.texto);
  const pa = (await painel.chama("GET", "/api/admin/parceiros")).json.find((p) => p.nome === "Embaixadora Teste");
  await painel.chama("PUT", `/api/admin/parceiros/${pa.id}`, { situacao: "aprovado", ativo: true });
  const cv = await painel.chama("POST", "/api/admin/convites", { parceiro_id: pa.id, prova_id: PROVA, cupom: "EMBTESTE10", desconto: "10%", comissao_pct: 5, cortesias: 1 });
  conviteId = cv.json.id;
  cupom = cv.json.cupom;
});
after(async () => { await T?.desce(); await B?.fecha(); await M?.fecha(); });

describe("configuração no painel", () => {
  test("aberta sem lote ou sem modalidade é recusada", async () => {
    let r = await painel.chama("PUT", `/api/admin/provas/${PROVA}`, { inscricao_site: { aberta: true, modalidades: ["5 km"], lotes: [] } });
    assert.equal(r.status, 400);
    r = await painel.chama("PUT", `/api/admin/provas/${PROVA}`, { inscricao_site: { aberta: true, modalidades: [], lotes: [{ nome: "x", valor: 10 }] } });
    assert.equal(r.status, 400);
    r = await painel.chama("PUT", `/api/admin/provas/${PROVA}`, { inscricao_site: { aberta: true, modalidades: ["5 km"], lotes: [{ nome: "x", valor: 0 }] } });
    assert.equal(r.status, 400);
    r = await painel.chama("PUT", `/api/admin/provas/${PROVA}`, { inscricao_site: { aberta: true, modalidades: ["5 km"], lotes: [{ nome: "x", valor: 10 }], cartao: { ativo: true, acrescimo_pct: 50 } } });
    assert.equal(r.status, 400);
    assert.match(r.json.mensagem, /acréscimo/);
  });
  test("a configuração não sai no js público das provas", async () => {
    const t = await (await fetch(BASE + "/js/provas-db.js")).text();
    assert.ok(t.includes(PROVA) && !t.includes("inscricao_site") && !t.includes("vagas"));
  });
});

describe("inscrição pelo link do parceiro", () => {
  test("sem cupom válido não abre", async () => {
    assert.equal((await site.chama("GET", `/api/inscricao-site/prova/${PROVA}?cupom=NAOEXISTE`)).status, 404);
    assert.equal((await site.chama("GET", `/api/inscricao-site/prova/${PROVA}`)).status, 404);
    assert.equal((await site.chama("POST", "/api/inscricao-site/criar", dados(CPFS[0], { cupom: "NAOEXISTE" }), ip())).status, 404);
  });
  test("dados da prova com o desconto do cupom", async () => {
    const r = await site.chama("GET", `/api/inscricao-site/prova/${PROVA}?cupom=${cupom.toLowerCase()}`);
    assert.equal(r.status, 200, r.texto);
    assert.deepEqual(r.json.lote, { nome: "1º lote", ate: "", valor_cheio: 8000, desconto: 800, valor: 7200 });
    assert.equal(r.json.parceiro, "Embaixadora Teste");
  });
  test("validação dos dados", async () => {
    for (const [extra, msg] of [[{ cpf: "11111111111" }, /CPF/], [{ nome: "Ana" }, /nome completo/], [{ modalidade: "Maratona" }, /modalidade/],
      [{ camiseta: "XXL" }, /camiseta/], [{ aceite: false }, /regulamento/], [{ nascimento: "2200-01-01" }, /nascimento/]]) {
      const r = await site.chama("POST", "/api/inscricao-site/criar", dados(CPFS[0], { cupom, ...extra }), ip());
      assert.equal(r.status, 400, JSON.stringify(extra));
      assert.match(r.json.mensagem, msg);
    }
  });
  test("cria o PIX no banco, reaproveita ao refazer e confirma ao pagar", async () => {
    const r = await site.chama("POST", "/api/inscricao-site/criar", dados(CPFS[0], { cupom }), ip());
    assert.equal(r.status, 201, r.texto);
    assert.equal(r.json.situacao, "aguardando");
    assert.equal(r.json.valor, 7200);
    assert.match(r.json.pix.copia_cola, /^000201/);
    assert.ok(!("cpf" in r.json) && !("email" in r.json));
    const cob = B.cobs.get(txid(r.json.id));
    assert.equal(cob.valor.original, "72.00");
    assert.equal(cob.devedor.cpf, CPFS[0]);
    assert.equal(cob.chave, "pix@tardim.test");
    // Refazer com o mesmo CPF: mesma cobrança, código novo (o antigo deixa de valer)
    const r2 = await site.chama("POST", "/api/inscricao-site/criar", dados(CPFS[0], { cupom }), ip());
    assert.equal(r2.json.id, r.json.id);
    assert.equal((await site.chama("GET", `/api/inscricao-site/${r.json.id}?c=${r.json.codigo}`)).status, 404);
    assert.equal((await site.chama("GET", `/api/inscricao-site/${r.json.id}?c=${r2.json.codigo}`)).json.situacao, "aguardando");
    await paga(r.json.id);
    await espera(10500); // a consulta ao banco é no máximo a cada 10 s
    const s = await site.chama("GET", `/api/inscricao-site/${r.json.id}?c=${r2.json.codigo}`);
    assert.equal(s.json.situacao, "pago");
    assert.equal(s.json.pix, null);
    // CPF já inscrito
    assert.equal((await site.chama("POST", "/api/inscricao-site/criar", dados(CPFS[0], { cupom }), ip())).status, 409);
  });
  test("PIX pago a menos não confirma", async () => {
    const r = await site.chama("POST", "/api/inscricao-site/criar", dados(CPFS[1], { cupom }), ip());
    assert.equal(r.json.lote, "1º lote");
    await paga(r.json.id, 10);
    const l = (await painel.chama("POST", `/api/admin/inscricoes-site/${r.json.id}/conferir`)).json;
    assert.equal(l.situacao, "aguardando");
    await painel.chama("POST", `/api/admin/inscricoes-site/${r.json.id}/cancelar`);
  });
  test("lote esgotado passa para o próximo; PIX vencido libera a vaga", async () => {
    // 1º lote: 2 vagas (1 paga + 1 cancelada = 1 livre)
    const a = await site.chama("POST", "/api/inscricao-site/criar", dados(CPFS[2], { cupom }), ip());
    assert.equal(a.json.lote, "1º lote");
    const b = await site.chama("POST", "/api/inscricao-site/criar", dados(CPFS[3], { cupom }), ip());
    assert.equal(b.json.lote, "2º lote");
    assert.equal(b.json.valor, 8550);
    // A cobrança vence no banco: a inscrição expira e a vaga do 1º lote volta
    await fetch(`http://127.0.0.1:${PORTA_BANCO}/simulador/remover/${txid(a.json.id)}`, { method: "POST" });
    assert.equal((await painel.chama("POST", `/api/admin/inscricoes-site/${a.json.id}/conferir`)).json.situacao, "expirado");
    assert.equal((await site.chama("GET", `/api/inscricao-site/prova/${PROVA}?cupom=${cupom}`)).json.lote.nome, "1º lote");
  });
});

describe("cartão (Mercado Pago)", () => {
  test("preço no cartão = valor do PIX + 5% repassados ao atleta", async () => {
    const r = (await site.chama("GET", `/api/inscricao-site/prova/${PROVA}?cupom=${cupom}`)).json;
    assert.deepEqual(r.cartao, { acrescimo_pct: 5, parcelas: 3, valor: Math.round(r.lote.valor * 1.05) });
  });
  test("checkout no Mercado Pago, recusado não confirma, aprovado confirma", async () => {
    const pre = (await site.chama("GET", `/api/inscricao-site/prova/${PROVA}?cupom=${cupom}`)).json;
    const r = await site.chama("POST", "/api/inscricao-site/criar", dados(cpf(1), { cupom, forma: "cartao" }), ip());
    assert.equal(r.status, 201, r.texto);
    assert.equal(r.json.forma, "cartao");
    assert.equal(r.json.pix, null);
    assert.equal(r.json.valor, pre.cartao.valor);
    assert.equal(r.json.acrescimo, pre.cartao.valor - pre.lote.valor);
    const pref = [...M.prefs.values()].find((p) => p.d.external_reference === r.json.id).d;
    assert.equal(pref.items[0].unit_price, r.json.valor / 100);
    assert.equal(pref.payment_methods.installments, 3);
    assert.ok(pref.payment_methods.excluded_payment_types.some((x) => x.id === "bank_transfer")); // PIX só pelo banco
    assert.match(pref.back_urls.success, /\/inscricao\.html\?retorno=cartao$/);
    assert.equal((await fetch(r.json.cartao.url)).status, 200);
    const pagar = (resultado) => fetch(`http://127.0.0.1:${PORTA_MP}/checkout/pagar`, { method: "POST", redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ pref: pref.items[0].id && [...M.prefs.keys()].find((k) => M.prefs.get(k).d.external_reference === r.json.id), resultado, parcelas: "2" }) });
    let volta = await pagar("recusado");
    assert.equal(volta.status, 303);
    assert.match(volta.headers.get("location"), /status=rejected/);
    assert.equal((await painel.chama("POST", `/api/admin/inscricoes-site/${r.json.id}/conferir`)).json.situacao, "aguardando");
    volta = await pagar("aprovado");
    assert.match(volta.headers.get("location"), /status=approved/);
    const l = (await painel.chama("POST", `/api/admin/inscricoes-site/${r.json.id}/conferir`)).json;
    assert.equal(l.situacao, "pago");
    assert.equal(l.forma, "cartao");
    assert.ok(l.mp_pagamento);
    assert.ok(!("checkout_url" in l));
  });
  test("trocar de cartão para PIX gera um pagamento novo", async () => {
    const a = await site.chama("POST", "/api/inscricao-site/criar", dados(cpf(2), { cupom, forma: "cartao" }), ip());
    const b = await site.chama("POST", "/api/inscricao-site/criar", dados(cpf(2), { cupom, forma: "pix" }), ip());
    assert.notEqual(a.json.id, b.json.id);
    assert.ok(b.json.pix && !b.json.cartao);
  });
});

describe("limite", () => {
  test("dados inválidos não gastam o limite; mais de 20 inscrições criadas por hora do mesmo IP: 429", async () => {
    const mesmo = { "cf-connecting-ip": "10.8.8.8" };
    for (let i = 0; i < 25; i++) assert.equal((await site.chama("POST", "/api/inscricao-site/criar", dados(CPFS[0], { cupom, nome: "x" }), mesmo)).status, 400);
    let ultimo;
    for (let i = 0; i < 21; i++) ultimo = await site.chama("POST", "/api/inscricao-site/criar", dados(cpf(100 + i), { cupom }), mesmo);
    assert.equal(ultimo.status, 429);
  });
});

describe("área do parceiro", () => {
  test("cortesia do convite e, depois, PIX com desconto", async () => {
    const r1 = await parceiro.chama("POST", "/api/parceiro/inscricao", { convite_id: conviteId, ...dados(CPFS[4]) });
    assert.equal(r1.status, 201, r1.texto);
    assert.equal(r1.json.situacao, "cortesia");
    assert.equal(r1.json.valor, 0);
    assert.equal(B.cobs.has(txid(r1.json.id)), false);
    const r2 = await parceiro.chama("POST", "/api/parceiro/inscricao", { convite_id: conviteId, ...dados(CPFS[5]) });
    assert.equal(r2.json.situacao, "aguardando");
    assert.ok(r2.json.valor > 0 && r2.json.desconto > 0);
    const res = (await parceiro.chama("GET", "/api/parceiro/inscricoes")).json;
    assert.equal(res.resumo[conviteId].site, true);
    // pelo link: o PIX pago e o cartão aprovado, R$ 72,00 cada (a taxa do cartão não entra: é do atleta para a operadora)
    assert.equal(res.resumo[conviteId].pelo_link, 2);
    assert.equal(res.resumo[conviteId].pelo_link_valor, 7200 + 7200);
    assert.equal(res.resumo[conviteId].cortesias_usadas, 1);
    assert.equal(res.proprias.length, 2);
  });
  test("sem login na área do parceiro: 401", async () => {
    const outro = cliente();
    assert.equal((await outro.chama("POST", "/api/parceiro/inscricao", { convite_id: conviteId, ...dados(CPFS[3]) })).status, 401);
  });
});

describe("painel", () => {
  test("lista sem dados internos do PIX", async () => {
    const l = (await painel.chama("GET", `/api/admin/inscricoes-site?prova=${PROVA}`)).json;
    assert.ok(l.length >= 6);
    assert.ok(l.every((x) => !("codigo_hash" in x) && !("pix_copia_cola" in x)));
    assert.equal(l.find((x) => x.situacao === "pago").parceiro_nome, "Embaixadora Teste");
  });
  test("sem login: 401", async () => {
    assert.equal((await site.chama("GET", "/api/admin/inscricoes-site")).status, 401);
  });
});
