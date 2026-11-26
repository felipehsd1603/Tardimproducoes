// Inscrição coletiva paga pelo próprio site (tabela pagamentos_site, d1/migracoes/020-pagamentos-site.sql).
//
// A assessoria confere a planilha em assessorias.html (js/assessorias.js) e, em vez de mandar pelo WhatsApp, paga ali
// mesmo: PIX pela API PIX do Banco Central (functions/_lib/pix.ts, Banco Inter) ou cartão pelo Mercado Pago
// (functions/_lib/mercadopago.ts). Só existe com a variável PAGAMENTO_SITE = "ligado".
//
// O preço nunca vem do navegador nem do link: sai do convite no banco (convites.coletiva: v = valor por atleta,
// f = faixas de desconto por volume, m = limite de atletas, d = prazo; convites.cortesias = inscrições grátis).
// A confirmação vem sempre da consulta ao banco ou ao Mercado Pago (tela de pagamento, webhooks e painel), nunca do
// que o webhook ou o endereço de volta dizem. Pago: o envio entra em inscricoes (canal 'site') e os atletas em atletas.

import { sha256, aleatorioHex, cpfValido, deB64url } from "./http.ts";
import { pixConfigurado, criaCobranca, consultaCobranca, ErroPix } from "./pix.ts";
import { mpConfigurado, criaCheckout, pagamentoDaReferencia, ErroMp } from "./mercadopago.ts";
import type { Env, Dados, Convite, PagamentoSite, ComEspera } from "./tipos.ts";

export class ErroPagamento extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

/** A cobrança vale 24 horas (a tesouraria da equipe precisa de tempo); a vaga e as cortesias ficam reservadas nesse tempo. */
export const VALIDADE = 24 * 60 * 60;
export const MAX_ATLETAS = 1000;
const TIPOS_EQUIPE = ["assessoria", "equipe"];
const RE_EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
const agora = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");
const hojeBR = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10); // Brasília, UTC-3
const txt = (v: unknown, max: number): string => (typeof v === "string" || typeof v === "number" ? String(v).trim().replace(/\s+/g, " ") : "").slice(0, max);
export const reais = (c: number): string => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const pagamentoLigado = (env: Env): boolean => String(env.PAGAMENTO_SITE || "").trim().toLowerCase() === "ligado";

/** Cartão: taxa repassada à equipe (% sobre o PIX) e parcelas, das variáveis de ambiente. null = cartão fora do ar. */
export function cartaoConfig(env: Env): { acrescimo_pct: number; parcelas: number } | null {
  if (!mpConfigurado(env)) return null;
  const pct = Math.round(Number(env.PAGAMENTO_CARTAO_ACRESCIMO_PCT || 0) * 100) / 100;
  const parcelas = parseInt(env.PAGAMENTO_CARTAO_PARCELAS || "1", 10) || 1;
  return { acrescimo_pct: pct >= 0 && pct <= 30 ? pct : 0, parcelas: Math.min(12, Math.max(1, parcelas)) };
}

// ---------- convite (o mesmo código do link de assessorias.html, js/convite.js) ----------

