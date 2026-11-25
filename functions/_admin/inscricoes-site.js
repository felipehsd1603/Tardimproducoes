// Painel > Inscrições no site: lista, conferir o PIX no banco e cancelar (functions/_lib/inscricoes-site.js).

import { json } from "../_lib/http.js";
import { confere } from "../_lib/inscricoes-site.js";
import { Erro } from "./comum.js";

const CAMPOS = "i.id, i.prova_id, i.convite_id, i.parceiro_id, i.cupom, i.origem, i.nome, i.cpf, i.email, i.telefone, i.nascimento, i.sexo, " +
  "i.camiseta, i.modalidade, i.lote, i.valor_cheio, i.desconto, i.acrescimo, i.valor, i.forma, i.situacao, i.txid, i.e2e_id, i.mp_preferencia, i.mp_pagamento, " +
  "i.expira_em, i.pago_em, i.conferido_em, i.aviso_email, i.criado_em";

export async function listaInscricoesSite(env, url) {
  const prova = url.searchParams.get("prova") || "";
  const r = await env.DB.prepare(
    "SELECT " + CAMPOS + ", p.nome AS parceiro_nome, p.tipo AS parceiro_tipo, c.comissao_pct FROM inscricoes_site i " +
    "LEFT JOIN parceiros p ON p.id = i.parceiro_id LEFT JOIN convites c ON c.id = i.convite_id " +
    "WHERE (? = '' OR i.prova_id = ?) ORDER BY i.criado_em DESC LIMIT 5000"
  ).bind(prova, prova).all();
  return json(r.results);
}

async function uma(env, id) {
  const l = await env.DB.prepare("SELECT * FROM inscricoes_site WHERE id = ?").bind(id).first();
  if (!l) throw new Erro(404, "Inscrição não encontrada.");
  return l;
}
const semSegredos = (l) => { const o = Object.assign({}, l); delete o.codigo_hash; delete o.pix_copia_cola; delete o.checkout_url; return o; };

/** Consulta a cobrança no banco agora (sem esperar a pessoa ou as visitas ao site). */
export async function confereInscricaoSite(env, id, url) {
  const l = await confere(env, await uma(env, id), { forcar: true, site: url.origin });
  return json(semSegredos(l));
}

/** Cancela (a devolução de um PIX ou cartão já pago é feita no banco ou no Mercado Pago). */
export async function cancelaInscricaoSite(env, id) {
  await uma(env, id);
  await env.DB.prepare("UPDATE inscricoes_site SET situacao = 'cancelado' WHERE id = ?").bind(id).run();
  return json(semSegredos(await uma(env, id)));
}
