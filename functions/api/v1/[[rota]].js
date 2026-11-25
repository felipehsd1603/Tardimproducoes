// /api/v1/* — API para parceiros (plataformas de assessoria). Contrato: docs/api-v1-parceiros.md
//
// Sem chave:
//   GET    /api/v1/chaves-publicas                  JWKS que confere a assinatura dos convites de conexão
//   POST   /api/v1/conexoes/<id>/aceitar            { codigo, plataforma, webhook_url, aceito_por }  -> chave (uma vez)
//   POST   /api/v1/conexoes/<id>/recusar            { codigo, motivo, recusado_por }
// Com "Authorization: Bearer tdm_live_..." (ou tdm_test_):
//   GET    /api/v1/eu                               quem é a chave
//   DELETE /api/v1/conexao                          a plataforma desconecta (revoga a chave)
//   GET    /api/v1/provas  |  /api/v1/provas/<id>   provas em que a assessoria tem convite (próximas)
//   GET    /api/v1/convites[?situacao=pendente]     convites de prova
//   POST   /api/v1/convites/<id>/aceitar            { modo_pagamento, aceito_por }
//   POST   /api/v1/convites/<id>/recusar            { motivo, recusado_por }
//   (envios, atletas e resultados: próxima etapa; respondem 501)
//
// A chave nasce no aceite da conexão e vai direto para o servidor da plataforma: ninguém a copia.
// O banco guarda só o SHA-256 dela. Só servidor chama esta API: não há CORS.

import { RE_CHAVE, sha256, novaChave, novoSegredo } from "../../_chaves.js";
import { chavesPublicas } from "../../_assinatura.js";
import { linhasProvas, formataProva, conviteApi, absoluto, isoBanco, hojeBR } from "../../_provas_api.js";

const LIMITE_MINUTO = 120;
const LIMITE_CONEXAO_IP = 20; // aceitar/recusar por IP por minuto

class Erro extends Error {
  constructor(status, codigo, mensagem, extra) { super(mensagem); this.status = status; this.codigo = codigo; this.extra = extra; }
}

function json(corpo, status, extra) {
  return new Response(JSON.stringify(corpo), {
    status: status || 200,
    headers: Object.assign({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }, extra || {}),
  });
}

async function corpo(request) {
  const t = await request.text();
  if (t.length > 20000) throw new Erro(413, "json_invalido", "Corpo grande demais.");
  if (!t.trim()) return {};
  try { const d = JSON.parse(t); if (d && typeof d === "object" && !Array.isArray(d)) return d; } catch (e) { /* cai abaixo */ }
  throw new Erro(400, "json_invalido", "JSON inválido.");
}
const texto = (v, max) => String(v == null ? "" : v).trim().slice(0, max);

// Contador por minuto (tabela api_uso); "dono" = id da integração ou "ip:<ip>"
async function contaUso(env, dono, limite) {
  const agora = Math.floor(Date.now() / 1000);
  const uso = await env.DB.prepare(
    "INSERT INTO api_uso (integracao_id, minuto, n) VALUES (?, ?, 1) ON CONFLICT (integracao_id, minuto) DO UPDATE SET n = n + 1 RETURNING n"
  ).bind(dono, Math.floor(agora / 60)).first();
  if (uso && uso.n > limite) {
    throw new Erro(429, "limite_de_uso", "Limite de " + limite + " chamadas por minuto.", { "retry-after": String(60 - (agora % 60)) });
  }
  return agora;
}

