// Provas e convites no formato da API v1 (docs/api-v1-parceiros.md).
// Usado pelas rotas (functions/api/v1) e pelos avisos às plataformas (functions/_api-v1/avisos.js).
// "integ" = linha de integracoes com p_nome (nome da assessoria), parceiro_id e ambiente.

const TAMANHOS_PADRAO = ["PP", "P", "M", "G", "GG", "XG", "XGG"]; // mesmos de js/assessorias.js
const BENEFICIOS = { t: "Tenda da equipe", k: "Kits retirados em lote", f: "Foto oficial da equipe", e: "Ponto de encontro" };

export const lerJson = (t, padrao) => { try { const v = JSON.parse(t); return v == null ? padrao : v; } catch (e) { return padrao; } };
export const hojeBR = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const slug = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
export const absoluto = (origem, caminho) => !caminho ? null : (/^https?:\/\//i.test(caminho) ? caminho : origem + "/" + String(caminho).replace(/^\//, ""));
const linkOuNulo = (s) => (/^https?:\/\//i.test(String(s || "").trim()) ? String(s).trim() : null);
// Datas do banco: "2026-11-25T13:00:00Z" (UTC, sem milissegundos)
export const isoBanco = (v) => { if (!v) return null; const d = new Date(v); return isNaN(d) ? null : d.toISOString().slice(0, 19) + "Z"; };

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

// Colunas do convite que acompanham a linha da prova (prefixo c_)
const COLUNAS_CONVITE =
  "c.id AS c_id, c.cupom AS c_cupom, c.desconto AS c_desconto, c.comissao_pct AS c_comissao, c.cortesias AS c_cortesias, " +
  "c.contrapartida AS c_contrapartida, c.condicoes AS c_condicoes, c.coletiva AS c_coletiva, c.atualizado_em AS c_atualizado, " +
  "c.api_situacao AS c_situacao, c.api_modo_pagamento AS c_modo, c.api_motivo AS c_motivo, c.api_respondido_em AS c_respondido";

// Provas futuras com convite da assessoria; chave de teste vê também as não publicadas.
// Uma linha por prova (o convite mais recente), ou só a do convite/prova pedido.
export async function linhasProvas(env, integ, filtro) {
  filtro = filtro || {};
  const args = [integ.parceiro_id, hojeBR()];
  const onde = ["c.parceiro_id = ?1", "p.data >= ?2"];
  if (integ.ambiente !== "test") onde.push("p.publicada = 1");
  if (filtro.provaId) { args.push(filtro.provaId); onde.push("p.id = ?" + args.length); }
  if (filtro.conviteId) { args.push(filtro.conviteId); onde.push("c.id = ?" + args.length); }
  if (filtro.situacao) { args.push(filtro.situacao); onde.push("c.api_situacao = ?" + args.length); }
  const r = await env.DB.prepare(
    "SELECT p.*, " + COLUNAS_CONVITE + " FROM convites c JOIN provas p ON p.id = c.prova_id WHERE " + onde.join(" AND ") +
    " ORDER BY p.data, p.id, c.criado_em DESC"
  ).bind(...args).all();
  if (filtro.todosConvites) return r.results;
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

export function conviteApi(l) {
  return {
    id: l.c_id,
    prova_id: l.id,
    situacao: l.c_situacao || "pendente",
    modo_pagamento: l.c_modo || null,
    motivo: l.c_motivo || null,
    respondido_em: isoBanco(l.c_respondido),
    cupom: l.c_cupom,
    desconto: l.c_desconto || null,
    comissao_pct: Number(l.c_comissao) || 0,
    cortesias: Number(l.c_cortesias) || 0,
    condicoes: l.c_condicoes || null,
    contrapartida: l.c_contrapartida || null,
  };
}

export async function formataProva(env, l, integ, origem) {
  const co = lerJson(l.c_coletiva, {});
  const hoje = hojeBR();
  const percursos = lerJson(l.percursos, []).map((nome) => ({ id: slug(nome) || "percurso", nome: String(nome), distancia_m: distancia(nome) }));
  const limite = Number(co.m) || null;
  const vagas = limite ? Math.max(0, limite - (await atletasDaEquipe(env, l.id, integ.p_nome))) : null;
  const prazo = /^\d{4}-\d{2}-\d{2}$/.test(co.d || "") ? co.d : null;
  const aberta = l.data >= hoje && (!prazo || prazo >= hoje) && vagas !== 0;
  const kit = lerJson(l.kit, { itens: [], retirada: "" });
  const atualizada = [l.atualizado_em, l.c_atualizado].filter(Boolean).sort().pop() || null;
  const base = origem + "/";
  const cv = conviteApi(l);
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
      cortesias: cv.cortesias,
      beneficios: String(co.b || "").split("").filter((k) => BENEFICIOS[k]).map((k) => BENEFICIOS[k]),
      retirada_kits_equipe: co.kt || null,
      ponto_encontro: co.pe || null,
    },
    convite: Object.assign({}, cv, {
      prova_id: undefined,
      link_atleta: base + "prova-" + l.id + ".html?cupom=" + encodeURIComponent(l.c_cupom),
      link_inscricao: linkOuNulo(l.inscricao),
      link_kit_divulgacao: base + "kit.html?p=" + encodeURIComponent(l.id) + "&c=" + encodeURIComponent(l.c_cupom) + "&n=" + encodeURIComponent(integ.p_nome) +
        (l.c_desconto ? "&d=" + encodeURIComponent(l.c_desconto) : ""),
    }),
    atualizada_em: isoBanco(atualizada),
  };
}

// Integração valendo de uma assessoria, com o nome dela (formato que formataProva espera)
export async function integracaoAtiva(env, parceiroId) {
  return env.DB.prepare(
    "SELECT i.*, p.nome AS p_nome FROM integracoes i JOIN parceiros p ON p.id = i.parceiro_id " +
    "WHERE i.parceiro_id = ? AND i.revogada_em = '' AND p.situacao = 'aprovado' AND p.ativo = 1 ORDER BY i.criada_em DESC LIMIT 1"
  ).bind(parceiroId).first();
}
