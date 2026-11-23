// /api/parceiro/* — cadastro e acesso dos parceiros (parceiro.html), no D1 (binding DB).
//
// O parceiro se cadastra (e-mail e senha ou Google) e fica "pendente" até a
// Tardim Produções aprovar no painel. A Tardim recebe aviso no painel e, se
// configurado, por e-mail (Resend). Cookie HttpOnly assinado com SESSAO_SEGREDO.
//
//   GET  config                 { google: client id ou "" }
//   GET  cidades?uf=MG          { uf, cidades }  (municípios do IBGE, functions/_cidades.js)
//   POST cadastro               { tipo, nome, responsavel, whatsapp, uf, cidade, instagram, seguidores, email, senha | credential, aceite }
//   POST login                  { email, senha }
//   POST google                 { credential }  -> entra, ou { novo: true, email, nome } para completar o cadastro
//   POST sair
//   GET  eu                     { email, parceiro, convites }   (convites só depois de aprovado)
//
// Segredos/variáveis: SESSAO_SEGREDO (obrigatório), GOOGLE_CLIENT_ID (login com Google),
// RESEND_API_KEY + AVISO_EMAIL (+ AVISO_REMETENTE opcional) para o e-mail de novo cadastro.

import { CIDADES } from "../../_cidades.js";

const COOKIE = "tardim_parceiro";
const DURACAO = 60 * 60 * 24 * 30; // 30 dias
const MAX_ERROS = 5, JANELA_ERROS = 15 * 60;
const MAX_CADASTROS = 5, JANELA_CADASTROS = 60 * 60;
const ITERACOES = 100000; // máximo do PBKDF2 no Cloudflare Workers
const TIPOS = { assessoria: "Assessoria", influenciador: "Influenciador", embaixador: "Embaixador" };
const RE_EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[a-z]{2,}$/i;

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
async function corpo(request) {
  const t = await request.text();
  if (t.length > 20000) throw new Erro(413, "Dados grandes demais.");
  try { const d = JSON.parse(t); if (d && typeof d === "object" && !Array.isArray(d)) return d; } catch (e) { /* abaixo */ }
  throw new Erro(400, "Dados inválidos.");
}
const texto = (v, max) => (typeof v === "string" ? v.trim() : "").slice(0, max);
// Nome da cidade sem acento e sem maiúsculas: "sao joao del rei" acha "São João del-Rei"
const chaveCidade = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function cidadeOficial(uf, nome) {
  const k = chaveCidade(nome);
  return k ? (CIDADES[uf] || []).find((c) => chaveCidade(c) === k) || "" : "";
}
const agoraIso =() => new Date().toISOString().replace(/\.\d+Z$/, "Z");

// ---------- criptografia ----------
const enc = new TextEncoder();
function b64url(bytes) {
  let b = ""; for (const x of bytes) b += String.fromCharCode(x);
  return btoa(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function deB64url(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
async function hmac(segredo, msg) {
  const k = await crypto.subtle.importKey("raw", enc.encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(msg))));
}
function iguais(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
async function pbkdf2(senha, sal, iter) {
  const k = await crypto.subtle.importKey("raw", enc.encode(senha), "PBKDF2", false, ["deriveBits"]);
  return b64url(new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: iter }, k, 256)));
}
async function hashSenha(senha) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  return "pbkdf2$" + ITERACOES + "$" + b64url(sal) + "$" + (await pbkdf2(senha, sal, ITERACOES));
}
async function confereSenha(senha, guardada) {
  const p = String(guardada || "").split("$");
  if (p.length !== 4 || p[0] !== "pbkdf2") return false;
  return iguais(await pbkdf2(senha, deB64url(p[2]), Number(p[1])), p[3]);
}