const SAL = "tardim-producoes-fazendo-bem-feito";
function fnv(t: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

/** Lê o código do link (prova, equipe e id do parceiro). Só serve para achar o convite: o que vale é o que está no banco. */
export function leConvite(codigo: unknown): { p: string; e: string; a: string } | null {
  const c = String(codigo || "");
  if (c.length > 4000 || c.indexOf(".") < 0) return null;
  const [corpo, assinatura] = c.split(".");
  if (fnv(SAL + corpo) !== assinatura) return null;
  try {
    const d = JSON.parse(new TextDecoder().decode(deB64url(corpo)));
    if (!d || typeof d !== "object" || d.x || !d.p || !d.e) return null;
    return { p: String(d.p).slice(0, 80), e: String(d.e).slice(0, 120), a: String(d.a || "").slice(0, 80) };
  } catch (e) { return null; }
}

type ConviteEquipe = Convite & { parceiro_nome: string; parceiro_tipo: string };

/** Condição de pagamento da equipe nesta prova, já descontado o que foi pago ou está reservado em outros pedidos. */
export interface Condicao {
  convite: ConviteEquipe; prova: { id: string; nome: string; data: string }; equipe: string;
  valorAtleta: number; faixas: [number, number][]; cortesiasRestantes: number; limite: number; vagasRestantes: number | null; prazo: string;
}

export async function condicao(env: Env, codigo: unknown, { excluir, provaNome }: { excluir?: string; provaNome?: string } = {}): Promise<Condicao> {
  const l = leConvite(codigo);
  if (!l) throw new ErroPagamento(404, "Link de convite inválido. Peça o link de novo à Tardim Produções.");
  const cv = await env.DB.prepare(
    "SELECT c.*, p.nome AS parceiro_nome, p.tipo AS parceiro_tipo FROM convites c JOIN parceiros p ON p.id = c.parceiro_id " +
    "WHERE c.prova_id = ? AND p.ativo = 1 AND p.situacao = 'aprovado' AND p.tipo IN ('" + TIPOS_EQUIPE.join("','") + "') AND " +
    (l.a ? "p.id = ?" : "p.nome = ? COLLATE NOCASE") + " ORDER BY c.criado_em DESC"
  ).bind(l.p, l.a || l.e).first<ConviteEquipe>();
  if (!cv) throw new ErroPagamento(404, "O convite desta equipe não está mais ativo. Fale com a Tardim Produções.");
  let co: Dados = {};
  try { co = JSON.parse(cv.coletiva || "{}") || {}; } catch (e) { co = {}; }
  const valorAtleta = Math.round((Number(co.v) || 0) * 100);
  if (!(valorAtleta > 0)) throw new ErroPagamento(409, "O valor por atleta ainda não foi combinado com a Tardim Produções.");
  const pv = await env.DB.prepare("SELECT id, nome, data FROM provas WHERE id = ?").bind(cv.prova_id).first<{ id: string; nome: string; data: string }>()
    .catch(() => null);
  const prova = pv || { id: cv.prova_id, nome: txt(provaNome, 160) || cv.prova_id, data: "" };
  const hoje = hojeBR();
  const prazo = /^\d{4}-\d{2}-\d{2}$/.test(co.d || "") ? co.d : "";
  if (prova.data && prova.data < hoje) throw new ErroPagamento(410, "Esta prova já aconteceu.");
  if (prazo && prazo < hoje) throw new ErroPagamento(410, "O prazo da inscrição coletiva desta equipe terminou.");
  const faixas = (Array.isArray(co.f) ? co.f : [])
    .map((f: unknown): [number, number] => (Array.isArray(f) ? [Math.floor(Number(f[0])) || 0, Number(f[1]) || 0] : [0, 0]))
    .filter((f: [number, number]) => f[0] > 0 && f[1] > 0 && f[1] <= 100).sort((a: [number, number], b: [number, number]) => a[0] - b[0]);
  // Pedidos pagos e os ainda em aberto (a vaga e as cortesias ficam reservadas enquanto o PIX vale)
  const uso = await env.DB.prepare(
    "SELECT COALESCE(SUM(n_atletas), 0) AS n, COALESCE(SUM(cortesias), 0) AS k FROM pagamentos_site WHERE convite_id = ? AND id <> ? " +
    "AND (situacao IN ('pago','cortesia') OR (situacao = 'aguardando' AND expira_em > ?))"
  ).bind(cv.id, excluir || "", agora()).first<{ n: number; k: number }>();
  const limite = Math.max(0, parseInt(co.m, 10) || 0);
  return {
    convite: cv, prova, equipe: cv.parceiro_nome, valorAtleta, faixas, prazo, limite,
    cortesiasRestantes: Math.max(0, (Number(cv.cortesias) || 0) - ((uso && uso.k) || 0)),
    vagasRestantes: limite ? Math.max(0, limite - ((uso && uso.n) || 0)) : null,
  };
}

/** Conta do pedido (centavos). Faixa de desconto pelo número de atletas deste envio, como a página mostra. */
export interface Orcamento {
  atletas: number; cortesias: number; pagantes: number; desconto_pct: number; valor_atleta: number; valor_unit: number;
  valor_cheio: number; desconto: number; acrescimo: number; valor: number;
}
export function orcamento(env: Env, c: Condicao, n: number, forma: "pix" | "cartao"): Orcamento {
  const cortesias = Math.min(c.cortesiasRestantes, n);
  const pagantes = n - cortesias;
  let desconto_pct = 0;
  for (const f of c.faixas) if (n >= f[0]) desconto_pct = f[1];
  const valor_unit = Math.round(c.valorAtleta * (1 - desconto_pct / 100));
  const base = pagantes * valor_unit;
  const cfg = cartaoConfig(env);
  const acrescimo = forma === "cartao" && cfg ? Math.round(base * cfg.acrescimo_pct / 100) : 0;
  const valor_cheio = n * c.valorAtleta;
  return { atletas: n, cortesias, pagantes, desconto_pct, valor_atleta: c.valorAtleta, valor_unit, valor_cheio, desconto: valor_cheio - base, acrescimo, valor: base + acrescimo };
}

// ---------- atletas da planilha (já conferidos no navegador; aqui a conferência de novo) ----------

export interface AtletaPlanilha { nome: string; cpf: string; nasc: string; sexo: string; dist: string; cam: string; email: string; tel: string; equipe: string }

export function validaAtletas(lista: unknown, equipe: string): AtletaPlanilha[] {
  if (!Array.isArray(lista) || !lista.length) throw new ErroPagamento(400, "A planilha não tem atletas.");
  if (lista.length > MAX_ATLETAS) throw new ErroPagamento(400, "No máximo " + MAX_ATLETAS + " atletas por envio.");
  const vistos = new Set<string>();
  return lista.map((x: Dados, i: number): AtletaPlanilha => {
    const erro = (m: string) => new ErroPagamento(400, "Atleta " + (i + 1) + ": " + m);
    x = x && typeof x === "object" ? x : {};
    const cpf = String(x.cpf || "").replace(/\D/g, "");
    const tel = String(x.tel || "").replace(/\D/g, "");
    const a: AtletaPlanilha = {
      nome: txt(x.nome, 120), cpf: cpf.slice(0, 3) + "." + cpf.slice(3, 6) + "." + cpf.slice(6, 9) + "-" + cpf.slice(9),
      nasc: txt(x.nasc, 10), sexo: txt(x.sexo, 1).toUpperCase(), dist: txt(x.dist, 60), cam: txt(x.cam, 10),
      email: txt(x.email, 160).toLowerCase(), tel: txt(x.tel, 20), equipe: txt(x.equipe, 120) || equipe,
    };
    if (!a.nome) throw erro("nome em branco.");
    if (!cpfValido(cpf)) throw erro("CPF inválido.");
    if (vistos.has(cpf)) throw erro("CPF repetido na planilha.");
    vistos.add(cpf);
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(a.nasc)) throw erro("data de nascimento inválida.");
    if (a.sexo !== "F" && a.sexo !== "M") throw erro("sexo deve ser F ou M.");
    if (!a.dist) throw erro("distância em branco.");
    if (!a.cam) throw erro("camiseta em branco.");
    if (!RE_EMAIL.test(a.email)) throw erro("e-mail inválido.");
    if (tel.length < 10 || tel.length > 13) throw erro("telefone com DDD.");
    return a;
  });
}

