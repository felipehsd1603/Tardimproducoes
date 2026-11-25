// Inscrição direta no site da Tardim (tabela inscricoes_site, d1/migracoes/016-inscricoes-site.sql):
// quem chega pelo link de embaixador ou influenciador (com o cupom) e o próprio parceiro (área do parceiro, com as
// cortesias do convite). Pagamento por PIX (functions/_lib/pix.js); a confirmação vem da consulta da cobrança no banco
// (na tela do QR Code, nas visitas ao site e no botão "Conferir no banco" do painel).

import { sha256, aleatorioHex, cpfValido } from "./http.js";
import { pixConfigurado, criaCobranca, consultaCobranca, ErroPix } from "./pix.js";
import { mpConfigurado, criaCheckout, pagamentoDaReferencia, ErroMp } from "./mercadopago.js";

export class ErroInscricao extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const VALIDADE_PIX = 60 * 60; // a cobrança vale 1 hora; a vaga fica reservada nesse tempo
const TIPOS_COM_LINK = ["embaixador", "influenciador"];
const SEXOS = ["F", "M", "O"];
const RE_EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[a-z]{2,}$/i;
const agora = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");
const hojeBR = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10); // Brasília, UTC-3
const txt = (v, max) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "").slice(0, max);
export const reais = (c) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ---------- configuração da prova ----------

/** Confere e normaliza o JSON do painel. Lança ErroInscricao com a mensagem para quem edita. */
export function validaConfig(c) {
  if (c == null) return {};
  if (typeof c !== "object" || Array.isArray(c)) throw new ErroInscricao(400, "Configuração de inscrição inválida.");
  const lista = (x, max) => (Array.isArray(x) ? x : []).map((s) => txt(String(s == null ? "" : s), max)).filter(Boolean).slice(0, 30);
  const lotes = (Array.isArray(c.lotes) ? c.lotes : []).slice(0, 20).map((l, i) => {
    const nome = txt(l && l.nome, 60) || (i + 1) + "º lote";
    const valor = Math.round(Number(l && l.valor) * 100) / 100;
    if (!(valor >= 0.01 && valor <= 100000)) throw new ErroInscricao(400, "O valor do " + nome + " precisa ser maior que zero.");
    const ate = txt(l && l.ate, 10);
    if (ate && !/^\d{4}-\d{2}-\d{2}$/.test(ate)) throw new ErroInscricao(400, "A data final do " + nome + " é inválida.");
    const vagas = parseInt(l && l.vagas, 10) || 0;
    if (vagas < 0 || vagas > 100000) throw new ErroInscricao(400, "O número de vagas do " + nome + " é inválido.");
    return { nome, valor, ate, vagas };
  });
  // Cartão (Mercado Pago): a taxa vai para o atleta como acréscimo em % sobre o valor do PIX; parcelas com juros do comprador
  const k = c.cartao || {};
  const acrescimo = Math.round(Number(k.acrescimo_pct || 0) * 100) / 100;
  if (!(acrescimo >= 0 && acrescimo <= 30)) throw new ErroInscricao(400, "O acréscimo do cartão precisa estar entre 0% e 30%.");
  const parcelas = parseInt(k.parcelas, 10) || 1;
  if (parcelas < 1 || parcelas > 12) throw new ErroInscricao(400, "O número de parcelas no cartão vai de 1 a 12.");
  const cfg = { aberta: !!c.aberta, modalidades: lista(c.modalidades, 60), camisetas: lista(c.camisetas, 10), lotes, cartao: { ativo: !!k.ativo, acrescimo_pct: acrescimo, parcelas } };
  if (cfg.aberta && !cfg.lotes.length) throw new ErroInscricao(400, "Para abrir a inscrição no site, cadastre pelo menos um lote com valor.");
  if (cfg.aberta && !cfg.modalidades.length) throw new ErroInscricao(400, "Para abrir a inscrição no site, cadastre pelo menos uma modalidade (ex.: Corrida 5 km).");
  return cfg;
}

export function lerConfig(prova) {
  try { return validaConfig(JSON.parse((prova && prova.inscricao_site) || "{}")); } catch (e) { return {}; }
}

// Vagas usadas no lote: pagas, cortesias e PIX ainda dentro do prazo (a vaga fica reservada)
async function usadas(env, provaId, lote) {
  const r = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM inscricoes_site WHERE prova_id = ? AND lote = ? AND (situacao IN ('pago','cortesia') OR (situacao = 'aguardando' AND expira_em > ?))"
  ).bind(provaId, lote, agora()).first();
  return (r && r.n) || 0;
}

