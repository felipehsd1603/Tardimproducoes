// Testes de integração da API da Tardim: sobem o site inteiro (wrangler pages dev) num banco D1
// local descartável e uma plataforma de assessoria falsa. Rodar: npm test
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { sobeTardim, cliente, BASE } from "./apoio/ambiente.mjs";
import { sobePlataforma } from "./apoio/plataforma.mjs";

let T, P;
const painel = cliente();
before(async () => {
  T = await sobeTardim();
  P = await sobePlataforma(BASE);
  T.sql(`INSERT INTO provas (id, nome, data, hora, local, percursos, valores, kit, programacao, publicada)
         VALUES ('prova-teste-2099', 'Prova Teste 2099', '2099-03-14', '07h30', 'Lagoa da Pampulha', '["5 km","10 km"]',
                 '[{"nome":"1º lote","valor":"R$ 89,90"}]', '{"itens":["Camiseta"],"retirada":"13/03"}', '[]', 1),
                ('rascunho-2099', 'Rascunho 2099', '2099-05-01', '', '', '["21,1 km"]', '[]', '{"itens":[],"retirada":""}', '[]', 0)`);
});
after(async () => { await P?.desce(); await T?.desce(); });

const CPFS = ["52998224725", "11144477735", "39053344705", "86288366757", "71428793860"];
const atleta = (id, cpf, extra = {}) => ({ id_externo: id, nome: "Atleta " + id, cpf, nascimento: "1990-05-20", sexo: "F", percurso_id: "10-km", camiseta: "M",
  email: id + "@exemplo.com", telefone: "+5531988880000", consentimento_em: "2026-11-20T09:00:00Z", ...extra });

describe("arquivos privados", () => {
  for (const caminho of ["/README.md", "/wrangler.toml", "/d1/schema.sql", "/docs/api-v1-parceiros.md", "/functions/_api-v1/avisos.js", "/scripts/gerar-paginas.js", "/package.json", "/package-lock.json", "/tests/api.test.mjs", "/painel/src/main.tsx", "/painel/vite.config.mts", "/.dev.vars", "/node_modules/wrangler/package.json"]) {
    test("não sai pelo site: " + caminho, async () => {
      const r = await fetch(BASE + caminho, { redirect: "manual" });
      assert.equal(r.status, 404, caminho);
    });
  }
});

describe("rotas públicas do site", () => {
  test("orçamento: outra origem é recusada", async () => {
    const r = await fetch(BASE + "/api/orcamento", { method: "POST", headers: { origin: "https://outro.site", "content-type": "application/json" }, body: "{}" });
    assert.equal(r.status, 403);
  });
  test("orçamento: pedido válido é gravado", async () => {
    const r = await painel.chama("POST", "/api/orcamento", { servico: "corrida", nome: "Fulano", contratante: "empresa", empresa: "ACME", cidade: "BH", quando: "2027-01", publico: "500", detalhes: "teste", canal: "whatsapp" });
    assert.ok(r.status === 200 || r.status === 201, r.texto);
  });
  test("me avise: pedido válido e repetido não duplica", async () => {
    const corpo = { prova_id: "prova-teste-2099", nome: "Maria", email: "maria@exemplo.com" };
    assert.ok([200, 201].includes((await painel.chama("POST", "/api/aviso", corpo)).status));
    assert.ok([200, 201].includes((await painel.chama("POST", "/api/aviso", corpo)).status));
    assert.equal(T.sql("SELECT COUNT(*) AS n FROM avisos WHERE email = 'maria@exemplo.com'")[0].n, 1);
  });
  test("inscrição coletiva pela planilha: CPF inválido aponta a linha", async () => {
    const r = await painel.chama("POST", "/api/inscricao", { prova: { id: "prova-teste-2099", nome: "Prova Teste 2099" }, equipe: "Equipe X", atletas: [{ nome: "A", cpf: "123", nasc: "1990-01-01", sexo: "F", dist: "5 km", cam: "M", email: "a@b.c", tel: "31999999999" }] });
    assert.equal(r.status, 400);
    assert.equal(r.json.erro, "atleta");
  });
  test("provas publicadas saem no js do calendário", async () => {
    const t = await (await fetch(BASE + "/js/provas-db.js")).text();
    assert.match(t, /prova-teste-2099/);
    assert.doesNotMatch(t, /rascunho-2099/);
  });
});