// ---------- autenticação ----------
async function autentica(request, env, waitUntil) {
  const m = (request.headers.get("Authorization") || "").match(/^Bearer\s+(\S+)$/i);
  if (!m) throw new Erro(401, "chave_ausente", "Envie a chave no cabeçalho Authorization: Bearer <chave>.");
  if (!RE_CHAVE.test(m[1])) throw new Erro(401, "chave_invalida", "Chave inválida.");
  const r = await env.DB.prepare(
    "SELECT i.*, p.nome AS p_nome, p.tipo AS p_tipo, p.situacao AS p_situacao, p.ativo AS p_ativo, p.cidade AS p_cidade, p.uf AS p_uf, p.logo AS p_logo " +
    "FROM integracoes i JOIN parceiros p ON p.id = i.parceiro_id WHERE i.hash = ?"
  ).bind(await sha256(m[1])).first();
  if (!r) throw new Erro(401, "chave_invalida", "Chave inválida.");
  if (r.revogada_em) throw new Erro(401, "chave_revogada", "Esta conexão foi encerrada.");
  if (r.p_tipo !== "assessoria" || r.p_situacao !== "aprovado" || !r.p_ativo) {
    throw new Erro(403, "assessoria_inativa", "A assessoria desta chave não está ativa na Tardim Produções.");
  }
  const agora = await contaUso(env, r.id, LIMITE_MINUTO);
  // Manutenção sem atrasar a resposta: último uso (no máximo a cada 10 min) e limpeza do contador
  const passos = [];
  if (!r.usada_em || Date.parse(r.usada_em) < Date.now() - 600000) {
    passos.push(env.DB.prepare("UPDATE integracoes SET usada_em = ? WHERE id = ?").bind(isoBanco(Date.now()), r.id).run());
  }
  if (Math.random() < 0.02) passos.push(env.DB.prepare("DELETE FROM api_uso WHERE minuto < ?").bind(Math.floor(agora / 60) - 10).run());
  if (passos.length) waitUntil(Promise.all(passos).catch(() => {}));
  return r;
}