/** Lote que vale agora: o primeiro, na ordem, que não passou da data e ainda tem vaga. null = inscrições encerradas. */
export async function loteAtual(env, prova, cfg) {
  const hoje = hojeBR();
  for (const l of cfg.lotes || []) {
    if (l.ate && hoje > l.ate) continue;
    if (l.vagas && (await usadas(env, prova.id, l.nome)) >= l.vagas) continue;
    return { nome: l.nome, centavos: Math.round(l.valor * 100), ate: l.ate };
  }
  return null;
}

/** "10%", "10 %", "R$ 15", "15,50" -> centavos de desconto sobre o valor (nunca passa do valor). */
/** Acréscimo do cartão (centavos) sobre o valor do PIX. */
export const acrescimoCartao = (cfg, centavos) => Math.round(centavos * ((cfg.cartao && cfg.cartao.acrescimo_pct) || 0) / 100);
export const cartaoAtivo = (env, cfg) => !!(cfg.cartao && cfg.cartao.ativo && mpConfigurado(env));

export function descontoDe(texto, centavos) {
  const t = String(texto || "").replace(/\s/g, "");
  let d = 0;
  const pct = /^(\d+(?:[.,]\d+)?)%/.exec(t);
  if (pct) d = Math.round(centavos * Math.min(100, Number(pct[1].replace(",", "."))) / 100);
  else {
    const rs = /^(?:R\$)?(\d+(?:[.,]\d{1,2})?)$/i.exec(t);
    if (rs) d = Math.round(Number(rs[1].replace(",", ".")) * 100);
  }
  return Math.max(0, Math.min(centavos, d));
}

/** Prova publicada com inscrição no site aberta. */
export async function provaAberta(env, provaId) {
  const prova = await env.DB.prepare("SELECT * FROM provas WHERE id = ? AND publicada = 1").bind(String(provaId || "")).first();
  const cfg = lerConfig(prova);
  if (!prova || !cfg.aberta) throw new ErroInscricao(404, "A inscrição pelo site não está aberta para esta prova.");
  if (prova.data < hojeBR()) throw new ErroInscricao(410, "Esta prova já aconteceu.");
  return { prova, cfg };
}

/** Convite do cupom (embaixador ou influenciador aprovado e ativo, na prova). */
export async function conviteDoCupom(env, provaId, cupom) {
  const c = String(cupom || "").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40);
  if (!c) return null;
  return env.DB.prepare(
    "SELECT c.*, p.nome AS parceiro_nome, p.tipo AS parceiro_tipo FROM convites c JOIN parceiros p ON p.id = c.parceiro_id " +
    "WHERE UPPER(c.cupom) = ? AND c.prova_id = ? AND p.ativo = 1 AND p.situacao = 'aprovado' AND p.tipo IN ('" + TIPOS_COM_LINK.join("','") + "')"
  ).bind(c, provaId).first();
}

// ---------- dados do atleta ----------