describe("painel (api/admin)", () => {
  test("sem login: 401", async () => {
    assert.equal((await cliente().chama("GET", "/api/admin/dados")).status, 401);
  });
  test("senha errada: 401", async () => {
    assert.equal((await cliente().chama("POST", "/api/admin/login", { senha: "errada" })).status, 401);
  });
  test("escrita de outra origem: 403", async () => {
    const r = await painel.chama("POST", "/api/admin/login", { senha: "x" }, { origin: "https://outro.site" });
    assert.equal(r.status, 403);
  });
  test("login e dados", async () => {
    assert.equal((await painel.entra()).status, 200);
    const r = await painel.chama("GET", "/api/admin/dados");
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.json.provas) && Array.isArray(r.json.parceiros) && Array.isArray(r.json.convites));
  });
  test("CRUD de parceiro com validação", async () => {
    assert.equal((await painel.chama("POST", "/api/admin/parceiros", { tipo: "desconhecido", nome: "X" })).status, 400);
    const c = await painel.chama("POST", "/api/admin/parceiros", { tipo: "embaixador", nome: "Embaixador Teste", uf: "mg" });
    assert.equal(c.status, 201);
    assert.equal(c.json.uf, "MG");
    const a = await painel.chama("PUT", "/api/admin/parceiros/" + c.json.id, { cidade: "Belo Horizonte" });
    assert.equal(a.json.cidade, "Belo Horizonte");
    assert.equal((await painel.chama("DELETE", "/api/admin/parceiros/" + c.json.id)).status, 200);
    assert.equal((await painel.chama("PUT", "/api/admin/parceiros/" + c.json.id, { nome: "x" })).status, 404);
  });
  test("prova: identificador e data validados", async () => {
    assert.equal((await painel.chama("POST", "/api/admin/provas", { id: "Prova Ruim", nome: "x", data: "2099-01-01" })).status, 400);
    assert.equal((await painel.chama("POST", "/api/admin/provas", { id: "prova-x-2099", nome: "x", data: "01/01/2099" })).status, 400);
    const r = await painel.chama("POST", "/api/admin/provas", { id: "prova-x-2099", nome: "Prova X", data: "2099-01-01", percursos: ["5 km"] });
    assert.equal(r.status, 201);
    assert.deepEqual(r.json.percursos, ["5 km"]);
    assert.equal(r.json.publicada, false);
  });
  test("convite: cupom normalizado e parceiro precisa existir", async () => {
    assert.equal((await painel.chama("POST", "/api/admin/convites", { parceiro_id: "nao-existe", prova_id: "prova-teste-2099", cupom: "abc" })).status, 400);
  });
  test("configuração do contrato: grava e lê", async () => {
    assert.equal((await painel.chama("PUT", "/api/admin/config/contrato", { foro: "Belo Horizonte" })).status, 200);
    assert.equal((await painel.chama("GET", "/api/admin/config/contrato")).json.foro, "Belo Horizonte");
  });
  test("imagem: só JPG/PNG/WebP com caminho válido", async () => {
    assert.equal((await painel.chama("POST", "/api/admin/arquivos?caminho=../x.png", new Uint8Array([1]), { "content-type": "image/png" })).status, 400);
    const r = await painel.chama("POST", "/api/admin/arquivos?caminho=provas/teste-1.png", new Uint8Array([137, 80, 78, 71]), { "content-type": "image/png" });
    assert.equal(r.status, 201);
    const f = await fetch(BASE + "/arquivos/provas/teste-1.png");
    assert.equal(f.status, 200);
  });
  test("rota desconhecida: 404", async () => {
    assert.equal((await painel.chama("GET", "/api/admin/nada")).status, 404);
  });
});

describe("documentação (OpenAPI e Swagger)", () => {
  test("v1: especificação pública e página Swagger", async () => {
    const spec = await (await fetch(BASE + "/api/v1/openapi.json")).json();
    assert.equal(spec.openapi, "3.1.0");
    for (const p of ["/eu", "/provas", "/convites", "/envios", "/atletas", "/conexoes/{id}/aceitar"]) assert.ok(spec.paths[p], p);
    assert.equal(spec.servers[0].url, BASE + "/api/v1");
    const html = await (await fetch(BASE + "/api/v1/docs")).text();
    assert.match(html, /swagger-ui/);
  });
  test("interna: só com login no painel", async () => {
    assert.equal((await cliente().chama("GET", "/api/admin/openapi.json")).status, 401);
    await painel.entra();
    const r = await painel.chama("GET", "/api/admin/openapi.json");
    assert.equal(r.status, 200);
    assert.ok(r.json.paths["/api/admin/{tabela}"] && r.json.paths["/api/parceiro/cadastro"] && r.json.paths["/api/orcamento"]);
    assert.match((await painel.chama("GET", "/api/admin/docs")).texto, /swagger-ui/);
  });
});