// ---------- Google (token de identidade do botão "Entrar com Google") ----------
async function chavesGoogle() {
  const r = await fetch("https://www.googleapis.com/oauth2/v3/certs", { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!r.ok) throw new Erro(502, "Não consegui falar com o Google agora. Tente de novo.");
  return (await r.json()).keys || [];
}
async function verificaGoogle(token, env) {
  if (!env.GOOGLE_CLIENT_ID) throw new Erro(503, "O login com Google ainda não foi configurado.");
  const partes = String(token || "").split(".");
  if (partes.length !== 3) throw new Erro(400, "Login do Google inválido.");
  let cab, dados;
  try {
    cab = JSON.parse(new TextDecoder().decode(deB64url(partes[0])));
    dados = JSON.parse(new TextDecoder().decode(deB64url(partes[1])));
  } catch (e) { throw new Erro(400, "Login do Google inválido."); }
  if (cab.alg !== "RS256") throw new Erro(400, "Login do Google inválido.");
  const jwk = (await chavesGoogle()).find((k) => k.kid === cab.kid);
  if (!jwk) throw new Erro(400, "Login do Google expirado. Tente de novo.");
  const chave = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", chave, deB64url(partes[2]), enc.encode(partes[0] + "." + partes[1]));
  const agora = Date.now() / 1000;
  if (!ok || dados.aud !== env.GOOGLE_CLIENT_ID || !/^(https:\/\/)?accounts\.google\.com$/.test(dados.iss) ||
      !(dados.exp > agora) || !dados.sub) throw new Erro(401, "Login do Google inválido. Tente de novo.");
  if (!dados.email || dados.email_verified !== true) throw new Erro(400, "Sua conta Google não tem e-mail confirmado.");
  return { sub: String(dados.sub), email: String(dados.email).toLowerCase(), nome: String(dados.name || "") };
}

// ---------- sessão ----------
const assina = (env, id, exp) => hmac(env.SESSAO_SEGREDO, "parceiro." + id + "." + exp);
async function cookieSessao(env, contaId) {
  const exp = Math.floor(Date.now() / 1000) + DURACAO;
  const v = contaId + "." + exp + "." + (await assina(env, contaId, exp));
  return `${COOKIE}=${v}; Path=/api/parceiro; HttpOnly; Secure; SameSite=Lax; Max-Age=${DURACAO}`;
}
const cookieFim = () => `${COOKIE}=; Path=/api/parceiro; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
async function contaDaSessao(request, env) {
  const m = (request.headers.get("Cookie") || "").match(new RegExp("(?:^|;\\s*)" + COOKIE + "=([^;]+)"));
  if (!m) return null;
  const [id, exp, sig] = m[1].split(".");
  if (!id || !sig || !(Number(exp) > Date.now() / 1000)) return null;
  if (!iguais(sig, await assina(env, id, exp))) return null;
  return env.DB.prepare("SELECT * FROM contas WHERE id = ?").bind(id).first();
}
async function entra(env, conta, extra) {
  await env.DB.prepare("UPDATE contas SET ultimo_acesso = ? WHERE id = ?").bind(agoraIso(), conta.id).run();
  return json(Object.assign({ ok: true }, extra || {}), 200, { "set-cookie": await cookieSessao(env, conta.id) });
}

// ---------- limite de tentativas (tabela login_erros, chave separada da do painel) ----------
async function limite(env, chave, max, janela, msg) {
  const agora = Math.floor(Date.now() / 1000);
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM login_erros WHERE ip = ? AND quando > ?").bind(chave, agora - janela).first();
  if (r && r.n >= max) throw new Erro(429, msg);
}
async function marca(env, chave) {
  const agora = Math.floor(Date.now() / 1000);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO login_erros (ip, quando) VALUES (?, ?)").bind(chave, agora),
    env.DB.prepare("DELETE FROM login_erros WHERE quando < ?").bind(agora - 86400),
  ]);
}
const ipDe = (request) => request.headers.get("CF-Connecting-IP") || "local";

// ---------- aviso de novo cadastro (Resend) ----------
async function avisaTardim(env, origem, p, email) {
  if (!env.RESEND_API_KEY || !env.AVISO_EMAIL) return;
  const linhas = [
    "Novo cadastro de parceiro no site, aguardando aprovação.", "",
    "Tipo: " + TIPOS[p.tipo], "Nome: " + p.nome,
    p.responsavel ? "Responsável: " + p.responsavel : "",
    "E-mail: " + email, p.whatsapp ? "WhatsApp: " + p.whatsapp : "",
    "Cidade: " + p.cidade + "/" + p.uf, p.instagram ? "Instagram: @" + p.instagram : "",
    p.seguidores ? "Seguidores (estimado): " + p.seguidores.toLocaleString("pt-BR") : "", "",
    "Aprovar ou recusar no painel: " + origem + "/admin.html",
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "");
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({
        from: env.AVISO_REMETENTE || "Tardim Produções <onboarding@resend.dev>",
        to: String(env.AVISO_EMAIL).split(",").map((s) => s.trim()).filter(Boolean),
        reply_to: email,
        subject: "Novo cadastro: " + p.nome + " (" + TIPOS[p.tipo] + ")",
        text: linhas.join("\n"),
      }),
    });
  } catch (e) { /* o aviso no painel continua valendo */ }
}

// ---------- rotas ----------
async function cadastro(request, env, ctx) {
  const ip = ipDe(request);
  await limite(env, "cad:" + ip, MAX_CADASTROS, JANELA_CADASTROS, "Muitos cadastros deste endereço. Tente de novo mais tarde.");
  const d = await corpo(request);
  const tipo = texto(d.tipo, 20);
  if (!TIPOS[tipo]) throw new Erro(400, "Escolha o tipo de parceiro.");
  const p = {
    tipo, nome: texto(d.nome, 120), responsavel: texto(d.responsavel, 120), whatsapp: texto(d.whatsapp, 20),
    uf: texto(d.uf, 2).toUpperCase(), cidade: "", seguidores: 0,
    // Aceita "@perfil", "perfil" ou o link do perfil
    instagram: texto(d.instagram, 100).replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, ""),
  };
  if (p.nome.length < 2) throw new Erro(400, tipo === "assessoria" ? "Informe o nome da assessoria." : "Informe o seu nome.");
  if (tipo === "assessoria" && p.responsavel.length < 2) throw new Erro(400, "Informe o nome do responsável pela assessoria.");
  if (p.whatsapp.replace(/\D/g, "").length < 10) throw new Erro(400, "Informe um WhatsApp com DDD.");
  if (!CIDADES[p.uf]) throw new Erro(400, "Escolha o estado.");
  p.cidade = cidadeOficial(p.uf, d.cidade);
  if (!p.cidade) throw new Erro(400, "Escolha a cidade na lista do estado " + p.uf + ".");
  if (p.instagram && !/^[\w.]{1,30}$/.test(p.instagram)) throw new Erro(400, "Perfil do Instagram inválido.");
  if (tipo === "influenciador") {
    if (!p.instagram) throw new Erro(400, "Informe o seu perfil do Instagram.");
    p.seguidores = parseInt(String(d.seguidores == null ? "" : d.seguidores).replace(/\D/g, ""), 10) || 0;
    if (p.seguidores < 1 || p.seguidores > 1000000000) throw new Erro(400, "Informe o número estimado de seguidores.");
  }
  if (d.aceite !== true) throw new Erro(400, "É preciso aceitar a política de privacidade e as regras do programa.");

  let email, senha = "", sub = null;
  if (d.credential) {
    const g = await verificaGoogle(d.credential, env);
    email = g.email; sub = g.sub;
  } else {
    email = texto(d.email, 120).toLowerCase();
    if (!RE_EMAIL.test(email)) throw new Erro(400, "E-mail inválido.");
    const s = typeof d.senha === "string" ? d.senha : "";
    if (s.length < 8 || s.length > 200) throw new Erro(400, "A senha precisa ter pelo menos 8 caracteres.");
    senha = await hashSenha(s);
  }
  if (await env.DB.prepare("SELECT 1 FROM contas WHERE email = ?").bind(email).first()) {
    throw new Erro(409, "Já existe um cadastro com este e-mail. Use \"Entrar\".");
  }
  const pid = crypto.randomUUID(), cid = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO parceiros (id, tipo, nome, responsavel, whatsapp, email, instagram, cidade, uf, seguidores, ativo, situacao, origem) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pendente', 'cadastro')"
    ).bind(pid, p.tipo, p.nome, p.responsavel, p.whatsapp, email, p.instagram, p.cidade, p.uf, p.seguidores),
    env.DB.prepare("INSERT INTO contas (id, parceiro_id, email, senha, google_sub) VALUES (?, ?, ?, ?, ?)").bind(cid, pid, email, senha, sub),
  ]);
  await marca(env, "cad:" + ip);
  ctx.waitUntil(avisaTardim(env, new URL(request.url).origin, p, email));
  return entra(env, { id: cid });
}

async function loginSenha(request, env) {
  const chave = "parc:" + ipDe(request);
  await limite(env, chave, MAX_ERROS, JANELA_ERROS, "Muitas tentativas erradas. Espere 15 minutos e tente de novo.");
  const d = await corpo(request);
  const email = texto(d.email, 120).toLowerCase();
  const senha = typeof d.senha === "string" ? d.senha.slice(0, 200) : "";
  const conta = email ? await env.DB.prepare("SELECT * FROM contas WHERE email = ?").bind(email).first() : null;
  if (!conta || !senha || !(await confereSenha(senha, conta.senha))) {
    await marca(env, chave);
    await new Promise((r) => setTimeout(r, 600));
    if (conta && !conta.senha) throw new Erro(401, "Este e-mail entra pelo botão \"Entrar com Google\".");
    throw new Erro(401, "E-mail ou senha incorretos.");
  }
  return entra(env, conta);
}

async function loginGoogle(request, env) {
  const d = await corpo(request);
  const g = await verificaGoogle(d.credential, env);
  let conta = await env.DB.prepare("SELECT * FROM contas WHERE google_sub = ?").bind(g.sub).first();
  if (!conta) {
    // Mesma pessoa que se cadastrou com e-mail e senha: liga a conta Google (o Google confirmou o e-mail)
    conta = await env.DB.prepare("SELECT * FROM contas WHERE email = ?").bind(g.email).first();
    if (conta) await env.DB.prepare("UPDATE contas SET google_sub = ? WHERE id = ?").bind(g.sub, conta.id).run();
  }
  if (!conta) return json({ novo: true, email: g.email, nome: g.nome });
  return entra(env, conta);
}

async function eu(request, env) {
  const conta = await contaDaSessao(request, env);
  if (!conta) throw new Erro(401, "Entre na sua conta.");
  const p = await env.DB.prepare(
    "SELECT id, tipo, nome, responsavel, whatsapp, instagram, cidade, logo, cor, ativo, situacao, motivo_recusa, criado_em FROM parceiros WHERE id = ?"
  ).bind(conta.parceiro_id).first();
  if (!p) throw new Erro(401, "Cadastro não encontrado. Fale com a Tardim Produções.");
  let convites = [];
  if (p.situacao === "aprovado" && p.ativo) {
    convites = (await env.DB.prepare(
      "SELECT id, prova_id, cupom, desconto, comissao_pct, cortesias, contrapartida, condicoes, coletiva FROM convites WHERE parceiro_id = ? ORDER BY criado_em DESC"
    ).bind(p.id).all()).results.map((c) => {
      try { c.coletiva = JSON.parse(c.coletiva || "{}"); } catch (e) { c.coletiva = {}; }
      return c;
    });
  }
  p.ativo = !!p.ativo;
  return json({ email: conta.email, google: !!conta.google_sub, senha: !!conta.senha, parceiro: p, convites });
}

async function trata(request, env, ctx, rota) {
  const m = request.method, [a, b] = rota;
  if (b) throw new Erro(404, "Rota não encontrada.");
  if (m !== "GET" && !mesmaOrigem(request)) throw new Erro(403, "Origem não permitida.");
  if (a === "config" && m === "GET") return json({ google: env.GOOGLE_CLIENT_ID || "" });
  if (a === "cidades" && m === "GET") {
    const uf = String(new URL(request.url).searchParams.get("uf") || "").toUpperCase();
    if (!CIDADES[uf]) throw new Erro(400, "Estado inválido.");
    return json({ uf, cidades: CIDADES[uf] }, 200, { "cache-control": "public, max-age=86400" });
  }
  if (a === "cadastro" && m === "POST") return cadastro(request, env, ctx);
  if (a === "login" && m === "POST") return loginSenha(request, env);
  if (a === "google" && m === "POST") return loginGoogle(request, env);
  if (a === "sair" && m === "POST") return json({ ok: true }, 200, { "set-cookie": cookieFim() });
  if (a === "eu" && m === "GET") return eu(request, env);
  throw new Erro(404, "Rota não encontrada.");
}

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  if (!env.DB || !env.SESSAO_SEGREDO) return json({ erro: "config", mensagem: "O cadastro de parceiros ainda não foi configurado." }, 503);
  const rota = [].concat(params.rota || []).map((x) => decodeURIComponent(x));
  try {
    return await trata(request, env, ctx, rota);
  } catch (e) {
    if (e instanceof Erro) return json({ erro: e.status, mensagem: e.message }, e.status);
    const msg = String((e && e.message) || e);
    if (/UNIQUE/i.test(msg)) return json({ erro: 409, mensagem: "Já existe um cadastro com este e-mail ou conta Google." }, 409);
    if (/no such (table|column)/i.test(msg)) return json({ erro: 503, mensagem: "Falta atualizar o banco: rode d1/migracoes/002-contas-parceiros.sql." }, 503);
    return json({ erro: 500, mensagem: "Erro no servidor." }, 500);
  }
}