export function validaAtleta(d, cfg) {
  d = d || {};
  const a = {
    nome: txt(d.nome, 120), cpf: String(d.cpf || "").replace(/\D/g, ""), email: txt(d.email, 120).toLowerCase(),
    telefone: String(d.telefone || "").replace(/\D/g, "").slice(0, 13), nascimento: txt(d.nascimento, 10),
    sexo: txt(d.sexo, 1).toUpperCase(), camiseta: txt(d.camiseta, 10), modalidade: txt(d.modalidade, 60),
  };
  if (a.nome.split(" ").length < 2 || a.nome.length < 5) throw new ErroInscricao(400, "Informe o nome completo.");
  if (!cpfValido(a.cpf)) throw new ErroInscricao(400, "CPF inválido.");
  if (!RE_EMAIL.test(a.email)) throw new ErroInscricao(400, "E-mail inválido.");
  if (a.telefone.length < 10) throw new ErroInscricao(400, "Informe um telefone com DDD.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.nascimento) || a.nascimento < "1900-01-01" || a.nascimento > hojeBR()) throw new ErroInscricao(400, "Data de nascimento inválida.");
  if (SEXOS.indexOf(a.sexo) < 0) throw new ErroInscricao(400, "Informe o sexo.");
  if ((cfg.modalidades || []).indexOf(a.modalidade) < 0) throw new ErroInscricao(400, "Escolha a modalidade.");
  if ((cfg.camisetas || []).length && cfg.camisetas.indexOf(a.camiseta) < 0) throw new ErroInscricao(400, "Escolha o tamanho da camiseta.");
  if (d.aceite !== true) throw new ErroInscricao(400, "É preciso aceitar o regulamento da prova.");
  return a;
}

// ---------- criação ----------

/**
 * Cria a inscrição. cortesia = true: sem pagamento (cortesia do convite do parceiro).
 * Devolve a inscrição pública com { codigo } (a pessoa guarda para acompanhar o pagamento).
 */
export async function criaInscricao(env, ctx, { prova, cfg, convite, origem, atleta, cortesia, site, forma }) {
  const ja = await env.DB.prepare(
    "SELECT * FROM inscricoes_site WHERE prova_id = ? AND cpf = ? AND (situacao IN ('pago','cortesia') OR (situacao = 'aguardando' AND expira_em > ?)) ORDER BY criado_em DESC"
  ).bind(prova.id, atleta.cpf, agora()).all();
  if (ja.results.some((x) => x.situacao !== "aguardando")) throw new ErroInscricao(409, "Este CPF já está inscrito nesta prova.");

  const lote = await loteAtual(env, prova, cfg);
  if (!lote) throw new ErroInscricao(410, "As inscrições desta prova estão encerradas ou esgotadas.");
  const desconto = cortesia ? lote.centavos : (convite ? descontoDe(convite.desconto, lote.centavos) : 0);
  const gratis = lote.centavos - desconto === 0;
  forma = gratis ? "pix" : (forma === "cartao" ? "cartao" : "pix");
  if (forma === "cartao" && !cartaoAtivo(env, cfg)) throw new ErroInscricao(400, "O pagamento com cartão não está disponível para esta prova.");
  const acrescimo = forma === "cartao" ? acrescimoCartao(cfg, lote.centavos - desconto) : 0;
  const valor = lote.centavos - desconto + acrescimo;

  // Pagamento em aberto do mesmo CPF: mesmo valor e mesma forma, reaproveita; senão, o antigo deixa de valer
  const aberta = ja.results.find((x) => x.situacao === "aguardando");
  const codigo = aleatorioHex(16);
  if (aberta && aberta.valor === valor && aberta.forma === forma && !gratis) {
    await env.DB.prepare(
      "UPDATE inscricoes_site SET codigo_hash = ?, nome = ?, email = ?, telefone = ?, nascimento = ?, sexo = ?, camiseta = ?, modalidade = ? WHERE id = ?"
    ).bind(await sha256(codigo), atleta.nome, atleta.email, atleta.telefone, atleta.nascimento, atleta.sexo, atleta.camiseta, atleta.modalidade, aberta.id).run();
    const l = await env.DB.prepare("SELECT * FROM inscricoes_site WHERE id = ?").bind(aberta.id).first();
    return Object.assign(publica(l, prova), { codigo });
  }
  if (aberta) await env.DB.prepare("UPDATE inscricoes_site SET situacao = 'expirado' WHERE id = ?").bind(aberta.id).run();

  const id = crypto.randomUUID();
  const txid = gratis || forma === "cartao" ? "" : "tdm" + id.replace(/-/g, "");
  const expira = new Date(Date.now() + VALIDADE_PIX * 1000).toISOString().replace(/\.\d+Z$/, "Z");
  let copia = "", checkout = { id: "", url: "" };
  if (forma === "cartao") {
    try {
      checkout = await criaCheckout(env, {
        referencia: id, centavos: valor, titulo: "Inscrição " + prova.nome + " - " + atleta.modalidade, email: atleta.email, nome: atleta.nome,
        cpf: atleta.cpf, parcelas: cfg.cartao.parcelas, volta: (site || "") + "/inscricao.html?retorno=cartao", expira: expira.replace("Z", ".000-00:00"),
      });
    } catch (e) {
      if (e instanceof ErroMp) throw new ErroInscricao(502, "Não consegui abrir o pagamento com cartão agora. Tente de novo em alguns minutos ou pague por PIX.");
      throw e;
    }
  } else if (!gratis) {
    if (!pixConfigurado(env)) throw new ErroInscricao(503, "O pagamento por PIX ainda não está ativo. Tente mais tarde ou fale com a Tardim pelo WhatsApp.");
    try {
      copia = (await criaCobranca(env, {
        txid, centavos: valor, expiracao: VALIDADE_PIX, cpf: atleta.cpf, nome: atleta.nome,
        descricao: "Inscrição " + prova.nome + " - " + atleta.modalidade,
      })).copiaECola;
    } catch (e) {
      if (e instanceof ErroPix) throw new ErroInscricao(502, "Não consegui gerar o PIX agora. Tente de novo em alguns minutos.");
      throw e;
    }
  }
  const situacao = gratis ? "cortesia" : "aguardando";
  await env.DB.prepare(
    "INSERT INTO inscricoes_site (id, codigo_hash, prova_id, convite_id, parceiro_id, cupom, origem, nome, cpf, email, telefone, nascimento, sexo, camiseta, modalidade, " +
    "lote, valor_cheio, desconto, valor, situacao, txid, pix_copia_cola, expira_em, pago_em, forma, acrescimo, mp_preferencia, checkout_url) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(id, await sha256(codigo), prova.id, convite ? convite.id : "", convite ? convite.parceiro_id : "", convite ? convite.cupom : "", origem,
    atleta.nome, atleta.cpf, atleta.email, atleta.telefone, atleta.nascimento, atleta.sexo, atleta.camiseta, atleta.modalidade,
    lote.nome, lote.centavos, desconto, valor, situacao, txid, copia,
    gratis ? "" : expira, gratis ? agora() : "", forma, acrescimo, checkout.id, checkout.url).run();
  const l = await env.DB.prepare("SELECT * FROM inscricoes_site WHERE id = ?").bind(id).first();
  if (gratis && ctx) ctx.waitUntil(avisaConfirmada(env, l, prova, site).catch(() => {}));
  return Object.assign(publica(l, prova), { codigo });
}

// ---------- pagamento ----------

/**
 * Consulta a cobrança no banco e atualiza a inscrição (pago ou expirado). No máximo uma consulta a cada 10 s
 * por inscrição, salvo forcar. Devolve a linha atualizada.
 */
export async function confere(env, l, { forcar, ctx, site } = {}) {
  if (!l) return l;
  const cartao = l.forma === "cartao";
  if (cartao ? !(l.mp_preferencia && mpConfigurado(env)) : !(l.txid && pixConfigurado(env))) return l;
  const vigente = l.situacao === "aguardando" || (l.situacao === "expirado" && l.expira_em > agora());
  if (!vigente) return l;
  if (!forcar && l.conferido_em && Date.now() - Date.parse(l.conferido_em) < 10000) return l;
  await env.DB.prepare("UPDATE inscricoes_site SET conferido_em = ? WHERE id = ?").bind(agora(), l.id).run();
  let c;
  try {
    if (cartao) {
      const p = await pagamentoDaReferencia(env, l.id);
      c = { pago: p.aprovado, centavos: p.centavos || 0, e2e: "", mp: p.id || "", status: "ATIVA" };
    } else c = await consultaCobranca(env, l.txid);
  } catch (e) { return l; }
  if (c.pago && c.centavos >= l.valor) {
    const r = await env.DB.prepare(
      "UPDATE inscricoes_site SET situacao = 'pago', pago_em = ?, e2e_id = ?, mp_pagamento = ? WHERE id = ? AND situacao IN ('aguardando','expirado')"
    ).bind(c.horario || agora(), c.e2e || "", c.mp || "", l.id).run();
    const novo = await env.DB.prepare("SELECT * FROM inscricoes_site WHERE id = ?").bind(l.id).first();
    if (r.meta && r.meta.changes) {
      const prova = await env.DB.prepare("SELECT * FROM provas WHERE id = ?").bind(l.prova_id).first();
      const envio = avisaConfirmada(env, novo, prova, site).catch(() => {});
      if (ctx) ctx.waitUntil(envio); else await envio;
    }
    return novo;
  }
  // Vence só se o banco removeu a cobrança ou o prazo passou sem pagamento (pago a menos fica aguardando, para o painel ver)
  if (l.situacao === "aguardando" && !c.pago && (/^REMOVIDA/.test(c.status || "") || l.expira_em <= agora())) {
    await env.DB.prepare("UPDATE inscricoes_site SET situacao = 'expirado' WHERE id = ? AND situacao = 'aguardando'").bind(l.id).run();
    return env.DB.prepare("SELECT * FROM inscricoes_site WHERE id = ?").bind(l.id).first();
  }
  return l;
}

/** Em segundo plano (visitas ao site): confere alguns PIX em aberto que não foram consultados no último minuto. */
export async function conferePendentes(env, max) {
  if (!pixConfigurado(env) && !mpConfigurado(env)) return;
  const limite = new Date(Date.now() - 60000).toISOString().replace(/\.\d+Z$/, "Z");
  const r = await env.DB.prepare(
    "SELECT * FROM inscricoes_site WHERE (txid <> '' OR mp_preferencia <> '') AND (situacao = 'aguardando' OR (situacao = 'expirado' AND expira_em > ?)) AND conferido_em < ? ORDER BY conferido_em LIMIT ?"
  ).bind(agora(), limite, max || 5).all();
  for (const l of r.results) await confere(env, l, { forcar: true });
}

// ---------- saída ----------

const PRIMEIRO = (n) => String(n || "").split(" ")[0];
/** O que a própria pessoa vê da inscrição (sem CPF, e-mail ou telefone). */
export function publica(l, prova) {
  const aguardando = l.situacao === "aguardando" && l.expira_em > agora();
  return {
    id: l.id, situacao: aguardando || l.situacao !== "aguardando" ? l.situacao : "expirado",
    prova: prova ? { id: prova.id, nome: prova.nome, data: prova.data, local: prova.local } : { id: l.prova_id },
    nome: PRIMEIRO(l.nome), modalidade: l.modalidade, camiseta: l.camiseta, lote: l.lote,
    valor_cheio: l.valor_cheio, desconto: l.desconto, acrescimo: l.acrescimo || 0, valor: l.valor, cupom: l.cupom, forma: l.forma || "pix",
    pix: aguardando && l.forma !== "cartao" ? { copia_cola: l.pix_copia_cola, expira_em: l.expira_em } : null,
    cartao: aguardando && l.forma === "cartao" ? { url: l.checkout_url, expira_em: l.expira_em } : null,
    pago_em: l.pago_em,
  };
}

/** Busca pela id + código (quem fez a inscrição). */
export async function inscricaoComCodigo(env, id, codigo) {
  if (!/^[0-9a-f-]{36}$/.test(String(id || "")) || !/^[0-9a-f]{32}$/.test(String(codigo || ""))) return null;
  const l = await env.DB.prepare("SELECT * FROM inscricoes_site WHERE id = ?").bind(id).first();
  return l && l.codigo_hash === (await sha256(codigo)) ? l : null;
}

// ---------- e-mail de confirmação (Resend) ----------

async function avisaConfirmada(env, l, prova, site) {
  if (!env.RESEND_API_KEY || !l || l.aviso_email === "ok") return;
  const dataBR = prova && prova.data ? prova.data.split("-").reverse().join("/") : "";
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.AVISO_REMETENTE || "Tardim Produções <onboarding@resend.dev>",
      to: [l.email],
      subject: "Inscrição confirmada · " + (prova ? prova.nome : "Tardim Produções"),
      text: [
        "Olá, " + PRIMEIRO(l.nome) + "!", "",
        "Sua inscrição está confirmada" + (l.situacao === "cortesia" ? " (cortesia)" : "") + ".", "",
        "Prova: " + (prova ? prova.nome : l.prova_id) + (dataBR ? " · " + dataBR : "") + (prova && prova.local ? " · " + prova.local : ""),
        "Modalidade: " + l.modalidade + (l.camiseta ? " · Camiseta " + l.camiseta : ""),
        "Valor: " + (l.valor ? reais(l.valor) + (l.forma === "cartao" ? " no cartão" : " no PIX") : "cortesia") + (l.desconto && l.valor ? " (desconto de " + reais(l.desconto) + ")" : ""), "",
        site ? "Página da prova: " + site + "/prova-" + l.prova_id + ".html" : "", "",
        "Guarde este e-mail. Informações sobre a retirada do kit chegam perto da prova.", "",
        "Tardim Produções",
      ].filter((x, i, a) => x || a[i - 1]).join("\n"),
    }),
  }).catch(() => null);
  await env.DB.prepare("UPDATE inscricoes_site SET aviso_email = ? WHERE id = ?")
    .bind(r && r.ok ? "ok" : "erro: " + (r ? r.status : "sem resposta"), l.id).run();
}