// ---------- criação do pedido ----------

export interface PedidoPagamento { codigoConvite: string; dados: Dados; site: string }

export async function criaPedido(env: Env, ctx: ComEspera | null | undefined, { codigoConvite, dados: d, site }: PedidoPagamento): Promise<ReturnType<typeof publica> & { codigo: string }> {
  const forma: "pix" | "cartao" = d.forma === "cartao" ? "cartao" : "pix";
  let c = await condicao(env, codigoConvite, { provaNome: d.prova_nome });
  const atletas = validaAtletas(d.atletas, c.equipe);
  const responsavel = txt(d.responsavel, 120), email = txt(d.email, 160).toLowerCase(), telefone = txt(d.telefone, 30);
  if (responsavel.length < 3) throw new ErroPagamento(400, "Informe o nome do responsável.");
  if (telefone.replace(/\D/g, "").length < 10) throw new ErroPagamento(400, "Informe o WhatsApp do responsável com DDD.");
  if (!RE_EMAIL.test(email)) throw new ErroPagamento(400, "Informe o e-mail do responsável (a confirmação chega nele).");
  if (d.aceite !== true) throw new ErroPagamento(400, "Confirme que os atletas autorizaram o envio dos dados.");
  if (forma === "cartao" && !cartaoConfig(env)) throw new ErroPagamento(400, "O pagamento com cartão não está disponível agora. Pague por PIX.");
  const hash = await sha256(JSON.stringify(atletas));

  // Pedidos em aberto da equipe: o mesmo (mesmos atletas, forma e valor) é reaproveitado; os outros deixam de valer
  const abertos = (await env.DB.prepare("SELECT * FROM pagamentos_site WHERE convite_id = ? AND situacao = 'aguardando' AND expira_em > ?")
    .bind(c.convite.id, agora()).all<PagamentoSite>()).results;
  const igual = abertos.find((x) => x.atletas_hash === hash && x.forma === forma);
  if (igual) {
    const c2 = await condicao(env, codigoConvite, { excluir: igual.id, provaNome: d.prova_nome });
    if (orcamento(env, c2, atletas.length, forma).valor === igual.valor) {
      const codigo = aleatorioHex(16);
      await env.DB.prepare("UPDATE pagamentos_site SET codigo_hash = ?, responsavel = ?, telefone = ?, email = ? WHERE id = ?")
        .bind(await sha256(codigo), responsavel, telefone, email, igual.id).run();
      return Object.assign(publica((await linha(env, igual.id)) as PagamentoSite), { codigo });
    }
  }
  for (const x of abertos) await env.DB.prepare("UPDATE pagamentos_site SET situacao = 'expirado' WHERE id = ? AND situacao = 'aguardando'").bind(x.id).run();
  if (abertos.length) c = await condicao(env, codigoConvite, { provaNome: d.prova_nome });

  if (c.vagasRestantes !== null && atletas.length > c.vagasRestantes) {
    throw new ErroPagamento(409, "O convite da equipe tem " + (c.vagasRestantes === 1 ? "1 vaga restante" : c.vagasRestantes + " vagas restantes") + " e a planilha tem " + atletas.length + " atletas.");
  }
  const o = orcamento(env, c, atletas.length, forma);
  const gratis = o.valor === 0;
  const id = crypto.randomUUID();
  const codigo = aleatorioHex(16);
  const txid = gratis || forma === "cartao" ? "" : "tdc" + id.replace(/-/g, "");
  const expira = new Date(Date.now() + VALIDADE * 1000).toISOString().replace(/\.\d+Z$/, "Z");
  const descricao = "Inscrição coletiva " + c.equipe + " - " + c.prova.nome;
  let copia = "", checkout = { id: "", url: "" };
  if (gratis) {
    // tudo em cortesia: não há o que pagar
  } else if (forma === "cartao") {
    try {
      checkout = await criaCheckout(env, {
        referencia: id, centavos: o.valor, titulo: descricao + " (" + atletas.length + (atletas.length === 1 ? " atleta)" : " atletas)"),
        email, nome: responsavel, parcelas: (cartaoConfig(env) as { parcelas: number }).parcelas, expira: expira.replace("Z", ".000-00:00"),
        volta: site + "/assessorias.html?c=" + encodeURIComponent(codigoConvite) + "&pedido=" + id + "&k=" + codigo,
        aviso: /^https:/.test(site) ? site + "/api/pagamento-site/webhook/mp" : undefined,
      });
    } catch (e) {
      if (e instanceof ErroMp) throw new ErroPagamento(502, "Não consegui abrir o pagamento com cartão agora. Tente de novo em alguns minutos ou pague por PIX.");
      throw e;
    }
  } else {
    if (!pixConfigurado(env)) throw new ErroPagamento(503, "O pagamento por PIX ainda não está ativo. Envie a planilha pelo WhatsApp.");
    try {
      copia = (await criaCobranca(env, { txid, centavos: o.valor, expiracao: VALIDADE, descricao })).copiaECola;
    } catch (e) {
      if (e instanceof ErroPix) throw new ErroPagamento(502, "Não consegui gerar o PIX agora. Tente de novo em alguns minutos.");
      throw e;
    }
  }
  await env.DB.prepare(
    "INSERT INTO pagamentos_site (id, codigo_hash, convite_id, parceiro_id, cupom, prova_id, prova_nome, prova_data, equipe, responsavel, telefone, email, " +
    "atletas_json, atletas_hash, n_atletas, cortesias, valor_atleta, desconto_pct, valor_unit, valor_cheio, desconto, acrescimo, valor, forma, situacao, " +
    "txid, pix_copia_cola, mp_preferencia, checkout_url, expira_em, pago_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(id, await sha256(codigo), c.convite.id, c.convite.parceiro_id, c.convite.cupom, c.prova.id, c.prova.nome, c.prova.data, c.equipe, responsavel, telefone, email,
    JSON.stringify(atletas), hash, atletas.length, o.cortesias, o.valor_atleta, o.desconto_pct, o.valor_unit, o.valor_cheio, o.desconto, o.acrescimo, o.valor,
    gratis ? "pix" : forma, gratis ? "cortesia" : "aguardando", txid, copia, checkout.id, checkout.url, gratis ? "" : expira, gratis ? agora() : "").run();
  let l = (await linha(env, id)) as PagamentoSite;
  if (gratis) {
    await registra(env, id);
    l = (await linha(env, id)) as PagamentoSite;
    const envio = avisaConfirmado(env, l).catch(() => {});
    if (ctx) ctx.waitUntil(envio); else await envio;
  }
  return Object.assign(publica(l), { codigo });
}