describe("área do parceiro (api/parceiro)", () => {
  test("config e sessão", async () => {
    const c = await cliente().chama("GET", "/api/parceiro/config");
    assert.equal(c.status, 200);
    assert.equal((await cliente().chama("GET", "/api/parceiro/eu")).status, 401);
  });
  test("cidades do IBGE", async () => {
    const r = await cliente().chama("GET", "/api/parceiro/cidades?uf=MG");
    assert.equal(r.status, 200);
    assert.ok(r.json.cidades.includes("Belo Horizonte"));
  });
});

describe("API v1 para parceiros", () => {
  let assessoriaId, conviteId;
  before(async () => {
    await painel.entra();
    const a = await painel.chama("POST", "/api/admin/parceiros", { tipo: "assessoria", nome: "Assessoria Teste", responsavel: "Coach", email: "coach@exemplo.com" });
    assessoriaId = a.json.id;
    const cv = await painel.chama("POST", "/api/admin/convites", { parceiro_id: assessoriaId, prova_id: "prova-teste-2099", cupom: "teste10", desconto: "10%", comissao_pct: 10, coletiva: { d: "2099-02-28", m: 3, v: 79.9 } });
    conviteId = cv.json.id;
    assert.equal(cv.json.cupom, "TESTE10");
  });

  test("chave pública e erros de autenticação", async () => {
    const k = await (await fetch(BASE + "/api/v1/chaves-publicas")).json();
    assert.equal(k.keys[0].alg, "ES256");
    assert.equal(k.keys[0].d, undefined);
    assert.equal((await fetch(BASE + "/api/v1/eu")).status, 401);
    const r = await fetch(BASE + "/api/v1/eu", { headers: { authorization: "Bearer tdm_live_" + "0".repeat(48) } });
    assert.equal((await r.json()).erro.codigo, "chave_invalida");
  });

  test("conectar: convite assinado, recusa e aceite", async () => {
    let r = await painel.chama("POST", `/api/admin/parceiros/${assessoriaId}/conexao`, { plataforma_url: P.aqui });
    assert.equal(r.json.situacao, "enviado");
    assert.equal(P.estado.erros.length, 0, P.estado.erros.join());
    assert.equal((await P.responde("recusar")).status, 200);
    assert.equal((await P.responde("recusar")).status, 409);

    r = await painel.chama("POST", `/api/admin/parceiros/${assessoriaId}/conexao`, { plataforma_url: P.aqui });
    assert.equal(r.json.situacao, "enviado");
    assert.equal((await P.responde("aceitar", { webhook_url: "https://outro.site/webhook" })).status, 400);
    const ac = await P.responde("aceitar");
    assert.equal(ac.status, 201);
    assert.match(ac.json.chave, /^tdm_live_[0-9a-f]{48}$/);
    assert.equal((await P.responde("aceitar")).status, 409);

    const l = await painel.chama("GET", `/api/admin/parceiros/${assessoriaId}/integracoes`);
    assert.equal(l.json.integracoes.filter((k) => !k.revogada_em).length, 1);
    assert.ok(!JSON.stringify(l.json).includes(ac.json.chave), "o painel nunca devolve a chave");
    assert.ok(!JSON.stringify(l.json).includes("whsec_"), "nem o segredo");
  });

  test("eu, provas e convites", async () => {
    const eu = await P.api("GET", "eu");
    assert.equal(eu.json.assessoria.nome, "Assessoria Teste");
    const p = await P.api("GET", "provas");
    assert.deepEqual(p.json.provas.map((x) => x.id), ["prova-teste-2099"]);
    const pr = p.json.provas[0];
    assert.deepEqual(pr.percursos.map((x) => x.id), ["5-km", "10-km"]);
    assert.equal(pr.coletiva.valor_atleta_centavos, 7990);
    assert.equal(pr.convite.cupom, "TESTE10");
    assert.equal((await P.api("GET", "provas/rascunho-2099")).status, 404);
    const c = await P.api("GET", "convites?situacao=pendente");
    assert.equal(c.json.convites.length, 1);
    assert.equal(c.json.convites[0].prova.id, "prova-teste-2099");
  });

  test("envio antes de aceitar o convite: 403", async () => {
    const r = await P.api("POST", "envios", { prova_id: "prova-teste-2099", modo_pagamento: "assessoria", atletas: [atleta("x", CPFS[0])] }, { "idempotency-key": "l0" });
    assert.equal(r.status, 403);
  });

  test("aceitar o convite de prova", async () => {
    assert.equal((await P.api("POST", `convites/${conviteId}/aceitar`, {})).status, 400);
    const r = await P.api("POST", `convites/${conviteId}/aceitar`, { modo_pagamento: "assessoria" });
    assert.equal(r.json.convite.situacao, "aceito");
    const cv = (await painel.chama("GET", "/api/admin/convites")).json.find((x) => x.id === conviteId);
    assert.equal(cv.api_situacao, "aceito");
  });

  test("envios: validação, repetição segura, conflito, atualização, cancelamento e vagas", async () => {
    const lote1 = { prova_id: "prova-teste-2099", modo_pagamento: "assessoria", atletas: [atleta("i1", CPFS[0]), atleta("i2", CPFS[1]), atleta("i3", "12345678900"), atleta("i4", CPFS[2], { percurso_id: "42k" }), atleta("i5", CPFS[3], { consentimento_em: undefined })] };
    assert.equal((await P.api("POST", "envios", lote1)).status, 400, "sem Idempotency-Key");
    const r1 = await P.api("POST", "envios", lote1, { "idempotency-key": "lote1" });
    assert.equal(r1.status, 202);
    assert.equal(r1.json.envio.novos, 2);
    assert.deepEqual(r1.json.rejeitados.map((x) => [x.id_externo, x.codigo]), [["i3", "atleta_invalido"], ["i4", "percurso_invalido"], ["i5", "campo_obrigatorio"]]);
    const r1b = await P.api("POST", "envios", lote1, { "idempotency-key": "lote1" });
    assert.deepEqual(r1b.json, r1.json);
    assert.equal((await P.api("POST", "envios", { ...lote1, atletas: [atleta("i1", CPFS[0])] }, { "idempotency-key": "lote1" })).status, 409);

    const lote2 = { prova_id: "prova-teste-2099", modo_pagamento: "assessoria",
      atletas: [atleta("i2", CPFS[1], { camiseta: "GG" }), atleta("i6", CPFS[2]), atleta("i7", CPFS[3]), atleta("i8", CPFS[4])],
      cancelamentos: [{ id_externo: "i1", motivo: "desistiu" }] };
    const r2 = await P.api("POST", "envios", lote2, { "idempotency-key": "lote2" });
    assert.equal(r2.status, 202);
    assert.deepEqual([r2.json.envio.novos, r2.json.envio.atualizados, r2.json.envio.cancelados], [2, 1, 1]);
    assert.deepEqual(r2.json.rejeitados.map((x) => [x.id_externo, x.codigo]), [["i8", "vagas_esgotadas"]]);

    const at = await P.api("GET", "atletas?prova_id=prova-teste-2099");
    const sit = Object.fromEntries(at.json.atletas.map((a) => [a.id_externo, a.situacao]));
    assert.deepEqual(sit, { i1: "cancelado", i2: "recebido", i6: "recebido", i7: "recebido" });
    assert.equal(T.sql("SELECT camiseta FROM atletas WHERE id_externo = 'i2'")[0].camiseta, "GG");
    assert.equal((await P.api("GET", "envios/" + r2.json.envio.id)).json.atletas.length, 4);
  });

  test("conferência no painel manda atleta.situacao assinado", async () => {
    const ins = (await painel.chama("GET", "/api/admin/inscricoes")).json.filter((i) => i.origem === "api");
    assert.ok(ins.length >= 2);
    const antes = P.estado.avisos.length;
    const r = await painel.chama("POST", `/api/admin/inscricoes/${ins.at(-1).id}/confirmar`, {});
    assert.ok(r.json.confirmados >= 1);
    const aviso = await P.espera(() => P.estado.avisos.slice(antes).find((a) => a.evento === "atleta.situacao"));
    assert.equal(aviso.hmac, "ok");
    const i2 = T.sql("SELECT id FROM atletas WHERE id_externo = 'i2'")[0].id;
    const p = await painel.chama("PUT", "/api/admin/atletas/" + i2, { situacao: "inscrito", numero_peito: "1043" });
    assert.equal(p.json.aviso.ok, true);
    const at = await P.api("GET", "atletas?prova_id=prova-teste-2099");
    assert.equal(at.json.atletas.find((a) => a.id_externo === "i2").numero_peito, "1043");
  });

  test("alterar convite e prova avisa a plataforma", async () => {
    const antes = P.estado.avisos.length;
    await painel.chama("PUT", "/api/admin/convites/" + conviteId, { desconto: "15%" });
    await painel.chama("PUT", "/api/admin/provas/prova-teste-2099", { hora: "08h" });
    const ev = await P.espera(() => { const n = P.estado.avisos.slice(antes).filter((a) => a.evento === "convite.alterado"); return n.length >= 2 ? n : null; });
    assert.ok(ev, "dois convite.alterado");
    assert.ok(ev.every((a) => a.hmac === "ok"));
  });

  test("aviso que falha entra na fila e é reenviado com o mesmo id de entrega", async () => {
    P.estado.falhar = 1;
    const r = await painel.chama("POST", `/api/admin/convites/${conviteId}/avisar`, {});
    assert.equal(r.json.aviso.ok, false);
    const fila = T.sql("SELECT id, tentativas, entregue_em FROM avisos_fila WHERE evento = 'convite.alterado' ORDER BY criado_em DESC LIMIT 1")[0];
    assert.equal(fila.id, r.json.aviso.entrega);
    assert.equal(fila.entregue_em, "");
    assert.match(r.json.convite.api_aviso, /^erro/);
    T.sql("UPDATE avisos_fila SET proxima_em = '2000-01-01T00:00:00Z' WHERE id = '" + fila.id + "'");
    await painel.chama("GET", "/api/admin/sessao"); // qualquer chamada do painel processa a fila em segundo plano
    const reenvio = await P.espera(() => P.estado.avisos.find((a) => a.entrega === fila.id && a.hmac === "ok"));
    assert.ok(reenvio, "reenviado com o mesmo x-tardim-entrega");
    const depois = await P.espera(() => { const f = T.sql("SELECT entregue_em, tentativas FROM avisos_fila WHERE id = '" + fila.id + "'")[0]; return f.entregue_em ? f : null; });
    assert.equal(depois.tentativas, 2);
    assert.equal(T.sql("SELECT api_aviso FROM convites WHERE id = '" + conviteId + "'")[0].api_aviso, "ok");
  });

  test("convite de prova que ainda não está no painel chega quando a prova é trazida e publicada", async () => {
    const cv = await painel.chama("POST", "/api/admin/convites", { parceiro_id: assessoriaId, prova_id: "prova-do-codigo-2099", cupom: "CODIGO1" });
    assert.equal(cv.status, 201);
    assert.equal((await P.api("GET", "convites?situacao=pendente")).json.convites.some((c) => c.id === cv.json.id), false, "prova fora do painel não aparece");
    const antes = P.estado.avisos.length;
    const pr = await painel.chama("POST", "/api/admin/provas", { id: "prova-do-codigo-2099", nome: "Prova do Código 2099", data: "2099-08-01", percursos: ["5 km"], publicada: true });
    assert.equal(pr.status, 201);
    const aviso = await P.espera(() => P.estado.avisos.slice(antes).find((a) => a.evento === "convite.criado" && a.corpo.dados.convite.id === cv.json.id));
    assert.ok(aviso, "convite.criado ao trazer a prova para o painel");
    assert.equal(aviso.hmac, "ok");
    assert.ok((await P.api("GET", "convites?situacao=pendente")).json.convites.some((c) => c.id === cv.json.id));
  });

  test("limite de uso por chave", async () => {
    const r = await Promise.all(Array.from({ length: 130 }, () => P.api("GET", "eu")));
    assert.ok(r.some((x) => x.status === 429));
    const x = r.find((y) => y.status === 429);
    assert.ok(Number(x.headers.get("retry-after")) > 0);
  });

  test("desconectar pelo painel avisa e revoga", async () => {
    await new Promise((r) => setTimeout(r, 61000 - (Date.now() % 60000))); // sai do minuto do teste de limite
    const k = (await painel.chama("GET", `/api/admin/parceiros/${assessoriaId}/integracoes`)).json.integracoes.find((x) => !x.revogada_em);
    const antes = P.estado.avisos.length;
    const r = await painel.chama("POST", `/api/admin/integracoes/${k.id}/desconectar`, {});
    assert.equal(r.json.aviso.ok, true);
    assert.equal(P.estado.avisos.slice(antes).find((a) => a.evento === "conexao.encerrada").hmac, "ok");
    assert.equal((await P.api("GET", "eu")).json.erro.codigo, "chave_revogada");
  });
});
