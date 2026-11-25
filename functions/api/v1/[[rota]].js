// /api/v1/* — API para parceiros (plataformas de assessoria). Contrato: docs/api-v1-parceiros.md
//
//   GET /api/v1/eu                 quem é a chave
//   GET /api/v1/provas             provas em que a assessoria tem convite (próximas)
//   GET /api/v1/provas/<id>        uma prova
//   (envios, atletas e resultados: etapa 2; respondem 501 por enquanto)
//
// Autenticação: "Authorization: Bearer tdm_live_..." (ou tdm_test_). A chave é criada no
// painel (Parceiros > assessoria > Integração) e o banco guarda só o SHA-256 dela.
// Só servidor chama esta API: não há CORS, então a chave nunca vai para um navegador.

import { RE_CHAVE, sha256 } from "../../_chaves.js";

const LIMITE_MINUTO = 120;
const TAMANHOS_PADRAO = ["PP", "P", "M", "G", "GG", "XG", "XGG"]; // mesmos de js/assessorias.js
const BENEFICIOS = { t: "Tenda da equipe", k: "Kits retirados em lote", f: "Foto oficial da equipe", e: "Ponto de encontro" };

class Erro extends Error {
  constructor(status, codigo, mensagem, extra) { super(mensagem); this.status = status; this.codigo = codigo; this.extra = extra; }
}

function json(corpo, status, extra) {
  return new Response(JSON.stringify(corpo), {
    status: status || 200,
    headers: Object.assign({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }, extra || {}),
  });
}

