// /api/admin/* — API do painel (admin.html), no D1 (binding DB).
//
// Login com senha única guardada como segredo do projeto (ADMIN_SENHA) e
// cookie HttpOnly assinado com outro segredo (SESSAO_SEGREDO). Trocar a senha
// derruba todas as sessões. Nenhuma senha fica em arquivo do repositório.
//
//   POST   login            { senha }
//   POST   sair
//   GET    sessao
//   GET    dados            { provas, parceiros, convites, depoimentos }
//   (minutario, os itens padrão das propostas, segue as mesmas quatro rotas de propostas)
//   GET    config/contrato  |  PUT config/contrato { empresas, foro, modelo }   dados da empresa e modelo do contrato
//   PUT    propostas/<id>/assinado?nome=x.pdf  (corpo = o PDF)  |  GET (baixa)  |  DELETE   contrato assinado
//   GET    provas | parceiros | convites | depoimentos | propostas
//   POST   provas | parceiros | convites | depoimentos | propostas            (cria)
//   PUT    provas/<id> | parceiros/<id> | convites/<id> | depoimentos/<id> | propostas/<id>   (altera só os campos enviados)
//   DELETE provas/<id> | parceiros/<id> | convites/<id> | depoimentos/<id> | propostas/<id>
//   POST   arquivos?caminho=provas/<nome>.jpg       (corpo = a imagem)
//   GET    orcamentos | inscricoes | inscricoes/<id>/atletas
//   GET    medicao?dias=30                          [{ evento, ref, n }]  (functions/api/evento.js)
//   GET    cref6?numero=012345-G/MG                 (consulta pública do CREF6, functions/_cref6.js)
//   POST   parceiros/<id>/instagram                 (confere seguidores na API da Meta, functions/_instagram.js)
//   GET    avisos                                   [{ prova_id, pendentes, enviados }]  ("Me avise", functions/api/aviso.js)
//   POST   avisos/<prova>/enviar  { nome, data, local, link }  e-mail "inscrições abertas" para quem está pendente
//          (Resend: RESEND_API_KEY + AVISO_REMETENTE com domínio verificado)
//   API v1 para parceiros (docs/api-v1-parceiros.md): tudo por convite, ninguém vê a chave
//   GET    parceiros/<id>/integracoes               { conexoes, integracoes, assinatura }
//   POST   parceiros/<id>/conexao { plataforma_url, ambiente }   convite assinado para a plataforma da assessoria
//   POST   conexoes/<id>/reenviar | conexoes/<id>/cancelar
//   POST   integracoes/<id>/desconectar             avisa a plataforma e revoga a chave
//   POST   convites/<id>/avisar                     reenvia o aviso do convite de prova à plataforma
//   (criar/alterar convite ou prova avisa as plataformas conectadas; apagar convite manda convite.cancelado)
//
// Cadastros feitos pelo site (parceiro.html) chegam como parceiros com situacao "pendente";
// aprovar = PUT parceiros/<id> { situacao: "aprovado", ativo: true }.

import { consultaCref6, numeroCref } from "../../_cref6.js";
import { confereInstagramParceiro } from "../../_instagram.js";
import { sha256 } from "../../_chaves.js";
import { assinaturaConfigurada } from "../../_assinatura.js";
import { enviaConviteConexao, enviaAviso, avisaConvite, avisaConviteCancelado, avisaConvitesDaProva, avisaAtletas, origemPublica } from "../../_avisos.js";

// O primeiro é o único com registro conferido no CREF6 (js/admin.js usa a mesma lista)
const PROFISSOES = [
  "Profissional de Educação Física (CREF6/MG)", "Profissional de Educação Física (outro CREF)",
  "Fisioterapeuta", "Nutricionista", "Médico", "Atleta/corredor", "Outro",
];

const COOKIE = "tardim_painel";
const DURACAO = 60 * 60 * 24 * 14; // 14 dias
const MAX_ARQUIVO = 1900000;       // o D1 aceita até ~2 MB por linha
const MAX_ERROS = 5, JANELA_ERROS = 15 * 60;

const RE_ID_PROVA = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RE_ARQUIVO = /^(provas|assessorias)\/[\w-][\w.-]*\.(jpe?g|png|webp)$/;
const TIPOS_PARCEIRO = ["embaixador", "influenciador", "assessoria", "equipe"];

