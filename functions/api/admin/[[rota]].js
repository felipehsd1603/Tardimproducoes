// /api/admin/* — API do painel (admin.html), no D1 (binding DB).
//
// Login com senha única guardada como segredo do projeto (ADMIN_SENHA) e
// cookie HttpOnly assinado com outro segredo (SESSAO_SEGREDO). Trocar a senha
// derruba todas as sessões. Nenhuma senha fica em arquivo do repositório.
//
//   POST   login            { senha }
//   POST   sair
//   GET    sessao
//   GET    dados            { provas, parceiros, convites }
//   GET    provas | parceiros | convites
//   POST   provas | parceiros | convites            (cria)
//   PUT    provas/<id> | parceiros/<id> | convites/<id>   (altera só os campos enviados)
//   DELETE provas/<id> | parceiros/<id> | convites/<id>
//   POST   arquivos?caminho=provas/<nome>.jpg       (corpo = a imagem)
//   GET    orcamentos | inscricoes | inscricoes/<id>/atletas
//   GET    cref6?numero=012345-G/MG                 (consulta pública do CREF6, functions/_cref6.js)
//
// Cadastros feitos pelo site (parceiro.html) chegam como parceiros com situacao "pendente";
// aprovar = PUT parceiros/<id> { situacao: "aprovado", ativo: true }.

import { consultaCref6, numeroCref } from "../../_cref6.js";

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
      x = JSON.stringify(x == null ? (campo === "kit" ? { itens: [], retirada: "" } : []) : x);
      if (x.length > 20000) throw new Erro(400, "O campo " + campo + " está grande demais.");
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
    if (def.campos[c] === "json") { try { o[c] = JSON.parse(o[c]); } catch (e) { o[c] = c === "kit" ? { itens: [], retirada: "" } : []; } }
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
    passos.push(env.DB.prepare("DELETE FROM contas WHERE parceiro_id = ?").bind(id));
  }
  passos.push(env.DB.prepare(`DELETE FROM ${tabela} WHERE id = ?`).bind(id));
  await env.DB.batch(passos);
  return { ok: true };
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

// ---------- rotas ----------
async function trata(request, env, rota, url) {
  const m = request.method;
  const [a, b, c] = rota;

  if (m !== "GET" && !mesmaOrigem(request)) throw new Erro(403, "Origem não permitida.");
  if (a === "login" && m === "POST") return login(request, env);
  if (a === "sair" && m === "POST") return json({ ok: true }, 200, { "set-cookie": cookie("", 0) });

  if (!(await sessaoValida(request, env))) throw new Erro(401, "Entre no painel.");

  if (a === "sessao" && m === "GET") return json({ ok: true });
  if (a === "dados" && m === "GET") {
    const [provas, parceiros, convites] = await Promise.all([lista(env, "provas"), lista(env, "parceiros"), lista(env, "convites")]);
    return json({ provas, parceiros, convites });
  }
  if (a === "arquivos" && m === "POST" && !b) return enviaArquivo(request, env, url);
  // Consulta ao CREF6 só para quem está no painel (não vira proxy aberto do CREF)
  if (a === "cref6" && m === "GET" && !b) return json(await consultaCref6(url.searchParams.get("numero") || ""));

  if (TABELAS[a]) {
    if (!b && m === "GET") return json(await lista(env, a));
    if (!b && m === "POST") return json(await cria(env, a, await corpo(request)), 201);
    if (b && !c && m === "PUT") return json(await altera(env, a, b, await corpo(request)));
    if (b && !c && m === "DELETE") return json(await apaga(env, a, b));
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
  if (a === "inscricoes" && b && c === "atletas" && m === "GET") {
    return json((await env.DB.prepare("SELECT * FROM atletas WHERE inscricao_id = ? ORDER BY id").bind(b).all()).results);
  }

  throw new Erro(404, "Rota não encontrada.");
}

async function corpo(request) {
  const t = await request.text();
  if (t.length > 60000) throw new Erro(413, "Dados grandes demais.");
  try { const d = JSON.parse(t); if (d && typeof d === "object" && !Array.isArray(d)) return d; } catch (e) { /* cai no erro abaixo */ }
  throw new Erro(400, "Dados inválidos.");
}

export async function onRequest({ request, env, params }) {
  if (!env.DB) return json({ erro: "config", mensagem: "O banco D1 (binding DB) não está ligado a este projeto." }, 503);
  if (!env.ADMIN_SENHA || !env.SESSAO_SEGREDO) {
    return json({ erro: "config", mensagem: "Defina os segredos ADMIN_SENHA e SESSAO_SEGREDO no projeto do Cloudflare Pages." }, 503);
  }
  const url = new URL(request.url);
  const rota = [].concat(params.rota || []).map((x) => decodeURIComponent(x));
  try {
    return await trata(request, env, rota, url);
  } catch (e) {
    if (e instanceof Erro) return json({ erro: e.status, mensagem: e.message }, e.status);
    const msg = String((e && e.message) || e);
    if (/UNIQUE/i.test(msg)) return json({ erro: 409, mensagem: "Já existe um registro com esse identificador, cupom ou arquivo." }, 409);
    if (/FOREIGN KEY/i.test(msg)) return json({ erro: 400, mensagem: "Registro ligado a outro que não existe." }, 400);
    if (/no such table/i.test(msg)) return json({ erro: 503, mensagem: "Faltam tabelas no banco: rode d1/painel.sql e d1/schema.sql." }, 503);
    return json({ erro: 500, mensagem: "Erro no servidor." }, 500);
  }
}