const linha = (env: Env, id: string) => env.DB.prepare("SELECT * FROM pagamentos_site WHERE id = ?").bind(id).first<PagamentoSite>();

/**
 * Pago: o envio entra em inscricoes (id = id do pedido, canal 'site') e os atletas em atletas, numa transação só.
 * Pode rodar de novo (registrado_em guarda): nunca duplica.
 */
export async function registra(env: Env, id: string): Promise<void> {
  const quando = agora();
  const pronto = "ps.id = ?1 AND ps.registrado_em = '' AND ps.situacao IN ('pago','cortesia')";
  const j = (k: string) => "json_extract(j.value, '$." + k + "')";
  await env.DB.batch([
    env.DB.prepare(
      "INSERT OR IGNORE INTO inscricoes (id, canal, prova_id, prova_nome, convite, equipe, responsavel, telefone, total, origem, parceiro_id, modo_pagamento) " +
      "SELECT ps.id, 'site', ps.prova_id, ps.prova_nome, ps.cupom, ps.equipe, ps.responsavel, ps.telefone, ps.n_atletas, 'site', ps.parceiro_id, ps.forma FROM pagamentos_site ps WHERE " + pronto
    ).bind(id),
    env.DB.prepare(
      "INSERT INTO atletas (inscricao_id, nome, cpf, nascimento, sexo, distancia, camiseta, email, telefone, equipe, origem, prova_id, parceiro_id, situacao, modo_pagamento, atualizado_em) " +
      "SELECT ps.id, " + ["nome", "cpf", "nasc", "sexo", "dist", "cam", "email", "tel", "equipe"].map(j).join(", ") +
      ", 'site', ps.prova_id, ps.parceiro_id, 'inscrito', ps.forma, ?2 FROM pagamentos_site ps, json_each(ps.atletas_json) j WHERE " + pronto + " ORDER BY j.key"
    ).bind(id, quando),
    env.DB.prepare("UPDATE pagamentos_site AS ps SET registrado_em = ?2 WHERE " + pronto).bind(id, quando),
  ]);
}

