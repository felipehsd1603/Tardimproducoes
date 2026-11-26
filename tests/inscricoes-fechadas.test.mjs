// Inscrições fechadas: leitura da página da Ticket Sports (functions/_lib/ticketsports-situacao.js)
// e a regra do site (FECHAR_INSCRICOES em js/eventos.js). Sem rede e sem wrangler.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import vm from "node:vm";
import { situacaoDaPagina, linkTicketSports, confereTicketSports } from "../functions/_lib/ticketsports-situacao.ts";

const RAIZ = resolve(import.meta.dirname, "..");
const ld = (disp) => `<script type="application/ld+json">{"@type":"Event","offers":{"@type":"Offer","availability":"https://schema.org/${disp}","validFrom":"2026-12-13T08:00"}}</script>`;

describe("página da Ticket Sports", () => {
  test("InStock = aberta, SoldOut = esgotado", () => {
    assert.equal(situacaoDaPagina(ld("InStock")).situacao, "aberta");
    assert.equal(situacaoDaPagina(ld("SoldOut")).situacao, "esgotado");
    assert.equal(situacaoDaPagina(ld("Discontinued")).situacao, "encerrado");
  });
  test("dado escapado dentro do JSON da página", () => {
    assert.equal(situacaoDaPagina('{"x":"{\\"availability\\":\\"https://schema.org/SoldOut\\"}"}').situacao, "esgotado");
  });
  test("várias ofertas: uma aberta basta", () => {
    assert.equal(situacaoDaPagina(ld("SoldOut") + ld("InStock")).situacao, "aberta");
  });
  test("sem o dado ou com valor desconhecido: não decide", () => {
    assert.ok(situacaoDaPagina("<html>nada</html>").erro);
    assert.ok(situacaoDaPagina(ld("Coisa")).erro);
  });
  test("só links da Ticket Sports", () => {
    assert.ok(linkTicketSports("https://www.ticketsports.com.br/e/PROVA-1"));
    assert.equal(linkTicketSports("https://ticketsports.com.br.golpe.com/e/x"), null);
    assert.equal(linkTicketSports("http://www.ticketsports.com.br/e/x"), null);
    assert.equal(linkTicketSports("https://linktr.ee/Tardim"), null);
  });
  test("conferência grava a situação e o erro sem apagar a anterior", async () => {
    const gravados = [];
    const env = { DB: { prepare: (sql) => ({ bind: (...a) => ({
      all: async () => ({ results: [
        { id: "a", nome: "A", inscricao: "https://www.ticketsports.com.br/e/A", ts_situacao: "aberta" },
        { id: "b", nome: "B", inscricao: "https://www.ticketsports.com.br/e/B", ts_situacao: "esgotado" },
        { id: "c", nome: "C", inscricao: "https://linktr.ee/x", ts_situacao: "" },
      ] }),
      run: async () => { gravados.push({ sql, a }); },
    }) }) } };
    const falsa = async (url) => url.endsWith("/A") ? new Response(ld("SoldOut")) : new Response("fora", { status: 503 });
    const r = await confereTicketSports(env, { fetch: falsa, agora: new Date("2026-11-25T12:00:00Z") });
    assert.deepEqual(r.map((x) => [x.id, x.situacao, !!x.erro]), [["a", "esgotado", false], ["b", "", true]]);
    assert.match(gravados[0].sql, /ts_situacao = \?1/);
    assert.equal(gravados[0].a[0], "esgotado");
    assert.doesNotMatch(gravados[1].sql, /ts_situacao =/);
  });
});

describe("site: FECHAR_INSCRICOES", () => {
  const ctx = vm.createContext({});
  vm.runInContext(readFileSync(join(RAIZ, "js", "eventos.js"), "utf8") + "\n;this.FECHAR_INSCRICOES = FECHAR_INSCRICOES;", ctx);
  const agora = new Date(2026, 10, 25);
  const fecha = (ev) => { ctx.FECHAR_INSCRICOES([ev], agora); return ev.encerrado ? "encerrado" : (ev.esgotado ? "esgotado" : "aberta"); };
  const lote = (ate, extra) => Object.assign({ nome: "Lote", valor: "R$ 80,00", ate }, extra);

  test("lotes com data ainda valendo: aberta", () => {
    assert.equal(fecha({ valores: [lote("2026-11-20"), lote("2026-12-10")] }), "aberta");
  });
  test("todos os lotes com data passaram: encerrado (linhas sem data não seguram)", () => {
    assert.equal(fecha({ valores: [lote("2026-11-01"), lote("2026-11-24"), { nome: "60+", valor: "50% de desconto" }] }), "encerrado");
  });
  test("todos os valores esgotados: esgotado", () => {
    assert.equal(fecha({ valores: [{ nome: "Inscrição", valor: "R$ 50,00", esgotado: true }] }), "esgotado");
  });
  test("sem valores: aberta", () => {
    assert.equal(fecha({ valores: [] }), "aberta");
  });
  test("painel/Ticket Sports manda nas datas", () => {
    assert.equal(fecha({ inscricoes: "aberta", esgotado: true, valores: [lote("2026-11-01")] }), "aberta");
    assert.equal(fecha({ inscricoes: "esgotado", valores: [lote("2026-12-10")] }), "esgotado");
    assert.equal(fecha({ inscricoes: "encerrado", valores: [] }), "encerrado");
  });
  test("esgotado escrito no eventos.js continua valendo e rodar duas vezes não muda", () => {
    const ev = { esgotado: true, valores: [lote("2026-11-01")] };
    assert.equal(fecha(ev), "esgotado");
    assert.equal(fecha(ev), "esgotado");
    const ev2 = { valores: [lote("2026-11-01")] };
    assert.equal(fecha(ev2), "encerrado");
    assert.equal(fecha(ev2), "encerrado");
  });
});
