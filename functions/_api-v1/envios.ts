// Inscrição coletiva enviada pelo sistema da assessoria (docs/api-v1-parceiros.md):
//   POST /api/v1/envios          recebe atletas (novos ou alterados) e cancelamentos
//   GET  /api/v1/envios/<id>     um envio e a situação dos atletas dele
//   GET  /api/v1/atletas         situação de todos os atletas da assessoria numa prova
// Cada envio vira uma linha em inscricoes (origem 'api'); cada atleta é único por
// prova + assessoria + id_externo: reenviar o mesmo id_externo atualiza.

import { sha256, cpfValido } from "../_lib/http.ts";
import { linhasProvas, formataProva, isoBanco } from "./provas.ts";
import { atletaApi } from "./avisos.ts";

import { ErroApi } from "./comum.ts";

const MAX_ATLETAS = 1000;
const ATIVAS = ["recebido", "aguardando_pagamento", "inscrito"];
const txt = (v, max) => { const s = typeof v === "string" ? v.trim() : (v == null ? "" : String(v).trim()); return s.length > max ? null : s; };

const dataValida = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T12:00:00Z"));

// Confere um atleta. Devolve { a } normalizado ou { erro: { codigo, campo, mensagem } }
function confereAtleta(x, prova) {
  const e = (codigo, campo, mensagem) => ({ erro: { id_externo: x && x.id_externo ? String(x.id_externo) : null, codigo, campo, mensagem } });
  if (!x || typeof x !== "object") return e("atleta_invalido", null, "Atleta inválido.");
  const id = txt(x.id_externo, 80);
  if (!id) return e("campo_obrigatorio", "id_externo", "id_externo obrigatório (até 80 caracteres).");
  const nome = txt(x.nome, 120);
  if (!nome || nome.length < 3) return e("campo_obrigatorio", "nome", "Nome obrigatório.");
  const cpf = String(x.cpf || "").replace(/\D/g, "");
  if (!cpfValido(cpf)) return e("atleta_invalido", "cpf", "CPF inválido.");
  if (!dataValida(String(x.nascimento || ""))) return e("atleta_invalido", "nascimento", "Nascimento em AAAA-MM-DD.");
  if (!["F", "M"].includes(x.sexo)) return e("atleta_invalido", "sexo", "Sexo: F ou M.");
  const percurso = prova.percursos.find((p) => p.id === x.percurso_id);
  if (!percurso) return e("percurso_invalido", "percurso_id", "Percurso não existe nesta prova: " + (x.percurso_id || "(vazio)") + ".");
  if (!prova.camisetas.includes(x.camiseta)) return e("camiseta_invalida", "camiseta", "Camiseta fora da lista da prova.");
  const email = txt(x.email, 160);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return e("atleta_invalido", "email", "E-mail inválido.");
  const tel = String(x.telefone || "").replace(/[^\d+]/g, "");
  if (!/^\+?\d{10,14}$/.test(tel)) return e("atleta_invalido", "telefone", "Telefone inválido.");
  const consent = isoBanco(x.consentimento_em);
  if (!consent) return e("campo_obrigatorio", "consentimento_em", "consentimento_em obrigatório: o atleta precisa autorizar o envio dos dados.");
  const equipe = txt(x.equipe, 120);
  return { a: { id_externo: id, nome, cpf, nascimento: x.nascimento, sexo: x.sexo, percurso_id: percurso.id, distancia: percurso.nome, camiseta: x.camiseta, email, telefone: tel, equipe: equipe === null ? "" : equipe, consentimento_em: consent } };
}

