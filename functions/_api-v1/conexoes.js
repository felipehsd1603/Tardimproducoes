// Conexão por convite (docs/api-v1-parceiros.md, "Conexão"): a plataforma aceita ou recusa o
// convite assinado com o código de uso único; no aceite a chave nasce e volta só nesta resposta.

import { sha256, novaChave, novoSegredo } from "../_lib/chaves.js";
import { json } from "../_lib/http.js";
import { isoBanco, hojeBR } from "./provas.js";
import { ErroApi, corpoJson, texto, contaUso, LIMITE_CONEXAO_IP } from "./comum.js";

const ABERTAS = ["enviado", "enviando", "falhou"];

/** POST /conexoes/<id>/aceitar | /recusar (sem chave: autentica pelo código do convite) */
export async function respondeConexao(request, env, id, acao) {
  await contaUso(env, "ip:" + (request.headers.get("CF-Connecting-IP") || "local"), LIMITE_CONEXAO_IP);
  const d = await corpoJson(request);
  const cx = await env.DB.prepare(
    "SELECT x.*, p.nome AS p_nome, p.tipo AS p_tipo, p.situacao AS p_situacao, p.ativo AS p_ativo FROM conexoes x JOIN parceiros p ON p.id = x.parceiro_id WHERE x.id = ?"
  ).bind(id).first();
  if (!cx) throw new ErroApi(404, "nao_encontrado", "Convite não encontrado.");
  if (!/^[0-9a-f]{64}$/.test(String(d.codigo || "")) || (await sha256(d.codigo)) !== cx.codigo_hash) {
    throw new ErroApi(401, "codigo_invalido", "Código do convite inválido.");
  }
  if (!ABERTAS.includes(cx.situacao)) throw new ErroApi(409, "convite_respondido", "Este convite já foi respondido ou cancelado.");
  if (Date.parse(cx.expira_em) < Date.now()) throw new ErroApi(409, "convite_expirado", "Este convite expirou. Peça um novo à Tardim Produções.");
  const agora = isoBanco(Date.now());

  if (acao === "recusar") {
    await env.DB.prepare("UPDATE conexoes SET situacao = 'recusado', motivo = ?, respondido_por = ?, respondido_em = ? WHERE id = ?")
      .bind(texto(d.motivo, 300), texto(d.recusado_por, 120), agora, id).run();
    return json({ ok: true });
  }

  if (cx.p_tipo !== "assessoria" || cx.p_situacao !== "aprovado" || !cx.p_ativo) {
    throw new ErroApi(403, "assessoria_inativa", "A assessoria deste convite não está ativa na Tardim Produções.");
  }
  // O endereço de avisos precisa ser da mesma plataforma convidada
  let webhook = "";
  if (d.webhook_url) {
    let u;
    try { u = new URL(String(d.webhook_url)); } catch (e) { throw new ErroApi(400, "campo_obrigatorio", "webhook_url inválido."); }
    if (u.origin !== cx.plataforma_url) throw new ErroApi(400, "campo_obrigatorio", "webhook_url precisa ser do mesmo endereço convidado (" + cx.plataforma_url + ").");
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

/** DELETE /conexao: a plataforma desconecta (a chave deixa de valer) */
export async function desconecta(env, integ) {
  await env.DB.prepare("UPDATE integracoes SET revogada_em = ? WHERE id = ?").bind(isoBanco(Date.now()), integ.id).run();
  return json({ ok: true });
}
