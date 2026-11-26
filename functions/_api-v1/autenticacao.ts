// Autenticação da API v1: "Authorization: Bearer tdm_live_..." (ou tdm_test_).
// A chave é comparada pelo SHA-256 (tabela integracoes); a assessoria precisa estar aprovada e ativa.

import { RE_CHAVE, sha256 } from "../_lib/chaves.ts";
import { isoBanco } from "./provas.ts";
import { ErroApi, contaUso, LIMITE_MINUTO } from "./comum.ts";
import type { Env, IntegracaoComParceiro } from "../_lib/tipos.ts";

export async function autentica(request: Request, env: Env, waitUntil: (p: Promise<unknown>) => void): Promise<IntegracaoComParceiro> {
  const m = (request.headers.get("Authorization") || "").match(/^Bearer\s+(\S+)$/i);
  if (!m) throw new ErroApi(401, "chave_ausente", "Envie a chave no cabeçalho Authorization: Bearer <chave>.");
  if (!RE_CHAVE.test(m[1])) throw new ErroApi(401, "chave_invalida", "Chave inválida.");
  const r = await env.DB.prepare(
    "SELECT i.*, p.nome AS p_nome, p.tipo AS p_tipo, p.situacao AS p_situacao, p.ativo AS p_ativo, p.cidade AS p_cidade, p.uf AS p_uf, p.logo AS p_logo " +
    "FROM integracoes i JOIN parceiros p ON p.id = i.parceiro_id WHERE i.hash = ?"
  ).bind(await sha256(m[1])).first<IntegracaoComParceiro>();
  if (!r) throw new ErroApi(401, "chave_invalida", "Chave inválida.");
  if (r.revogada_em) throw new ErroApi(401, "chave_revogada", "Esta conexão foi encerrada.");
  if (r.p_tipo !== "assessoria" || r.p_situacao !== "aprovado" || !r.p_ativo) {
    throw new ErroApi(403, "assessoria_inativa", "A assessoria desta chave não está ativa na Tardim Produções.");
  }
  const agora = await contaUso(env, r.id, LIMITE_MINUTO);
  // Manutenção sem atrasar a resposta: último uso (no máximo a cada 10 min) e limpeza do contador
  const passos: Promise<D1Result>[] = [];
  if (!r.usada_em || Date.parse(r.usada_em) < Date.now() - 600000) {
    passos.push(env.DB.prepare("UPDATE integracoes SET usada_em = ? WHERE id = ?").bind(isoBanco(Date.now()), r.id).run());
  }
  if (Math.random() < 0.02) passos.push(env.DB.prepare("DELETE FROM api_uso WHERE minuto < ?").bind(Math.floor(agora / 60) - 10).run());
  if (passos.length) waitUntil(Promise.all(passos).catch(() => {}));
  return r;
}