// ---------- pagamento ----------

/**
 * Consulta o banco (PIX) ou o Mercado Pago (cartão) e atualiza o pedido. No máximo uma consulta a cada 10 s por pedido,
 * salvo forcar. Pago a menos fica aguardando (com valor_pago, para o painel ver). Devolve a linha atualizada.
 */
export async function confere(env: Env, l: PagamentoSite | null, { forcar, ctx }: { forcar?: boolean; ctx?: ComEspera } = {}): Promise<PagamentoSite | null> {
  if (!l) return l;
  if ((l.situacao === "pago" || l.situacao === "cortesia") && !l.registrado_em) {
    await registra(env, l.id); // um registro que falhou no meio: completa agora
    return linha(env, l.id);
  }
  const cartao = l.forma === "cartao";
  if (cartao ? !(l.mp_preferencia && mpConfigurado(env)) : !(l.txid && pixConfigurado(env))) return l;
  const vigente = l.situacao === "aguardando" || (l.situacao === "expirado" && l.expira_em > agora());
  if (!vigente) return l;
  if (!forcar && l.conferido_em && Date.now() - Date.parse(l.conferido_em) < 10000) return l;
  await env.DB.prepare("UPDATE pagamentos_site SET conferido_em = ? WHERE id = ?").bind(agora(), l.id).run();
  let c: { pago: boolean; centavos: number; e2e: string; status: string; mp?: string; horario?: string };
  try {
    if (cartao) {
      const p = await pagamentoDaReferencia(env, l.id);
      c = { pago: p.aprovado, centavos: p.centavos || 0, e2e: "", mp: p.id || "", status: "ATIVA" };
    } else c = await consultaCobranca(env, l.txid);
  } catch (e) { return l; }
  if (c.pago && c.centavos >= l.valor) {
    const r = await env.DB.prepare(
      "UPDATE pagamentos_site SET situacao = 'pago', pago_em = ?, e2e_id = ?, mp_pagamento = ?, valor_pago = ? WHERE id = ? AND situacao IN ('aguardando','expirado')"
    ).bind(c.horario || agora(), c.e2e || "", c.mp || "", c.centavos, l.id).run();
    await registra(env, l.id);
    const novo = await linha(env, l.id);
    if (r.meta && r.meta.changes) {
      const envio = avisaConfirmado(env, novo).catch(() => {});
      if (ctx) ctx.waitUntil(envio); else await envio;
    }
    return novo;
  }
  if (c.pago && c.centavos !== l.valor_pago) {
    await env.DB.prepare("UPDATE pagamentos_site SET valor_pago = ? WHERE id = ?").bind(c.centavos, l.id).run();
  }
  // Vence só se o banco removeu a cobrança ou o prazo passou sem pagamento
  if (l.situacao === "aguardando" && !c.pago && (/^REMOVIDA/.test(c.status || "") || l.expira_em <= agora())) {
    await env.DB.prepare("UPDATE pagamentos_site SET situacao = 'expirado' WHERE id = ? AND situacao = 'aguardando'").bind(l.id).run();
  }
  return linha(env, l.id);
}