// Campos que o painel pode gravar em cada tabela: número = tamanho máximo do texto
const TABELAS = {
  provas: {
    campos: {
      nome: 120, data: 10, hora: 10, local: 200, percursos: "json", resumo: 400, poster: 300, inscricao: 500,
      valores: "json", kit: "json", programacao: "json", premiacao: 300, percurso_mapa: 500, regulamento: 500,
      resultados: 500, fotos: 500, realizacao: 120, texto_divulgacao: 1500, hashtags: 200, publicada: "bool",
      faq: "json", // [["pergunta", "resposta"]]; o painel só envia quando há o que gravar (banco sem a coluna continua salvando)
    },
    obrigatorios: ["nome", "data"], ordem: "data",
  },
  parceiros: {
    campos: {
      tipo: 20, nome: 120, responsavel: 120, whatsapp: 20, email: 120, instagram: 60, cidade: 80,
      documento: 20, pix: 120, observacoes: 1000, logo: 200, cor: 7, ativo: "bool",
      profissao: 60, registro: 20, registro_situacao: 40, registro_nome: 120, registro_conferido_em: 30,
      situacao: 12, motivo_recusa: 300, // cadastro feito pelo site (parceiro.html): pendente | aprovado | recusado
      uf: 2, seguidores: "grande",
    },
    obrigatorios: ["tipo", "nome"], ordem: "nome COLLATE NOCASE",
  },
  convites: {
    campos: {
      parceiro_id: 40, prova_id: 60, cupom: 40, desconto: 20, comissao_pct: "num", cortesias: "int",
      contrapartida: 300, condicoes: 1000,
      coletiva: "json", // inscrição coletiva (assessoria/equipe): { d, m, i, v, f, g, b, kt, pe } de js/convite.js
    },
    obrigatorios: ["parceiro_id", "prova_id", "cupom"], ordem: "criado_em DESC",
  },
  // Propostas comerciais (aba Propostas): os itens e as somas ficam em "dados"
  propostas: {
    campos: { numero: 20, cliente: 160, evento: 200, dados: "json" },
    obrigatorios: ["cliente"], ordem: "criado_em DESC",
  },
  // Minutário: itens padrão das propostas; "dados" = { unit, qtd, pp, base }
  minutario: {
    campos: { categoria: 80, descricao: 2000, dados: "json" },
    obrigatorios: ["descricao"], ordem: "categoria COLLATE NOCASE, criado_em, rowid",
  },
  // Depoimentos mostrados no site (functions/_middleware.js entrega os publicados)
  depoimentos: {
    campos: { nome: 120, cargo: 160, texto: 600, onde: 10, publicado: "bool" },
    obrigatorios: ["nome", "texto"], ordem: "criado_em DESC",
  },
};

class Erro extends Error {
  constructor(status, mensagem) { super(mensagem); this.status = status; }
}

function json(corpo, status, extra) {
  return new Response(JSON.stringify(corpo), {
    status: status || 200,
    headers: Object.assign({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }, extra || {}),
  });
}

function mesmaOrigem(request) {
  try { return new URL(request.headers.get("Origin")).host === new URL(request.url).host; } catch (e) { return false; }
}

// ---------- sessão ----------
const enc = new TextEncoder();
async function hmac(segredo, msg) {
  const k = await crypto.subtle.importKey("raw", enc.encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(msg)));
  let b = ""; for (const x of s) b += String.fromCharCode(x);
  return btoa(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function iguais(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
// A assinatura inclui a senha atual: trocar ADMIN_SENHA invalida as sessões abertas
const assina = (env, exp) => hmac(env.SESSAO_SEGREDO, "painel." + exp + "." + env.ADMIN_SENHA);
async function criaToken(env) {
  const exp = Math.floor(Date.now() / 1000) + DURACAO;
  return exp + "." + (await assina(env, exp));
}
async function sessaoValida(request, env) {
  const m = (request.headers.get("Cookie") || "").match(new RegExp("(?:^|;\\s*)" + COOKIE + "=([^;]+)"));
  if (!m) return false;
  const [exp, sig] = m[1].split(".");
  if (!exp || !sig || !(Number(exp) > Date.now() / 1000)) return false;
  return iguais(sig, await assina(env, exp));
}
const cookie = (valor, idade) => `${COOKIE}=${valor}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${idade}`;

async function login(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  const agora = Math.floor(Date.now() / 1000);
  const erros = await env.DB.prepare("SELECT COUNT(*) AS n FROM login_erros WHERE ip = ? AND quando > ?").bind(ip, agora - JANELA_ERROS).first();
  if (erros && erros.n >= MAX_ERROS) throw new Erro(429, "Muitas tentativas erradas. Espere 15 minutos e tente de novo.");
  let d = {};
  try { d = await request.json(); } catch (e) { /* corpo inválido = senha vazia */ }
  const senha = typeof d.senha === "string" ? d.senha.slice(0, 200) : "";
  const certo = senha && iguais(await hmac(env.SESSAO_SEGREDO, "senha." + senha), await hmac(env.SESSAO_SEGREDO, "senha." + env.ADMIN_SENHA));
  if (!certo) {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO login_erros (ip, quando) VALUES (?, ?)").bind(ip, agora),
      env.DB.prepare("DELETE FROM login_erros WHERE quando < ?").bind(agora - 86400),
    ]);
    await new Promise((r) => setTimeout(r, 600));
    throw new Erro(401, "Senha incorreta.");
  }
  await env.DB.prepare("DELETE FROM login_erros WHERE ip = ?").bind(ip).run();
  return json({ ok: true }, 200, { "set-cookie": cookie(await criaToken(env), DURACAO) });
}