// ---------- conexão: aceitar / recusar (autentica pelo código do convite) ----------
async function respondeConexao(request, env, id, acao) {
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  await contaUso(env, "ip:" + ip, LIMITE_CONEXAO_IP);
  const d = await corpo(request);
  const cx = await env.DB.prepare(
    "SELECT x.*, p.nome AS p_nome, p.tipo AS p_tipo, p.situacao AS p_situacao, p.ativo AS p_ativo FROM conexoes x JOIN parceiros p ON p.id = x.parceiro_id WHERE x.id = ?"
  ).bind(id).first();
  if (!cx) throw new Erro(404, "nao_encontrado", "Convite não encontrado.");
  if (!/^[0-9a-f]{64}$/.test(String(d.codigo || "")) || (await sha256(d.codigo)) !== cx.codigo_hash) {
    throw new Erro(401, "codigo_invalido", "Código do convite inválido.");
  }
  if (!["enviado", "enviando", "falhou"].includes(cx.situacao)) throw new Erro(409, "convite_respondido", "Este convite já foi respondido ou cancelado.");
  if (Date.parse(cx.expira_em) < Date.now()) throw new Erro(409, "convite_expirado", "Este convite expirou. Peça um novo à Tardim Produções.");
  const agora = isoBanco(Date.now());

  if (acao === "recusar") {
    await env.DB.prepare("UPDATE conexoes SET situacao = 'recusado', motivo = ?, respondido_por = ?, respondido_em = ? WHERE id = ?")
      .bind(texto(d.motivo, 300), texto(d.recusado_por, 120), agora, id).run();
    return json({ ok: true });
  }

  if (cx.p_tipo !== "assessoria" || cx.p_situacao !== "aprovado" || !cx.p_ativo) {
    throw new Erro(403, "assessoria_inativa", "A assessoria deste convite não está ativa na Tardim Produções.");
  }
  // O endereço de avisos precisa ser da mesma plataforma convidada
  let webhook = "";
  if (d.webhook_url) {
    let u;
    try { u = new URL(String(d.webhook_url)); } catch (e) { throw new Erro(400, "campo_obrigatorio", "webhook_url inválido."); }
    if (u.origin !== cx.plataforma_url) throw new Erro(400, "campo_obrigatorio", "webhook_url precisa ser do mesmo endereço convidado (" + cx.plataforma_url + ").");
    webhook = u.toString();
  }
  const plataforma = d.plataforma && typeof d.plataforma === "object" ? d.plataforma : {};
  const { chave, prefixo } = novaChave(cx.ambiente);
  const segredo = novoSegredo();
  const integId = crypto.randomUUID();
  // Uma conexão valendo por assessoria e plataforma: a anterior é encerrada
  await env.DB.batch([
    env.DB.prepare("UPDATE integracoes SET revogada_em = ? WHERE parceiro_id = ? AND plataforma_url = ? AND revogada_em = ''").bind(agora, cx.parceiro_id, cx.plataforma_url),
    env.DB.prepare("INSERT INTO integracoes (id, parceiro_id, nome, plataforma_url, conexao_id, ambiente, prefixo, hash, webhook_url, webhook_segredo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(integId, cx.parceiro_id, texto(plataforma.nome, 60) || cx.plataforma_url.replace(/^https?:\/\//, ""), cx.plataforma_url, id, cx.ambiente, prefixo, await sha256(chave), webhook, segredo),
    env.DB.prepare("UPDATE conexoes SET situacao = 'aceito', respondido_por = ?, respondido_em = ?, integracao_id = ? WHERE id = ?")
      .bind(texto(d.aceito_por, 120), agora, integId, id),
    // Convites futuros da assessoria passam a esperar resposta na plataforma
    env.DB.prepare("UPDATE convites SET api_situacao = 'pendente' WHERE parceiro_id = ? AND api_situacao = '' AND prova_id IN (SELECT id FROM provas WHERE data >= ?)")
      .bind(cx.parceiro_id, hojeBR()),
  ]);
  return json({ chave, webhook_segredo: segredo, assessoria: { id: cx.parceiro_id, nome: cx.p_nome }, ambiente: cx.ambiente }, 201);
}

// ---------- provas e convites ----------
function paginacao(url) {
  const limite = Math.min(Math.max(parseInt(url.searchParams.get("limite"), 10) || 100, 1), 500);
  let inicio = 0;
  const c = url.searchParams.get("cursor");
  if (c) {
    try { inicio = parseInt(atob(c.replace(/-/g, "+").replace(/_/g, "/")), 10); } catch (e) { inicio = -1; }
    if (!(inicio >= 0)) throw new Erro(400, "campo_obrigatorio", "Cursor inválido.");
  }
  return { limite, inicio };
}
const cursor = (n) => btoa(String(n)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function listaProvas(env, integ, url) {
  const { limite, inicio } = paginacao(url);
  const desde = url.searchParams.get("desde");
  if (desde && !/^\d{4}-\d{2}-\d{2}$/.test(desde)) throw new Erro(400, "campo_obrigatorio", "Use desde=AAAA-MM-DD.");
  const mudou = url.searchParams.get("atualizadas_desde");
  const mudouIso = mudou ? isoBanco(mudou) : null;
  if (mudou && !mudouIso) throw new Erro(400, "campo_obrigatorio", "Data inválida em atualizadas_desde.");
  let linhas = await linhasProvas(env, integ);
  if (desde) linhas = linhas.filter((l) => l.data >= desde);
  if (mudouIso) linhas = linhas.filter((l) => [l.atualizado_em, l.c_atualizado].some((x) => x && isoBanco(x) >= mudouIso));
  const pagina = linhas.slice(inicio, inicio + limite);
  const provas = [];
  for (const l of pagina) provas.push(await formataProva(env, l, integ, url.origin));
  return json({ provas, proximo_cursor: inicio + limite < linhas.length ? cursor(inicio + limite) : null });
}

const SITUACOES = ["pendente", "aceito", "recusado"];
async function listaConvites(env, integ, url) {
  const s = url.searchParams.get("situacao");
  if (s && !SITUACOES.includes(s)) throw new Erro(400, "campo_obrigatorio", "situacao: pendente, aceito ou recusado.");
  const linhas = (await linhasProvas(env, integ, { todosConvites: true, situacao: s || null })).filter((l) => l.c_situacao);
  const convites = [];
  for (const l of linhas) convites.push(Object.assign(conviteApi(l), { prova: await formataProva(env, l, integ, url.origin) }));
  return json({ convites });
}

async function respondeConvite(request, env, integ, id, acao, url) {
  const [l] = await linhasProvas(env, integ, { conviteId: id, todosConvites: true });
  if (!l) throw new Erro(404, "nao_encontrado", "Convite não encontrado para esta assessoria.");
  const d = await corpo(request);
  const agora = isoBanco(Date.now());
  if (acao === "aceitar") {
    if (!["assessoria", "ticketsports"].includes(d.modo_pagamento)) throw new Erro(400, "campo_obrigatorio", "modo_pagamento: assessoria ou ticketsports.");
    await env.DB.prepare("UPDATE convites SET api_situacao = 'aceito', api_modo_pagamento = ?, api_motivo = '', api_respondido_em = ? WHERE id = ?")
      .bind(d.modo_pagamento, agora, id).run();
  } else {
    await env.DB.prepare("UPDATE convites SET api_situacao = 'recusado', api_modo_pagamento = '', api_motivo = ?, api_respondido_em = ? WHERE id = ?")
      .bind(texto(d.motivo, 300), agora, id).run();
  }
  const [novo] = await linhasProvas(env, integ, { conviteId: id, todosConvites: true });
  return json({ convite: conviteApi(novo) });
}

// ---------- rotas ----------
async function trata(request, env, rota, url, waitUntil) {
  const [a, b, c] = rota;
  const m = request.method;
  const so = (metodo) => { if (m !== metodo) throw new Erro(405, "metodo", "Use " + metodo + "."); };

  // Rotas sem chave
  if (a === "chaves-publicas" && !b) {
    so("GET");
    return new Response(JSON.stringify(chavesPublicas(env)), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=3600" } });
  }
  if (a === "conexoes" && b && (c === "aceitar" || c === "recusar") && !rota[3]) {
    so("POST");
    return respondeConexao(request, env, b, c);
  }

  const integ = await autentica(request, env, waitUntil);

  if (a === "eu" && !b) {
    so("GET");
    return json({
      assessoria: { id: integ.parceiro_id, nome: integ.p_nome, cidade: integ.p_cidade || null, uf: integ.p_uf || null, logo_url: absoluto(url.origin, integ.p_logo ? "arquivos/" + integ.p_logo : "") },
      chave: { prefixo: integ.prefixo, nome: integ.nome || null, ambiente: integ.ambiente, criada_em: isoBanco(integ.criada_em) },
    });
  }
  if (a === "conexao" && !b) {
    so("DELETE");
    await env.DB.prepare("UPDATE integracoes SET revogada_em = ? WHERE id = ?").bind(isoBanco(Date.now()), integ.id).run();
    return json({ ok: true });
  }
  if (a === "provas" && !b) { so("GET"); return listaProvas(env, integ, url); }
  if (a === "provas" && b && !c) {
    so("GET");
    const [l] = await linhasProvas(env, integ, { provaId: b });
    if (!l) throw new Erro(404, "nao_encontrado", "Prova não encontrada ou sem convite para esta assessoria.");
    return json(await formataProva(env, l, integ, url.origin));
  }
  if (a === "convites" && !b) { so("GET"); return listaConvites(env, integ, url); }
  if (a === "convites" && b && (c === "aceitar" || c === "recusar") && !rota[3]) {
    so("POST");
    return respondeConvite(request, env, integ, b, c, url);
  }
  if ((a === "provas" && b && c === "resultados") || a === "envios" || a === "atletas") {
    throw new Erro(501, "nao_implementado", "Esta rota chega na próxima etapa da API v1.");
  }
  throw new Erro(404, "nao_encontrado", "Rota não encontrada.");
}

export async function onRequest({ request, env, params, waitUntil }) {
  if (!env.DB) return json({ erro: { codigo: "config", mensagem: "Banco indisponível." } }, 503);
  const url = new URL(request.url);
  const rota = [].concat(params.rota || []).map((x) => decodeURIComponent(x));
  try {
    return await trata(request, env, rota, url, waitUntil);
  } catch (e) {
    if (e instanceof Erro) return json({ erro: { codigo: e.codigo, mensagem: e.message } }, e.status, e.extra);
    if (/no such (table|column)/i.test(String((e && e.message) || e))) {
      return json({ erro: { codigo: "config", mensagem: "Faltam tabelas no banco: rode d1/migracoes/013-integracoes.sql." } }, 503);
    }
    return json({ erro: { codigo: "erro_interno", mensagem: "Erro no servidor." } }, 500);
  }
}