/** Painel e webhooks: confere os pedidos em aberto que não foram consultados no último minuto. */
export async function conferePendentes(env: Env, max = 10): Promise<void> {
  if (!pixConfigurado(env) && !mpConfigurado(env)) return;
  const limite = new Date(Date.now() - 60000).toISOString().replace(/\.\d+Z$/, "Z");
  const r = await env.DB.prepare(
    "SELECT * FROM pagamentos_site WHERE (txid <> '' OR mp_preferencia <> '') AND (situacao = 'aguardando' OR (situacao = 'expirado' AND expira_em > ?)) " +
    "AND conferido_em < ? ORDER BY conferido_em LIMIT ?"
  ).bind(agora(), limite, max).all<PagamentoSite>();
  for (const l of r.results) await confere(env, l, { forcar: true });
}

/** Pedido do webhook do PIX (pelo txid) ou do Mercado Pago (pela referência = id do pedido). */
export const pedidoDoTxid = (env: Env, txid: string) => env.DB.prepare("SELECT * FROM pagamentos_site WHERE txid = ?").bind(txid).first<PagamentoSite>();
export const pedidoDoId = (env: Env, id: string) => (/^[0-9a-f-]{36}$/.test(id) ? linha(env, id) : Promise.resolve(null));

// ---------- saída ----------