const lerJson = (t, padrao) => { try { const v = JSON.parse(t); return v == null ? padrao : v; } catch (e) { return padrao; } };
const hojeBR = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const slug = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const absoluto = (origem, caminho) => !caminho ? null : (/^https?:\/\//i.test(caminho) ? caminho : origem + "/" + String(caminho).replace(/^\//, ""));
const linkOuNulo = (s) => (/^https?:\/\//i.test(String(s || "").trim()) ? String(s).trim() : null);
// Datas do banco: "2026-11-25T13:00:00Z" (UTC, sem milissegundos)
const isoBanco = (v) => { const d = new Date(v); return isNaN(d) ? null : d.toISOString().slice(0, 19) + "Z"; };

// "5 km" -> 5000 | "21,1 km" -> 21100 | "800 m" -> 800 | "Caminhada" -> null
function distancia(texto) {
  const m = String(texto || "").match(/(\d+(?:[.,]\d+)?)\s*(km|k|m)\b/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  return /^m$/i.test(m[2]) ? Math.round(n) : Math.round(n * 1000);
}

// "07h30", "7h", "19:00" -> "2027-03-14T07:30:00-03:00"
function largada(data, hora) {
  const m = String(hora || "").match(/(\d{1,2})\s*[h:]\s*(\d{2})?/i);
  if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  return data + "T" + m[1].padStart(2, "0") + ":" + (m[2] || "00") + ":00-03:00";
}

// "R$ 89,90" -> 8990 | 89.9 -> 8990 | "Grátis" -> 0 | "" -> null
function centavos(v) {
  if (typeof v === "number" && isFinite(v)) return Math.round(v * 100);
  const s = String(v || "").trim();
  if (!s) return null;
  if (/gr[aá]tis|gratuit/i.test(s)) return 0;
  const m = s.replace(/\./g, "").match(/(\d+)(?:,(\d{1,2}))?/);
  return m ? Number(m[1]) * 100 + Number((m[2] || "0").padEnd(2, "0")) : null;
}

// ---------- autenticação e limite de uso ----------
async function autentica(request, env, waitUntil) {
  const m = (request.headers.get("Authorization") || "").match(/^Bearer\s+(\S+)$/i);
  if (!m) throw new Erro(401, "chave_ausente", "Envie a chave no cabeçalho Authorization: Bearer <chave>.");
  if (!RE_CHAVE.test(m[1])) throw new Erro(401, "chave_invalida", "Chave inválida.");
  const r = await env.DB.prepare(
    "SELECT i.*, p.nome AS p_nome, p.tipo AS p_tipo, p.situacao AS p_situacao, p.ativo AS p_ativo, p.cidade AS p_cidade, p.uf AS p_uf, p.logo AS p_logo " +
    "FROM integracoes i JOIN parceiros p ON p.id = i.parceiro_id WHERE i.hash = ?"
  ).bind(await sha256(m[1])).first();
  if (!r) throw new Erro(401, "chave_invalida", "Chave inválida.");
  if (r.revogada_em) throw new Erro(401, "chave_revogada", "Esta chave foi cancelada pela Tardim Produções.");
  if (r.p_tipo !== "assessoria" || r.p_situacao !== "aprovado" || !r.p_ativo) {
    throw new Erro(403, "assessoria_inativa", "A assessoria desta chave não está ativa na Tardim Produções.");
  }

  const agora = Math.floor(Date.now() / 1000);
  const uso = await env.DB.prepare(
    "INSERT INTO api_uso (integracao_id, minuto, n) VALUES (?, ?, 1) " +
    "ON CONFLICT (integracao_id, minuto) DO UPDATE SET n = n + 1 RETURNING n"
  ).bind(r.id, Math.floor(agora / 60)).first();
  if (uso && uso.n > LIMITE_MINUTO) {
    throw new Erro(429, "limite_de_uso", "Limite de " + LIMITE_MINUTO + " chamadas por minuto.", { "retry-after": String(60 - (agora % 60)) });
  }
  // Manutenção sem bloquear a resposta: última vez usada (no máximo a cada 10 min) e limpeza do contador
  const passos = [];
  if (!r.usada_em || Date.parse(r.usada_em) < Date.now() - 600000) {
    passos.push(env.DB.prepare("UPDATE integracoes SET usada_em = ? WHERE id = ?").bind(isoBanco(Date.now()), r.id).run());
  }
  if (Math.random() < 0.02) passos.push(env.DB.prepare("DELETE FROM api_uso WHERE minuto < ?").bind(Math.floor(agora / 60) - 10).run());
  if (passos.length) waitUntil(Promise.all(passos).catch(() => {}));
  return r;
}

// ---------- provas ----------
// Uma linha por prova (o convite mais recente da assessoria naquela prova)
async function linhasProvas(env, chave, id) {
  const teste = chave.ambiente === "test";
  const filtros = ["c.parceiro_id = ?1", "p.data >= ?2"];
  if (!teste) filtros.push("p.publicada = 1");
  if (id) filtros.push("p.id = ?3");
  const sql =
    "SELECT p.*, c.id AS c_id, c.cupom AS c_cupom, c.desconto AS c_desconto, c.comissao_pct AS c_comissao, c.cortesias AS c_cortesias, " +
    "c.contrapartida AS c_contrapartida, c.condicoes AS c_condicoes, c.coletiva AS c_coletiva, c.atualizado_em AS c_atualizado " +
    "FROM convites c JOIN provas p ON p.id = c.prova_id WHERE " + filtros.join(" AND ") +
    " ORDER BY p.data, p.id, c.criado_em DESC";
  const q = env.DB.prepare(sql);
  const r = await (id ? q.bind(chave.parceiro_id, hojeBR(), id) : q.bind(chave.parceiro_id, hojeBR())).all();
  const vistas = new Set();
  return r.results.filter((l) => !vistas.has(l.id) && vistas.add(l.id));
}

// Atletas já enviados por esta equipe na prova (planilha pelo site e, depois, API)
async function atletasDaEquipe(env, provaId, nomeEquipe) {
  const r = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM atletas t JOIN inscricoes i ON i.id = t.inscricao_id WHERE i.prova_id = ? AND i.equipe = ? COLLATE NOCASE"
  ).bind(provaId, nomeEquipe).first();
  return (r && r.n) || 0;
}

async function formataProva(env, l, chave, origem) {
  const co = lerJson(l.c_coletiva, {});
  const hoje = hojeBR();
  const percursos = lerJson(l.percursos, []).map((nome) => ({ id: slug(nome) || "percurso", nome: String(nome), distancia_m: distancia(nome) }));
  const limite = Number(co.m) || null;
  const vagas = limite ? Math.max(0, limite - (await atletasDaEquipe(env, l.id, chave.p_nome))) : null;
  const prazo = /^\d{4}-\d{2}-\d{2}$/.test(co.d || "") ? co.d : null;
  const aberta = l.data >= hoje && (!prazo || prazo >= hoje) && vagas !== 0;
  const kit = lerJson(l.kit, { itens: [], retirada: "" });
  const atualizada = [l.atualizado_em, l.c_atualizado].filter(Boolean).sort().pop() || null;
  const base = origem + "/";
  return {
    id: l.id,
    nome: l.nome,
    publicada: !!l.publicada,
    data: l.data,
    largada: largada(l.data, l.hora),
    hora: l.hora || null,
    local: l.local || null,
    url: base + "prova-" + l.id,
    poster_url: absoluto(origem, l.poster),
    resumo: l.resumo || null,
    regulamento_url: linkOuNulo(l.regulamento),
    percurso_mapa_url: linkOuNulo(l.percurso_mapa),
    percursos,
    camisetas: TAMANHOS_PADRAO,
    kit: { itens: Array.isArray(kit.itens) ? kit.itens : [], retirada: kit.retirada || null },
    programacao: lerJson(l.programacao, []).map((x) => ({ hora: String(x[0] || ""), atividade: String(x[1] || "") })),
    precos_publicos: lerJson(l.valores, []).map((v) => ({
      nome: v.nome || "", valor: String(v.valor == null ? "" : v.valor), valor_centavos: centavos(v.valor), detalhe: v.detalhe || null, esgotado: !!v.esgotado,
    })),
    coletiva: {
      aberta,
      prazo: prazo ? prazo + "T23:59:59-03:00" : null,
      prazo_interno_atletas: /^\d{4}-\d{2}-\d{2}$/.test(co.i || "") ? co.i : null,
      limite_atletas: limite,
      vagas_restantes: vagas,
      modos_pagamento: ["assessoria", "ticketsports"],
      pagamento_combinado: co.g || null,
      valor_atleta_centavos: centavos(co.v),
      faixas_desconto: (Array.isArray(co.f) ? co.f : []).filter((x) => Array.isArray(x) && x.length >= 2)
        .map((x) => ({ minimo_atletas: Number(x[0]) || 0, desconto_pct: Number(x[1]) || 0 })),
      cortesias: Number(l.c_cortesias) || 0,
      beneficios: String(co.b || "").split("").filter((k) => BENEFICIOS[k]).map((k) => BENEFICIOS[k]),
      retirada_kits_equipe: co.kt || null,
      ponto_encontro: co.pe || null,
    },
    convite: {
      cupom: l.c_cupom,
      desconto: l.c_desconto || null,
      comissao_pct: Number(l.c_comissao) || 0,
      condicoes: l.c_condicoes || null,
      contrapartida: l.c_contrapartida || null,
      link_atleta: base + "prova-" + l.id + ".html?cupom=" + encodeURIComponent(l.c_cupom),
      link_inscricao: linkOuNulo(l.inscricao),
      link_kit_divulgacao: base + "kit.html?p=" + encodeURIComponent(l.id) + "&c=" + encodeURIComponent(l.c_cupom) + "&n=" + encodeURIComponent(chave.p_nome) +
        (l.c_desconto ? "&d=" + encodeURIComponent(l.c_desconto) : ""),
    },
    atualizada_em: atualizada ? isoBanco(atualizada) : null,
  };
}

function paginacao(url) {
  const limite = Math.min(Math.max(parseInt(url.searchParams.get("limite"), 10) || 100, 1), 500);
  let inicio = 0;
  const c = url.searchParams.get("cursor");
  if (c) {
    inicio = parseInt(atob(c.replace(/-/g, "+").replace(/_/g, "/")), 10);
    if (!(inicio >= 0)) throw new Erro(400, "campo_obrigatorio", "Cursor inválido.");
  }
  return { limite, inicio };
}
const cursor = (n) => btoa(String(n)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function listaProvas(env, chave, url) {
  const { limite, inicio } = paginacao(url);
  const desde = url.searchParams.get("desde");
  if (desde && !/^\d{4}-\d{2}-\d{2}$/.test(desde)) throw new Erro(400, "campo_obrigatorio", "Use desde=AAAA-MM-DD.");
  const mudou = url.searchParams.get("atualizadas_desde");
  const mudouIso = mudou ? isoBanco(mudou) : null;
  if (mudou && !mudouIso) throw new Erro(400, "campo_obrigatorio", "Data inválida em atualizadas_desde.");
  let linhas = await linhasProvas(env, chave, null);
  if (desde) linhas = linhas.filter((l) => l.data >= desde);
  if (mudouIso) linhas = linhas.filter((l) => [l.atualizado_em, l.c_atualizado].some((x) => x && isoBanco(x) >= mudouIso));
  const pagina = linhas.slice(inicio, inicio + limite);
  const origem = new URL(url).origin;
  const provas = [];
  for (const l of pagina) provas.push(await formataProva(env, l, chave, origem));
  return json({ provas, proximo_cursor: inicio + limite < linhas.length ? cursor(inicio + limite) : null });
}

// ---------- rotas ----------
async function trata(request, env, rota, url, waitUntil) {
  const [a, b, c] = rota;
  const chave = await autentica(request, env, waitUntil);
  const m = request.method;

  if (a === "eu" && !b) {
    if (m !== "GET") throw new Erro(405, "metodo", "Use GET.");
    return json({
      assessoria: { id: chave.parceiro_id, nome: chave.p_nome, cidade: chave.p_cidade || null, uf: chave.p_uf || null, logo_url: absoluto(url.origin, chave.p_logo ? "arquivos/" + chave.p_logo : "") },
      chave: { prefixo: chave.prefixo, nome: chave.nome || null, ambiente: chave.ambiente, criada_em: isoBanco(chave.criada_em) },
    });
  }
  if (a === "provas" && !b) {
    if (m !== "GET") throw new Erro(405, "metodo", "Use GET.");
    return listaProvas(env, chave, url);
  }
  if (a === "provas" && b && !c) {
    if (m !== "GET") throw new Erro(405, "metodo", "Use GET.");
    const [l] = await linhasProvas(env, chave, b);
    if (!l) throw new Erro(404, "nao_encontrado", "Prova não encontrada ou sem convite para esta assessoria.");
    return json(await formataProva(env, l, chave, url.origin));
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
    if (/no such table/i.test(String((e && e.message) || e))) {
      return json({ erro: { codigo: "config", mensagem: "Faltam tabelas no banco: rode d1/migracoes/013-integracoes.sql." } }, 503);
    }
    return json({ erro: { codigo: "erro_interno", mensagem: "Erro no servidor." } }, 500);
  }
}