export async function recebeEnvio(request, env, integ, url, corpoTexto) {
  const chaveIdem = (request.headers.get("Idempotency-Key") || "").trim();
  if (!chaveIdem || chaveIdem.length > 120) throw new ErroApi(400, "campo_obrigatorio", "Cabeçalho Idempotency-Key obrigatório (até 120 caracteres).");
  const hashCorpo = await sha256(corpoTexto);
  const anterior = await env.DB.prepare("SELECT corpo_hash, resposta FROM envios_api WHERE integracao_id = ? AND idempotency_key = ?").bind(integ.id, chaveIdem).first();
  if (anterior) {
    if (anterior.corpo_hash !== hashCorpo) throw new ErroApi(409, "idempotencia_conflito", "Esta Idempotency-Key já foi usada com outro conteúdo.");
    return { status: 202, corpo: JSON.parse(anterior.resposta) };
  }
  let d;
  try { d = JSON.parse(corpoTexto); } catch (e) { throw new ErroApi(400, "json_invalido", "JSON inválido."); }
  if (!d || typeof d !== "object" || Array.isArray(d)) throw new ErroApi(400, "json_invalido", "JSON inválido.");
  const atletas = Array.isArray(d.atletas) ? d.atletas : [];
  const cancel = Array.isArray(d.cancelamentos) ? d.cancelamentos : [];
  if (!atletas.length && !cancel.length) throw new ErroApi(400, "campo_obrigatorio", "Envie atletas ou cancelamentos.");
  if (atletas.length + cancel.length > MAX_ATLETAS) throw new ErroApi(413, "muitos_atletas", "No máximo " + MAX_ATLETAS + " atletas por envio.");
  if (!["assessoria", "ticketsports"].includes(d.modo_pagamento)) throw new ErroApi(400, "campo_obrigatorio", "modo_pagamento: assessoria ou ticketsports.");

  const [l] = await linhasProvas(env, integ, { provaId: String(d.prova_id || "") });
  if (!l) throw new ErroApi(403, "sem_convite", "A assessoria não tem convite nesta prova.");
  if (l.c_situacao !== "aceito") throw new ErroApi(403, "sem_convite", "Aceite o convite desta prova antes de enviar atletas.");
  const prova = await formataProva(env, l, integ, url.origin);
  if (atletas.length && !prova.coletiva.aberta) throw new ErroApi(409, "prazo_encerrado", "A inscrição coletiva desta prova está encerrada.");

  const resp = d.responsavel && typeof d.responsavel === "object" ? d.responsavel : {};
  const agora = isoBanco(Date.now());
  const envioId = "env_" + crypto.randomUUID();
  const inscricaoId = crypto.randomUUID();

  // Atletas que esta assessoria já tem na prova (pelo id_externo)
  const ja = new Map((await env.DB.prepare(
    "SELECT id, id_externo, situacao FROM atletas WHERE prova_id = ? AND parceiro_id = ? AND id_externo <> ''"
  ).bind(l.id, integ.parceiro_id).all()).results.map((x) => [x.id_externo, x]));
  let ativos = [...ja.values()].filter((x) => ATIVAS.includes(x.situacao)).length;
  // Cancelamentos do mesmo envio liberam a vaga antes de contar os novos
  for (const c of cancel) { const x = ja.get(txt(c && c.id_externo, 80)); if (x && ATIVAS.includes(x.situacao)) ativos--; }
  const limite = prova.coletiva.limite_atletas;

  const passos = [], saidaAtletas = [], rejeitados = [], saidaCancel = [];
  const vistos = new Set();
  let novos = 0;
  for (const x of atletas) {
    const r = confereAtleta(x, prova);
    if (r.erro) { rejeitados.push(r.erro); continue; }
    const a = r.a;
    if (vistos.has(a.id_externo)) { rejeitados.push({ id_externo: a.id_externo, codigo: "atleta_invalido", campo: "id_externo", mensagem: "id_externo repetido no mesmo envio." }); continue; }
    vistos.add(a.id_externo);
    const existe = ja.get(a.id_externo);
    const reativa = !existe || !ATIVAS.includes(existe.situacao);
    if (reativa && limite && ativos >= limite) { rejeitados.push({ id_externo: a.id_externo, codigo: "vagas_esgotadas", campo: null, mensagem: "Acabaram as vagas da equipe nesta prova." }); continue; }
    if (reativa) ativos++;
    const situacao = existe && !reativa ? existe.situacao : "recebido";
    if (existe) {
      passos.push(env.DB.prepare(
        "UPDATE atletas SET nome = ?, cpf = ?, nascimento = ?, sexo = ?, distancia = ?, percurso_id = ?, camiseta = ?, email = ?, telefone = ?, equipe = ?, " +
        "consentimento_em = ?, modo_pagamento = ?, situacao = ?, motivo = CASE WHEN ? THEN '' ELSE motivo END, envio_id = ?, atualizado_em = ? WHERE id = ?"
      ).bind(a.nome, a.cpf, a.nascimento, a.sexo, a.distancia, a.percurso_id, a.camiseta, a.email, a.telefone, a.equipe, a.consentimento_em, d.modo_pagamento,
        situacao, reativa ? 1 : 0, envioId, agora, existe.id));
    } else {
      novos++;
      passos.push(env.DB.prepare(
        "INSERT INTO atletas (inscricao_id, nome, cpf, nascimento, sexo, distancia, camiseta, email, telefone, equipe, origem, prova_id, parceiro_id, id_externo, " +
        "percurso_id, situacao, modo_pagamento, consentimento_em, envio_id, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'api', ?, ?, ?, ?, 'recebido', ?, ?, ?, ?)"
      ).bind(inscricaoId, a.nome, a.cpf, a.nascimento, a.sexo, a.distancia, a.camiseta, a.email, a.telefone, a.equipe, l.id, integ.parceiro_id, a.id_externo,
        a.percurso_id, d.modo_pagamento, a.consentimento_em, envioId, agora));
    }
    saidaAtletas.push({ id_externo: a.id_externo, situacao });
  }
  for (const c of cancel) {
    const id = txt(c && c.id_externo, 80);
    const existe = id && ja.get(id);
    if (!existe) { rejeitados.push({ id_externo: id || null, codigo: "nao_encontrado", campo: "id_externo", mensagem: "Atleta não encontrado para cancelar." }); continue; }
    passos.push(env.DB.prepare("UPDATE atletas SET situacao = 'cancelado', motivo = ?, envio_id = ?, atualizado_em = ? WHERE id = ?")
      .bind(txt(c.motivo, 300) || "cancelado pela assessoria", envioId, agora, existe.id));
    saidaCancel.push({ id_externo: id, situacao: "cancelado" });
  }

  // A linha de inscricoes agrupa o envio (aparece no painel em Inscrições coletivas); precisa vir antes dos atletas novos
  const total = saidaAtletas.length;
  const inicio = [env.DB.prepare(
    "INSERT INTO inscricoes (id, canal, prova_id, prova_nome, convite, equipe, responsavel, telefone, total, origem, parceiro_id, modo_pagamento) VALUES (?, 'api', ?, ?, ?, ?, ?, ?, ?, 'api', ?, ?)"
  ).bind(inscricaoId, l.id, l.nome, l.c_cupom, integ.p_nome, txt(resp.nome, 120) || "", txt(resp.telefone, 30) || "", novos, integ.parceiro_id, d.modo_pagamento)];
  const corpo = {
    envio: { id: envioId, referencia_externa: txt(d.referencia_externa, 120) || null, recebido_em: agora, novos, atualizados: total - novos, cancelados: saidaCancel.length },
    atletas: saidaAtletas, cancelamentos: saidaCancel, rejeitados,
  };
  const fim = [env.DB.prepare(
    "INSERT INTO envios_api (id, integracao_id, prova_id, referencia_externa, idempotency_key, corpo_hash, resposta, inscricao_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(envioId, integ.id, l.id, corpo.envio.referencia_externa || "", chaveIdem, hashCorpo, JSON.stringify(corpo), novos ? inscricaoId : null)];
  await env.DB.batch((novos ? inicio : []).concat(passos, fim));
  return { status: 202, corpo };
}

export async function consultaEnvio(env, integ, id) {
  const e = await env.DB.prepare("SELECT * FROM envios_api WHERE id = ? AND integracao_id IN (SELECT id FROM integracoes WHERE parceiro_id = ?)")
    .bind(id, integ.parceiro_id).first();
  if (!e) throw new ErroApi(404, "nao_encontrado", "Envio não encontrado.");
  const r = JSON.parse(e.resposta);
  const atuais = (await env.DB.prepare("SELECT * FROM atletas WHERE envio_id = ?").bind(id).all()).results;
  return { envio: r.envio, prova_id: e.prova_id, atletas: atuais.map(atletaApi), rejeitados: r.rejeitados };
}

export async function situacaoAtletas(env, integ, url) {
  const prova = url.searchParams.get("prova_id");
  if (!prova) throw new ErroApi(400, "campo_obrigatorio", "Informe prova_id.");
  const desde = url.searchParams.get("atualizados_desde");
  const desdeIso = desde ? isoBanco(desde) : null;
  if (desde && !desdeIso) throw new ErroApi(400, "campo_obrigatorio", "Data inválida em atualizados_desde.");
  const r = await env.DB.prepare(
    "SELECT * FROM atletas WHERE prova_id = ? AND parceiro_id = ? AND id_externo <> ''" + (desdeIso ? " AND atualizado_em >= ?" : "") + " ORDER BY id"
  ).bind(...[prova, integ.parceiro_id].concat(desdeIso ? [desdeIso] : [])).all();
  return { atletas: r.results.map((a) => Object.assign(atletaApi(a), { atualizado_em: isoBanco(a.atualizado_em) })), proximo_cursor: null };
}
