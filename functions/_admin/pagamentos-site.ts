// Inscrições coletivas pagas pelo site (functions/_lib/pagamento-site.ts): a lista do painel, os atletas de cada pedido
// e o botão "Conferir pagamento" (consulta o banco ou o Mercado Pago na hora).

import { json } from "../_lib/http.ts";
import { confere, conferePendentes } from "../_lib/pagamento-site.ts";
import { Erro } from "./comum.ts";
import type { Env, PagamentoSite } from "../_lib/tipos.ts";

// Sem o código de acompanhamento, o PIX copia e cola e os atletas (estes vêm em pagamentos-site/<id>/atletas)
const CAMPOS = "id, convite_id, parceiro_id, cupom, prova_id, prova_nome, prova_data, equipe, responsavel, telefone, email, n_atletas, cortesias, " +
  "valor_atleta, desconto_pct, valor_unit, valor_cheio, desconto, acrescimo, valor, valor_pago, forma, situacao, txid, e2e_id, mp_pagamento, " +
  "expira_em, pago_em, conferido_em, registrado_em, aviso_email, criado_em";

/** GET pagamentos-site: antes de listar, confere os pedidos em aberto (até 10, os mais antigos sem consulta). */
export async function listaPagamentos(env: Env): Promise<Response> {
  await conferePendentes(env, 10).catch(() => {});
  return json((await env.DB.prepare("SELECT " + CAMPOS + " FROM pagamentos_site ORDER BY criado_em DESC LIMIT 500").all()).results);
}

/** GET pagamentos-site/<id>/atletas */
export async function atletasDoPagamento(env: Env, id: string): Promise<Response> {
  const l = await env.DB.prepare("SELECT atletas_json FROM pagamentos_site WHERE id = ?").bind(id).first<Pick<PagamentoSite, "atletas_json">>();
  if (!l) throw new Erro(404, "Registro não encontrado.");
  return json(JSON.parse(l.atletas_json || "[]"));
}

/** POST pagamentos-site/<id>/conferir */
export async function conferePagamento(env: Env, id: string): Promise<Response> {
  const l = await env.DB.prepare("SELECT * FROM pagamentos_site WHERE id = ?").bind(id).first<PagamentoSite>();
  if (!l) throw new Erro(404, "Registro não encontrado.");
  await confere(env, l, { forcar: true });
  return json(await env.DB.prepare("SELECT " + CAMPOS + " FROM pagamentos_site WHERE id = ?").bind(id).first());
}