// ---------- validação ----------
function limpa(tabela, d, criando) {
  const def = TABELAS[tabela];
  const v = {};
  for (const campo in def.campos) {
    if (!(campo in d)) continue;
    const regra = def.campos[campo];
    let x = d[campo];
    if (regra === "json") {
      x = JSON.stringify(x == null ? (campo === "kit" ? { itens: [], retirada: "" } : (campo === "dados" ? {} : [])) : x);
      if (x.length > (tabela === "propostas" ? 150000 : 20000)) throw new Erro(400, "O campo " + campo + " está grande demais.");
    } else if (regra === "bool") {
      x = x ? 1 : 0;
    } else if (regra === "num") {
      x = Number(x) || 0;
      if (x < 0 || x > 100) throw new Erro(400, "A comissão precisa estar entre 0 e 100%.");
    } else if (regra === "grande") {
      x = parseInt(x, 10) || 0;
      if (x < 0 || x > 1000000000) throw new Erro(400, "Número inválido em " + campo + ".");
    } else if (regra === "int") {
      x = parseInt(x, 10) || 0;
      if (x < 0 || x > 1000) throw new Erro(400, "Número inválido em " + campo + ".");
    } else {
      x = typeof x === "string" ? x.trim() : (x == null ? "" : String(x));
      if (x.length > regra) throw new Erro(400, "O campo " + campo + " passou de " + regra + " caracteres.");
    }
    v[campo] = x;
  }
  if (criando) for (const c of def.obrigatorios) if (!v[c]) throw new Erro(400, "Preencha o campo " + c + ".");
  // regras de cada tabela
  if (tabela === "provas") {
    if ("data" in v && !/^\d{4}-\d{2}-\d{2}$/.test(v.data)) throw new Erro(400, "Data inválida.");
    if ("poster" in v && v.poster && !/^(arquivos\/|assets\/|https:\/\/)/.test(v.poster)) throw new Erro(400, "Endereço da arte inválido.");
    for (const c of ["inscricao", "percurso_mapa", "regulamento", "resultados", "fotos"]) {
      if (v[c] && !/^https?:\/\//.test(v[c])) throw new Erro(400, "O link em " + c + " precisa começar com http:// ou https://.");
    }
  }
  if (tabela === "parceiros") {
    if ("tipo" in v && TIPOS_PARCEIRO.indexOf(v.tipo) < 0) throw new Erro(400, "Tipo de parceiro inválido.");
    if ("uf" in v) { v.uf = v.uf.toUpperCase(); if (v.uf && !/^[A-Z]{2}$/.test(v.uf)) throw new Erro(400, "Estado inválido."); }
    if ("situacao" in v &&["pendente", "aprovado", "recusado"].indexOf(v.situacao) < 0) throw new Erro(400, "Situação do cadastro inválida.");
    if ("cor" in v) { v.cor = v.cor.replace(/^#/, "").toLowerCase(); if (v.cor && !/^[0-9a-f]{6}$/.test(v.cor)) throw new Erro(400, "Cor inválida."); }
    if ("logo" in v && v.logo && !/^assessorias\/[\w-][\w.-]*\.(png|jpe?g|webp)$/.test(v.logo)) throw new Erro(400, "Caminho da logo inválido.");
    if ("profissao" in v && v.profissao && PROFISSOES.indexOf(v.profissao) < 0) throw new Erro(400, "Tipo de profissional inválido.");
    if (v.profissao === PROFISSOES[0] && "registro" in v) {
      const n = numeroCref(v.registro);
      if (!n) throw new Erro(400, "Número do CREF6 inválido.");
      v.registro = "MG-" + n;
    }
    if ("registro_conferido_em" in v && v.registro_conferido_em && isNaN(Date.parse(v.registro_conferido_em))) throw new Erro(400, "Data de conferência inválida.");
  }
  if (tabela === "depoimentos") {
    if ("onde" in v && ["empresas", "inicio", "ambas"].indexOf(v.onde) < 0) throw new Erro(400, "Lugar do depoimento inválido.");
    if ("nome" in v && !v.nome) throw new Erro(400, "Preencha o campo nome.");
    if ("texto" in v && !v.texto) throw new Erro(400, "Preencha o campo texto.");
  }
  if (tabela === "convites") {
    if ("cupom" in v) { v.cupom = v.cupom.toUpperCase(); if (!/^[A-Z0-9_-]{3,40}$/.test(v.cupom)) throw new Erro(400, "Cupom inválido: use de 3 a 40 letras, números, hífen ou sublinhado."); }
    if ("prova_id" in v && !RE_ID_PROVA.test(v.prova_id)) throw new Erro(400, "Prova inválida.");
    if ("coletiva" in v) {
      if (v.coletiva[0] !== "{") v.coletiva = "{}";
      if (v.coletiva.length > 2000) throw new Erro(400, "As condições da inscrição coletiva estão grandes demais.");
    }
  }
  return v;
}

// Linha do banco -> objeto do painel (JSON e 0/1 convertidos)
function saida(tabela, r) {
  if (!r) return r;
  const def = TABELAS[tabela];
  const o = Object.assign({}, r);
  for (const c in def.campos) {
    if (def.campos[c] === "json") { try { o[c] = JSON.parse(o[c]); } catch (e) { o[c] = c === "kit" ? { itens: [], retirada: "" } : (c === "dados" ? {} : []); } }
    if (def.campos[c] === "bool") o[c] = !!o[c];
  }
  return o;
}

async function lista(env, tabela) {
  const r = await env.DB.prepare(`SELECT * FROM ${tabela} ORDER BY ${TABELAS[tabela].ordem}`).all();
  return r.results.map((x) => saida(tabela, x));
}
async function uma(env, tabela, id) {
  return saida(tabela, await env.DB.prepare(`SELECT * FROM ${tabela} WHERE id = ?`).bind(id).first());
}

async function cria(env, tabela, d) {
  const v = limpa(tabela, d, true);
  if (tabela === "provas") {
    v.id = typeof d.id === "string" ? d.id.trim() : "";
    if (!RE_ID_PROVA.test(v.id) || v.id.length > 60) throw new Erro(400, "Identificador da prova inválido.");
  } else {
    v.id = crypto.randomUUID();
  }
  if (tabela === "convites" && !(await env.DB.prepare("SELECT 1 FROM parceiros WHERE id = ?").bind(v.parceiro_id).first())) {
    throw new Erro(400, "Parceiro não encontrado.");
  }
  const cols = Object.keys(v);
  await env.DB.prepare(`INSERT INTO ${tabela} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).bind(...cols.map((c) => v[c])).run();
  return uma(env, tabela, v.id);
}

async function altera(env, tabela, id, d) {
  const v = limpa(tabela, d, false);
  // Proposta: o andamento (etapa, datas e contrato) não some quando uma tela antiga salva só os itens
  if (tabela === "propostas" && "dados" in v) {
    const atual = await env.DB.prepare("SELECT dados FROM propostas WHERE id = ?").bind(id).first();
    let antes = {}, nova = {};
    try { antes = JSON.parse((atual && atual.dados) || "{}"); nova = JSON.parse(v.dados); } catch (e) { /* segue com o que veio */ }
    let mudou = false;
    for (const k of ["etapa", "marcos", "contrato"]) if (!(k in nova) && k in antes) { nova[k] = antes[k]; mudou = true; }
    if (mudou) v.dados = JSON.stringify(nova);
  }
  // Trocou o @: a conferência antiga do Instagram deixa de valer
  if (tabela === "parceiros" && "instagram" in v) {
    const atual = await env.DB.prepare("SELECT instagram FROM parceiros WHERE id = ?").bind(id).first();
    if (atual && atual.instagram.replace(/^@/, "").toLowerCase() !== v.instagram.replace(/^@/, "").toLowerCase()) {
      Object.assign(v, { ig_situacao: "", ig_seguidores: 0, ig_posts: 0, ig_conferido_em: "" });
    }
  }
  const cols = Object.keys(v);
  if (cols.length) {
    const r = await env.DB.prepare(
      `UPDATE ${tabela} SET ${cols.map((c) => c + " = ?").join(", ")}, atualizado_em = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`
    ).bind(...cols.map((c) => v[c]), id).run();
    if (!r.meta || !r.meta.changes) throw new Erro(404, "Registro não encontrado.");
  }
  const o = await uma(env, tabela, id);
  if (!o) throw new Erro(404, "Registro não encontrado.");
  return o;
}

async function apaga(env, tabela, id) {
  const passos = [];
  if (tabela === "parceiros") {
    passos.push(env.DB.prepare("DELETE FROM convites WHERE parceiro_id = ?").bind(id));
    // Se o login tem outros perfis, o principal passa a ser um deles; senão o login some junto
    passos.push(env.DB.prepare(
      "UPDATE contas SET parceiro_id = (SELECT p.id FROM parceiros p WHERE p.conta_id = contas.id AND p.id <> ?1 LIMIT 1) " +
      "WHERE parceiro_id = ?1 AND EXISTS (SELECT 1 FROM parceiros p WHERE p.conta_id = contas.id AND p.id <> ?1)"
    ).bind(id));
    passos.push(env.DB.prepare("DELETE FROM contas WHERE parceiro_id = ?").bind(id));
  }
  // Proposta excluída leva junto o PDF assinado (banco sem a tabela: segue excluindo a proposta)
  if (tabela === "propostas") await env.DB.prepare("DELETE FROM contratos_assinados WHERE proposta_id = ?").bind(id).run().catch(() => {});
  // Parceiro excluído leva junto as chaves da API e os envios delas (banco sem as tabelas: segue)
  if (tabela === "parceiros") {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM envios_api WHERE integracao_id IN (SELECT id FROM integracoes WHERE parceiro_id = ?)").bind(id),
      env.DB.prepare("DELETE FROM integracoes WHERE parceiro_id = ?").bind(id),
    ]).catch(() => {});
  }
  passos.push(env.DB.prepare(`DELETE FROM ${tabela} WHERE id = ?`).bind(id));
  await env.DB.batch(passos);
  return { ok: true };
}

// Configurações do painel: chave -> tamanho máximo do JSON
const CONFIGS = { contrato: 120000 };
async function config(request, env, m, chave) {
  if (m === "GET") {
    const r = await env.DB.prepare("SELECT valor FROM configuracoes WHERE chave = ?").bind(chave).first();
    try { return json(r ? JSON.parse(r.valor) : {}); } catch (e) { return json({}); }
  }
  if (m === "PUT") {
    const v = JSON.stringify(await corpo(request));
    if (v.length > CONFIGS[chave]) throw new Erro(400, "Configuração grande demais.");
    await env.DB.prepare(
      "INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')"
    ).bind(chave, v).run();
    return json(JSON.parse(v));
  }
  throw new Erro(405, "Método não permitido.");
}

// PDF do contrato assinado de uma proposta (só com login)
async function contratoAssinado(request, env, m, id) {
  if (!(await env.DB.prepare("SELECT 1 FROM propostas WHERE id = ?").bind(id).first())) throw new Erro(404, "Proposta não encontrada.");
  if (m === "GET") {
    const r = await env.DB.prepare("SELECT nome, dados FROM contratos_assinados WHERE proposta_id = ?").bind(id).first();
    if (!r) throw new Erro(404, "Nenhum contrato assinado foi enviado para esta proposta.");
    const bytes = r.dados instanceof ArrayBuffer ? r.dados : new Uint8Array(r.dados).buffer;
    const nome = String(r.nome || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "-").replace(/^-+/, "") || "contrato-assinado.pdf";
    return new Response(bytes, {
      headers: {
        "content-type": "application/pdf", "content-disposition": `attachment; filename="${nome}"`,
        "cache-control": "no-store", "x-content-type-options": "nosniff",
      },
    });
  }
  if (m === "PUT") {
    const tipo = (request.headers.get("content-type") || "").split(";")[0].trim();
    if (tipo !== "application/pdf") throw new Erro(400, "Envie o contrato assinado em PDF.");
    const dados = await request.arrayBuffer();
    if (!dados.byteLength) throw new Erro(400, "Arquivo vazio.");
    if (dados.byteLength > MAX_ARQUIVO) throw new Erro(413, "PDF grande demais (máximo de 1,9 MB). Guarde no Drive e cole o link.");
    if (String.fromCharCode(...new Uint8Array(dados, 0, Math.min(5, dados.byteLength))) !== "%PDF-") throw new Erro(400, "Esse arquivo não é um PDF.");
    const nome = String(new URL(request.url).searchParams.get("nome") || "contrato-assinado.pdf").slice(0, 120);
    await env.DB.prepare(
      "INSERT INTO contratos_assinados (proposta_id, nome, tamanho, dados) VALUES (?, ?, ?, ?) ON CONFLICT(proposta_id) DO UPDATE SET " +
      "nome = excluded.nome, tamanho = excluded.tamanho, dados = excluded.dados, enviado_em = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')"
    ).bind(id, nome, dados.byteLength, dados).run();
    return json({ ok: true, nome, tamanho: dados.byteLength });
  }
  if (m === "DELETE") {
    await env.DB.prepare("DELETE FROM contratos_assinados WHERE proposta_id = ?").bind(id).run();
    return json({ ok: true });
  }
  throw new Erro(405, "Método não permitido.");
}

async function enviaArquivo(request, env, url) {
  const caminho = url.searchParams.get("caminho") || "";
  if (!RE_ARQUIVO.test(caminho)) throw new Erro(400, "Nome de arquivo inválido.");
  const tipo = (request.headers.get("content-type") || "").split(";")[0].trim();
  if (!/^image\/(jpeg|png|webp)$/.test(tipo)) throw new Erro(400, "Envie uma imagem JPG, PNG ou WebP.");
  const dados = await request.arrayBuffer();
  if (!dados.byteLength) throw new Erro(400, "Arquivo vazio.");
  if (dados.byteLength > MAX_ARQUIVO) throw new Erro(413, "Imagem grande demais (máximo de 1,9 MB).");
  await env.DB.prepare("INSERT INTO arquivos (caminho, tipo, tamanho, dados) VALUES (?, ?, ?, ?)").bind(caminho, tipo, dados.byteLength, dados).run();
  return json({ ok: true, caminho, url: "arquivos/" + caminho }, 201);
}

// ---------- "Me avise": e-mail de inscrições abertas ----------
const escHtml = (s) => String(s || "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
async function enviaAvisos(env, provaId, d, origem) {
  if (!RE_ID_PROVA.test(provaId)) throw new Erro(400, "Prova inválida.");
  if (!env.RESEND_API_KEY) throw new Erro(503, "O envio de e-mail ainda não foi configurado (falta o segredo RESEND_API_KEY).");
  const nome = String(d.nome || "").trim().slice(0, 160);
  const link = String(d.link || "").trim().slice(0, 500);
  const data = String(d.data || "").trim().slice(0, 60);
  const local = String(d.local || "").trim().slice(0, 200);
  if (!nome) throw new Erro(400, "Falta o nome da prova.");
  if (!/^https:\/\/[^\s"<>]+$/.test(link)) throw new Erro(400, "A prova ainda não tem o link de inscrição.");
  const fila = (await env.DB.prepare("SELECT id, nome, email FROM avisos WHERE prova_id = ? AND enviado_em = '' LIMIT 500")
    .bind(provaId).all()).results;
  if (!fila.length) return { enviados: 0, falhas: 0 };
  const remetente = env.AVISO_REMETENTE || "Tardim Produções <onboarding@resend.dev>";
  // pagina_id: avisar quem pediu a "próxima edição" de uma prova realizada com o link da prova nova
  const pagina = origem + "/prova-" + (RE_ID_PROVA.test(d.pagina_id || "") ? d.pagina_id : provaId) + ".html";
  let enviados = 0, falhas = 0;
  // Um e-mail por pessoa (ninguém vê o endereço dos outros), em lotes de 100 (limite do /emails/batch)
  for (let i = 0; i < fila.length; i += 100) {
    const lote = fila.slice(i, i + 100);
    const msgs = lote.map((p) => {
      const ola = p.nome ? "Olá, " + p.nome.split(" ")[0] + "!" : "Olá!";
      const cancelar = origem + "/api/aviso?cancelar=" + p.id;
      return {
        from: remetente, to: [p.email], subject: "Inscrições abertas: " + nome,
        headers: { "List-Unsubscribe": "<" + cancelar + ">" },
        text: [ola, "", "As inscrições para a " + nome + " estão abertas" + (data ? " (prova em " + data + (local ? ", " + local : "") + ")" : "") + ".",
          "", "Inscreva-se: " + link, "", "Detalhes da prova: " + pagina, "", "Tardim Produções",
          "", "Você recebeu este e-mail porque pediu o aviso no site. Para cancelar: " + cancelar].join("\n"),
        html: `<div style="font-family:Arial,sans-serif;font-size:16px;color:#24325a;line-height:1.5">
<p>${escHtml(ola)}</p><p>As inscrições para a <b>${escHtml(nome)}</b> estão abertas${data ? " (prova em " + escHtml(data) + (local ? ", " + escHtml(local) : "") + ")" : ""}.</p>
<p><a href="${escHtml(link)}" style="display:inline-block;background:#c8102e;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Fazer minha inscrição</a></p>
<p><a href="${escHtml(pagina)}">Ver detalhes da prova</a></p><p>Tardim Produções</p>
<p style="font-size:12px;color:#777">Você recebeu este e-mail porque pediu o aviso no site. <a href="${escHtml(cancelar)}">Cancelar o aviso</a>.</p></div>`,
      };
    });
    const r = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { authorization: "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" },
      body: JSON.stringify(msgs),
    });
    if (!r.ok) {
      const msg = ((await r.json().catch(() => ({}))).message || "erro " + r.status);
      if (!enviados) throw new Erro(502, "O Resend recusou o envio: " + msg);
      falhas += lote.length;
      break;
    }
    await env.DB.batch(lote.map((p) => env.DB.prepare("UPDATE avisos SET enviado_em = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?").bind(p.id)));
    enviados += lote.length;
  }
  return { enviados, falhas };
}

// ---------- integrações (API v1 para parceiros, docs/api-v1-parceiros.md) ----------
// Tudo por convite: o painel convida a plataforma da assessoria (convite assinado),
// o admin dela aceita ou recusa lá, e a chave vai direto para o servidor dela.
const CAMPOS_INTEGRACAO = "id, parceiro_id, nome, plataforma_url, ambiente, prefixo, webhook_url, usada_em, revogada_em, criada_em";
const CAMPOS_CONEXAO = "id, parceiro_id, plataforma_url, ambiente, situacao, erro, motivo, respondido_por, integracao_id, expira_em, enviado_em, respondido_em, criado_em";
const VALIDADE_CONVITE = 7 * 86400000;

function urlPlataforma(valor, request) {
  let u;
  try { u = new URL(String(valor || "").trim()); } catch (e) { throw new Erro(400, "Endereço do sistema inválido. Exemplo: https://im3-eventos.vercel.app"); }
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname);
  const painelLocal = /^(localhost|127\.0\.0\.1)$/.test(new URL(request.url).hostname);
  if (u.protocol !== "https:" && !(local && painelLocal && u.protocol === "http:")) throw new Erro(400, "O endereço do sistema precisa começar com https://.");
  return u.origin;
}

async function listaIntegracoes(env, parceiroId) {
  const [cx, it] = await Promise.all([
    env.DB.prepare("SELECT " + CAMPOS_CONEXAO + " FROM conexoes WHERE parceiro_id = ? ORDER BY criado_em DESC LIMIT 20").bind(parceiroId).all(),
    env.DB.prepare("SELECT " + CAMPOS_INTEGRACAO + " FROM integracoes WHERE parceiro_id = ? ORDER BY criada_em DESC").bind(parceiroId).all(),
  ]);
  return { conexoes: cx.results, integracoes: it.results, assinatura: assinaturaConfigurada(env) };
}

// Gera código novo, grava e entrega o convite assinado à plataforma
async function entregaConvite(env, cx, url) {
  const p = await env.DB.prepare("SELECT id, nome, responsavel, email FROM parceiros WHERE id = ?").bind(cx.parceiro_id).first();
  const codigo = Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) => x.toString(16).padStart(2, "0")).join("");
  const expira = new Date(Date.now() + VALIDADE_CONVITE).toISOString().slice(0, 19) + "Z";
  await env.DB.prepare("UPDATE conexoes SET codigo_hash = ?, expira_em = ?, situacao = 'enviando', erro = '' WHERE id = ?")
    .bind(await sha256(codigo), expira, cx.id).run();
  const r = await enviaConviteConexao(env, Object.assign({}, cx, { expira_em: expira }), p, codigo, origemPublica(url));
  await env.DB.prepare("UPDATE conexoes SET situacao = ?, erro = ?, enviado_em = ? WHERE id = ? AND situacao = 'enviando'")
    .bind(r.ok ? "enviado" : "falhou", r.ok ? "" : String(r.erro || "").slice(0, 300), new Date().toISOString().slice(0, 19) + "Z", cx.id).run();
  return env.DB.prepare("SELECT " + CAMPOS_CONEXAO + " FROM conexoes WHERE id = ?").bind(cx.id).first();
}

async function convidaConexao(request, env, parceiroId, url) {
  const p = await env.DB.prepare("SELECT id, tipo, situacao, ativo FROM parceiros WHERE id = ?").bind(parceiroId).first();
  if (!p) throw new Erro(404, "Registro não encontrado.");
  if (p.tipo !== "assessoria") throw new Erro(400, "Só assessoria pode ser conectada.");
  if (p.situacao !== "aprovado" || !p.ativo) throw new Erro(400, "Aprove e ative a assessoria antes de convidar.");
  if (!assinaturaConfigurada(env)) throw new Erro(503, "Falta configurar a assinatura dos convites (segredo TARDIM_ASSINATURA_JWK). Veja o README.");
  const d = await corpo(request);
  const plataforma = urlPlataforma(d.plataforma_url, request);
  const ambiente = d.ambiente === "test" ? "test" : "live";
  const id = "cnx_" + crypto.randomUUID();
  // Convites ainda sem resposta para a mesma plataforma deixam de valer
  await env.DB.prepare("UPDATE conexoes SET situacao = 'cancelado' WHERE parceiro_id = ? AND plataforma_url = ? AND situacao IN ('enviando', 'enviado', 'falhou')")
    .bind(parceiroId, plataforma).run();
  await env.DB.prepare("INSERT INTO conexoes (id, parceiro_id, plataforma_url, ambiente, codigo_hash, expira_em) VALUES (?, ?, ?, ?, '', '')")
    .bind(id, parceiroId, plataforma, ambiente).run();
  const cx = await env.DB.prepare("SELECT * FROM conexoes WHERE id = ?").bind(id).first();
  return json(await entregaConvite(env, cx, url), 201);
}

async function alteraConexao(env, m, id, acao, url) {
  const cx = await env.DB.prepare("SELECT * FROM conexoes WHERE id = ?").bind(id).first();
  if (!cx) throw new Erro(404, "Registro não encontrado.");
  if (m !== "POST") throw new Erro(404, "Rota não encontrada.");
  const aberta = ["enviando", "enviado", "falhou"].includes(cx.situacao);
  if (acao === "reenviar") {
    if (!aberta) throw new Erro(400, "Este convite já foi respondido ou cancelado. Faça um convite novo.");
    return json(await entregaConvite(env, cx, url));
  }
  if (acao === "cancelar") {
    if (aberta) await env.DB.prepare("UPDATE conexoes SET situacao = 'cancelado' WHERE id = ?").bind(id).run();
    return json(await env.DB.prepare("SELECT " + CAMPOS_CONEXAO + " FROM conexoes WHERE id = ?").bind(id).first());
  }
  throw new Erro(404, "Rota não encontrada.");
}

// Desconectar: avisa a plataforma (com o segredo desta conexão) e revoga a chave
async function desconecta(env, m, id) {
  if (m !== "POST") throw new Erro(404, "Rota não encontrada.");
  const atual = await env.DB.prepare("SELECT * FROM integracoes WHERE id = ?").bind(id).first();
  if (!atual) throw new Erro(404, "Registro não encontrado.");
  let aviso = null;
  if (!atual.revogada_em) {
    aviso = await enviaAviso(atual, "conexao.encerrada", { motivo: "Desconectado pela Tardim Produções." }).catch(() => null);
    await env.DB.prepare("UPDATE integracoes SET revogada_em = ? WHERE id = ?").bind(new Date().toISOString().slice(0, 19) + "Z", id).run();
  }
  return json({ integracao: await env.DB.prepare("SELECT " + CAMPOS_INTEGRACAO + " FROM integracoes WHERE id = ?").bind(id).first(), aviso });
}
// ---------- rotas ----------
async function trata(request, env, rota, url, waitUntil) {
  const m = request.method;
  const [a, b, c] = rota;

  if (m !== "GET" && !mesmaOrigem(request)) throw new Erro(403, "Origem não permitida.");
  if (a === "login" && m === "POST") return login(request, env);
  if (a === "sair" && m === "POST") return json({ ok: true }, 200, { "set-cookie": cookie("", 0) });

  if (!(await sessaoValida(request, env))) throw new Erro(401, "Entre no painel.");

  if (a === "sessao" && m === "GET") return json({ ok: true });
  if (a === "dados" && m === "GET") {
    // Banco sem a tabela de depoimentos (falta d1/migracoes/008-depoimentos.sql): o resto do painel segue funcionando
    const [provas, parceiros, convites, depoimentos] = await Promise.all([lista(env, "provas"), lista(env, "parceiros"), lista(env, "convites"),
      lista(env, "depoimentos").catch(() => null)]);
    return json({ provas, parceiros, convites, depoimentos });
  }
  if (a === "arquivos" && m === "POST" && !b) return enviaArquivo(request, env, url);
  // Consulta ao CREF6 só para quem está no painel (não vira proxy aberto do CREF)
  if (a === "cref6" && m === "GET" && !b) return json(await consultaCref6(url.searchParams.get("numero") || ""));

  if (a === "parceiros" && b && c === "instagram" && m === "POST") {
    const r = await confereInstagramParceiro(env, b);
    if (!r) throw new Erro(404, "Registro não encontrado.");
    return json({ resultado: r, parceiro: await uma(env, "parceiros", b) });
  }

  if (a === "parceiros" && b && c === "integracoes" && !rota[3] && m === "GET") return json(await listaIntegracoes(env, b));
  if (a === "parceiros" && b && c === "conexao" && !rota[3] && m === "POST") return convidaConexao(request, env, b, url);
  if (a === "conexoes" && b && c && !rota[3]) return alteraConexao(env, m, b, c, url);
  if (a === "integracoes" && b && c === "desconectar" && !rota[3]) return desconecta(env, m, b);
  if (a === "convites" && b && c === "avisar" && !rota[3] && m === "POST") {
    const r = await avisaConvite(env, b, origemPublica(url));
    if (!r) throw new Erro(400, "Nada a avisar: a assessoria não está conectada ou a prova ainda não aparece para ela.");
    return json({ aviso: r, convite: await uma(env, "convites", b) });
  }

  if (a === "avisos" && !b && m === "GET") {
    return json((await env.DB.prepare(
      "SELECT prova_id, SUM(enviado_em = '') AS pendentes, SUM(enviado_em <> '') AS enviados FROM avisos GROUP BY prova_id"
    ).all()).results);
  }
  if (a === "avisos" && b && c === "enviar" && m === "POST") return json(await enviaAvisos(env, b, await corpo(request), url.origin));

  if (a === "config" && CONFIGS[b] && !c) return config(request, env, m, b);
  if (a === "propostas" && b && c === "assinado" && !rota[3]) return contratoAssinado(request, env, m, b);

  if (TABELAS[a]) {
    // Convites e provas avisam as plataformas das assessorias conectadas (API v1), depois da resposta
    const avisa = (fn) => { if (waitUntil) waitUntil(fn().catch(() => {})); };
    const origem = origemPublica(url);
    if (!b && m === "GET") return json(await lista(env, a));
    if (!b && m === "POST") {
      const novo = await cria(env, a, await corpo(request));
      if (a === "convites") avisa(() => avisaConvite(env, novo.id, origem));
      return json(novo, 201);
    }
    if (b && !c && m === "PUT") {
      const salvo = await altera(env, a, b, await corpo(request));
      if (a === "convites") avisa(() => avisaConvite(env, b, origem));
      if (a === "provas") avisa(() => avisaConvitesDaProva(env, b, origem));
      return json(salvo);
    }
    if (b && !c && m === "DELETE") {
      if (a === "convites") {
        const antes = await env.DB.prepare("SELECT * FROM convites WHERE id = ?").bind(b).first().catch(() => null);
        if (antes) await avisaConviteCancelado(env, antes).catch(() => null);
      }
      return json(await apaga(env, a, b));
    }
  }

  // Medição do site (functions/api/evento.js): totais por evento e página nos últimos N dias
  if (a === "medicao" && !b && m === "GET") {
    const dias = Math.min(Math.max(parseInt(url.searchParams.get("dias"), 10) || 30, 1), 365);
    const desde = new Date(Date.now() - 3 * 3600 * 1000 - (dias - 1) * 86400000).toISOString().slice(0, 10);
    return json((await env.DB.prepare(
      "SELECT evento, ref, SUM(n) AS n FROM medicao WHERE dia >= ? GROUP BY evento, ref"
    ).bind(desde).all()).results);
  }

  // Leitura do que chega pelo site (tabelas de d1/schema.sql)
  if (a === "orcamentos" && !b && m === "GET") {
    return json((await env.DB.prepare("SELECT * FROM orcamentos ORDER BY id DESC LIMIT 500").all()).results);
  }
  if (a === "inscricoes" && !b && m === "GET") {
    return json((await env.DB.prepare(
      "SELECT i.*, (SELECT COUNT(*) FROM atletas t WHERE t.inscricao_id = i.id) AS atletas FROM inscricoes i ORDER BY i.criado_em DESC LIMIT 500"
    ).all()).results);
  }
  // Conferência dos atletas enviados pelo sistema da assessoria (API v1): cada mudança avisa a plataforma (atleta.situacao)
  if (a === "atletas" && b && !c && m === "PUT") {
    const d = await corpo(request);
    const SIT = ["recebido", "aguardando_pagamento", "inscrito", "recusado", "cancelado"];
    const at = await env.DB.prepare("SELECT * FROM atletas WHERE id = ?").bind(Number(b)).first();
    if (!at) throw new Erro(404, "Registro não encontrado.");
    const situacao = d.situacao === undefined ? at.situacao : String(d.situacao);
    if (at.origem === "api" && !SIT.includes(situacao)) throw new Erro(400, "Situação inválida.");
    const peito = d.numero_peito === undefined ? at.numero_peito : String(d.numero_peito || "").trim().slice(0, 10);
    const motivo = d.motivo === undefined ? (situacao === "recusado" || situacao === "cancelado" ? at.motivo : "") : String(d.motivo || "").trim().slice(0, 300);
    await env.DB.prepare("UPDATE atletas SET situacao = ?, numero_peito = ?, motivo = ?, atualizado_em = ? WHERE id = ?")
      .bind(situacao, peito, motivo, new Date().toISOString().slice(0, 19) + "Z", at.id).run();
    const aviso = at.origem === "api" ? (await avisaAtletas(env, [at.id]))[0] || null : null;
    return json({ atleta: await env.DB.prepare("SELECT * FROM atletas WHERE id = ?").bind(at.id).first(), aviso });
  }
  if (a === "inscricoes" && b && c === "confirmar" && m === "POST") {
    // Todos os recebidos/aguardando deste envio viram inscritos (o número de peito pode vir depois)
    const ids = (await env.DB.prepare("SELECT id FROM atletas WHERE inscricao_id = ? AND origem = 'api' AND situacao IN ('recebido', 'aguardando_pagamento')").bind(b).all()).results.map((x) => x.id);
    if (ids.length) {
      await env.DB.prepare("UPDATE atletas SET situacao = 'inscrito', motivo = '', atualizado_em = ? WHERE id IN (" + ids.map(() => "?").join(",") + ")")
        .bind(new Date().toISOString().slice(0, 19) + "Z", ...ids).run();
    }
    return json({ confirmados: ids.length, avisos: await avisaAtletas(env, ids) });
  }
  if (a === "inscricoes" && b && c === "atletas" && m === "GET") {
    return json((await env.DB.prepare("SELECT * FROM atletas WHERE inscricao_id = ? ORDER BY id").bind(b).all()).results);
  }

  throw new Erro(404, "Rota não encontrada.");
}

async function corpo(request) {
  const t = await request.text();
  if (t.length > 200000) throw new Erro(413, "Dados grandes demais.");
  try { const d = JSON.parse(t); if (d && typeof d === "object" && !Array.isArray(d)) return d; } catch (e) { /* cai no erro abaixo */ }
  throw new Erro(400, "Dados inválidos.");
}

export async function onRequest({ request, env, params, waitUntil }) {
  if (!env.DB) return json({ erro: "config", mensagem: "O banco D1 (binding DB) não está ligado a este projeto." }, 503);
  if (!env.ADMIN_SENHA || !env.SESSAO_SEGREDO) {
    return json({ erro: "config", mensagem: "Defina os segredos ADMIN_SENHA e SESSAO_SEGREDO no projeto do Cloudflare Pages." }, 503);
  }
  const url = new URL(request.url);
  const rota = [].concat(params.rota || []).map((x) => decodeURIComponent(x));
  try {
    return await trata(request, env, rota, url, waitUntil);
  } catch (e) {
    if (e instanceof Erro) return json({ erro: e.status, mensagem: e.message }, e.status);
    const msg = String((e && e.message) || e);
    if (/UNIQUE/i.test(msg)) return json({ erro: 409, mensagem: "Já existe um registro com esse identificador, cupom ou arquivo." }, 409);
    if (/FOREIGN KEY/i.test(msg)) return json({ erro: 400, mensagem: "Registro ligado a outro que não existe." }, 400);
    if (/no such table/i.test(msg)) return json({ erro: 503, mensagem: "Faltam tabelas no banco: rode d1/painel.sql e d1/schema.sql." }, 503);
    return json({ erro: 500, mensagem: "Erro no servidor." }, 500);
  }
}