/** O que a equipe vê do pedido (sem os dados dos atletas). */
export function publica(l: PagamentoSite) {
  const aguardando = l.situacao === "aguardando" && l.expira_em > agora();
  return {
    id: l.id, situacao: aguardando || l.situacao !== "aguardando" ? l.situacao : "expirado",
    prova: { id: l.prova_id, nome: l.prova_nome, data: l.prova_data }, equipe: l.equipe, atletas: l.n_atletas,
    cortesias: l.cortesias, valor_atleta: l.valor_atleta, desconto_pct: l.desconto_pct, valor_unit: l.valor_unit,
    valor_cheio: l.valor_cheio, desconto: l.desconto, acrescimo: l.acrescimo, valor: l.valor, forma: l.forma,
    pix: aguardando && l.forma !== "cartao" && l.pix_copia_cola ? { copia_cola: l.pix_copia_cola, expira_em: l.expira_em } : null,
    cartao: aguardando && l.forma === "cartao" ? { url: l.checkout_url, expira_em: l.expira_em } : null,
    pago_em: l.pago_em,
  };
}

/** Busca pelo id + código (quem fez o pedido). */
export async function pedidoComCodigo(env: Env, id: string, codigo: string | null): Promise<PagamentoSite | null> {
  if (!/^[0-9a-f-]{36}$/.test(String(id || "")) || !/^[0-9a-f]{32}$/.test(String(codigo || ""))) return null;
  const l = await linha(env, id);
  return l && l.codigo_hash === (await sha256(codigo as string)) ? l : null;
}

// ---------- e-mail de confirmação (Resend): para o responsável, com cópia oculta para a Tardim (AVISO_EMAIL) ----------

async function avisaConfirmado(env: Env, l: PagamentoSite | null): Promise<void> {
  if (!env.RESEND_API_KEY || !l || !l.email || l.aviso_email === "ok") return;
  const dataBR = l.prova_data ? l.prova_data.split("-").reverse().join("/") : "";
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.AVISO_REMETENTE || "Tardim Produções <onboarding@resend.dev>",
      to: [l.email],
      ...(env.AVISO_EMAIL ? { bcc: [env.AVISO_EMAIL] } : {}),
      subject: "Inscrição coletiva confirmada · " + l.equipe + " · " + l.prova_nome,
      text: [
        "Olá, " + String(l.responsavel || "").split(" ")[0] + "!", "",
        "A inscrição coletiva da " + l.equipe + " está confirmada" + (l.situacao === "cortesia" ? " (cortesia)" : "") + ".", "",
        "Prova: " + l.prova_nome + (dataBR ? " · " + dataBR : ""),
        "Atletas: " + l.n_atletas + (l.cortesias ? " (" + l.cortesias + (l.cortesias === 1 ? " cortesia)" : " cortesias)") : ""),
        "Valor: " + (l.valor ? reais(l.valor) + (l.forma === "cartao" ? " no cartão" : " no PIX") : "cortesia"), "",
        "Guarde este e-mail. A Tardim Produções combina com você a retirada dos kits.", "",
        "Tardim Produções",
      ].join("\n"),
    }),
  }).catch(() => null);
  await env.DB.prepare("UPDATE pagamentos_site SET aviso_email = ? WHERE id = ?")
    .bind(r && r.ok ? "ok" : "erro: " + (r ? r.status : "sem resposta"), l.id).run();
}
