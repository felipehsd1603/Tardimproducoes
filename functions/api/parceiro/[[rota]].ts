// /api/parceiro/* — cadastro e acesso dos parceiros (parceiro.html), no D1 (binding DB).
//
// O parceiro se cadastra (e-mail e senha ou Google) e fica "pendente" até a
// Tardim Produções aprovar no painel. A Tardim recebe aviso no painel e, se
// configurado, por e-mail (Resend). Cookie HttpOnly assinado com SESSAO_SEGREDO.
//
//   GET  config                 { google: client id ou "" }
//   GET  cidades?uf=MG          { uf, cidades }  (municípios do IBGE, functions/_lib/cidades.ts)
//   POST cadastro               { tipos: [assessoria|influenciador|embaixador...], cref (embaixador = profissional de Ed. Física), nome, whatsapp, uf, cidade, instagram, seguidores, youtube,
//                                 assessoria_nome, cnpj, assessoria_instagram, email, senha | credential, aceite }
//                               Um perfil (linha em parceiros) por tipo marcado, todos no mesmo login (parceiros.conta_id).
//                               Assessoria exige CNPJ válido (guardado em parceiros.documento).
//                               Com e-mail e senha (e Resend configurado): { confirmar: true } e um link por e-mail;
//                               nada é gravado antes da confirmação e a resposta é a mesma se o e-mail já tem conta.
//   POST confirmar              { token }  -> grava o cadastro do link do e-mail (24 horas) e já entra
//   POST login                  { email, senha }
//   POST google                 { credential }  -> entra, ou { novo: true, email, nome } para completar o cadastro
//   POST esqueci                { email }  -> manda por e-mail o link para criar senha nova (1 hora, uso único)
//   POST nova-senha             { token, senha }  -> troca a senha e já entra
//   POST sair
//   GET  eu                    { email, perfis: [parceiro + convites] }   (convites só depois de aprovado)
//   GET  tiktok-conectar?perfil=<id>   -> TikTok (Login Kit) para o influenciador autorizar
//   GET  tiktok-retorno?code&state     <- volta do TikTok; grava e manda para parceiro#tiktok=ok|erro
//   POST tiktok-desconectar     { perfil }  -> revoga no TikTok e apaga os tokens
//
// Segredos/variáveis: SESSAO_SEGREDO (obrigatório), GOOGLE_CLIENT_ID (login com Google),
// RESEND_API_KEY + AVISO_EMAIL (+ AVISO_REMETENTE opcional) para o e-mail de novo cadastro.

import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";
import { CIDADES } from "../../_lib/cidades.ts";
import { segmentos, metodo, type AppHono } from "../../_lib/hono.ts";
import type { Env, Contexto, Dados, Conta, Contagem, ComEspera, Parceiro } from "../../_lib/tipos.ts";
import { confereInstagramParceiro } from "../../_lib/instagram.ts";
import { canalYoutube, confereYoutubeParceiro } from "../../_lib/youtube.ts";
import { configurado as tiktokPronto, criaEstado, leEstado, urlAutorizacao, trocaCodigo, conectaParceiro, desconectaParceiro } from "../../_lib/tiktok.ts";
import { json, mesmaOrigem, enc, b64url, deB64url, hmacB64url as hmac, iguais } from "../../_lib/http.ts";

const COOKIE = "tardim_parceiro";
const DURACAO = 60 * 60 * 24 * 30; // 30 dias
const MAX_ERROS = 5, JANELA_ERROS = 15 * 60, MAX_ERROS_EMAIL = 10;
const MAX_CADASTROS = 5, JANELA_CADASTROS = 60 * 60;
const ITERACOES = 100000; // máximo do PBKDF2 no Cloudflare Workers
// Três categorias com o mesmo benefício. A chave "embaixador" ficou no banco; na tela é o profissional de Educação Física.
const TIPOS: Record<string, string> = { assessoria: "Assessoria, grupo ou equipe", influenciador: "Influenciador", embaixador: "Profissional de Educação Física" };
const RE_EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[a-z]{2,}$/i;

class Erro extends Error {
  status: number;
  constructor(status: number, mensagem: string) { super(mensagem); this.status = status; }
}
async function corpo(request: Request): Promise<Dados> {
  const t = await request.text();
  if (t.length > 20000) throw new Erro(413, "Dados grandes demais.");
  try { const d = JSON.parse(t); if (d && typeof d === "object" && !Array.isArray(d)) return d; } catch (e) { /* abaixo */ }
  throw new Erro(400, "Dados inválidos.");
}
const texto = (v: unknown, max: number): string => (typeof v === "string" ? v.trim() : "").slice(0, max);
// Nome da cidade sem acento e sem maiúsculas: "sao joao del rei" acha "São João del-Rei"
const chaveCidade = (s: unknown): string => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function cidadeOficial(uf: string, nome: unknown): string {
  const k = chaveCidade(nome);
  return k ? (CIDADES[uf] || []).find((c) => chaveCidade(c) === k) || "" : "";
}
const agoraIso =() => new Date().toISOString().replace(/\.\d+Z$/, "Z");
// CNPJ com dígitos verificadores; devolve "00.000.000/0000-00" ou "" se inválido
function cnpjValido(v: unknown): string {
  const d = String(v || "").replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return "";
  const dv = (n: number): number => {
    let s = 0, p = n - 7;
    for (let i = 0; i < n; i++) { s += Number(d[i]) * p--; if (p < 2) p = 9; }
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  if (dv(12) !== Number(d[12]) || dv(13) !== Number(d[13])) return "";
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}
const limpaInsta = (v: unknown): string => texto(v, 100).replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "");

// ---------- criptografia (comuns em functions/_lib/http.ts) ----------
async function pbkdf2(senha: string, sal: Uint8Array, iter: number): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(senha), "PBKDF2", false, ["deriveBits"]);
  return b64url(new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: iter }, k, 256)));
}
async function hashSenha(senha: string): Promise<string> {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  return "pbkdf2$" + ITERACOES + "$" + b64url(sal) + "$" + (await pbkdf2(senha, sal, ITERACOES));
}
async function confereSenha(senha: string, guardada: unknown): Promise<boolean> {
  const p = String(guardada || "").split("$");
  if (p.length !== 4 || p[0] !== "pbkdf2") return false;
  return iguais(await pbkdf2(senha, deB64url(p[2]), Number(p[1])), p[3]);
}

// ---------- Google (token de identidade do botão "Entrar com Google") ----------
async function chavesGoogle(): Promise<(JsonWebKey & { kid?: string })[]> {
  const r = await fetch("https://www.googleapis.com/oauth2/v3/certs", { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!r.ok) throw new Erro(502, "Não consegui falar com o Google agora. Tente de novo.");
  return (await r.json<Dados>()).keys || [];
}
async function verificaGoogle(token: unknown, env: Env): Promise<{ sub: string; email: string; nome: string }> {
  if (!env.GOOGLE_CLIENT_ID) throw new Erro(503, "O login com Google ainda não foi configurado.");
  const partes = String(token || "").split(".");
  if (partes.length !== 3) throw new Erro(400, "Login do Google inválido.");
  let cab: Dados, dados: Dados;
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
const assina = (env: Env, id: string, exp: number | string): Promise<string> => hmac(env.SESSAO_SEGREDO as string, "parceiro." + id + "." + exp);
async function cookieSessao(env: Env, contaId: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + DURACAO;
  const v = contaId + "." + exp + "." + (await assina(env, contaId, exp));
  return `${COOKIE}=${v}; Path=/api/parceiro; HttpOnly; Secure; SameSite=Lax; Max-Age=${DURACAO}`;
}
const cookieFim = () => `${COOKIE}=; Path=/api/parceiro; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
async function contaDaSessao(request: Request, env: Env): Promise<Conta | null> {
  const m = (request.headers.get("Cookie") || "").match(new RegExp("(?:^|;\\s*)" + COOKIE + "=([^;]+)"));
  if (!m) return null;
  const [id, exp, sig] = m[1].split(".");
  if (!id || !sig || !(Number(exp) > Date.now() / 1000)) return null;
  if (!iguais(sig, await assina(env, id, exp))) return null;
  return env.DB.prepare("SELECT * FROM contas WHERE id = ?").bind(id).first<Conta>();
}
async function entra(env: Env, conta: Pick<Conta, "id">, extra?: Dados): Promise<Response> {
  await env.DB.prepare("UPDATE contas SET ultimo_acesso = ? WHERE id = ?").bind(agoraIso(), conta.id).run();
  return json(Object.assign({ ok: true }, extra || {}), 200, { "set-cookie": await cookieSessao(env, conta.id) });
}

// ---------- limite de tentativas (tabela login_erros, chave separada da do painel) ----------
async function limite(env: Env, chave: string, max: number, janela: number, msg: string): Promise<void> {
  const agora = Math.floor(Date.now() / 1000);
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM login_erros WHERE ip = ? AND quando > ?").bind(chave, agora - janela).first<Contagem>();
  if (r && r.n >= max) throw new Erro(429, msg);
}
async function marca(env: Env, chave: string): Promise<void> {
  const agora = Math.floor(Date.now() / 1000);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO login_erros (ip, quando) VALUES (?, ?)").bind(chave, agora),
    env.DB.prepare("DELETE FROM login_erros WHERE quando < ?").bind(agora - 86400),
  ]);
}
const ipDe = (request: Request): string => request.headers.get("CF-Connecting-IP") || "local";

// ---------- aviso de novo cadastro (Resend) ----------
/** Perfil (linha de parceiros) montado no cadastro. */
interface Perfil {
  id?: string; tipo: string; nome: string; responsavel: string; documento: string; instagram: string; seguidores: number;
  youtube?: string; whatsapp?: string; cidade?: string; uf?: string; profissao?: string; registro?: string;
}
/** O que vai cifrado no link de confirmação do e-mail. */
interface CadastroPendente { perfis: Perfil[]; email: string; senha: string; exp?: number }

async function avisaTardim(env: Env, origem: string, perfis: Perfil[], email: string): Promise<void> {
  if (!env.RESEND_API_KEY || !env.AVISO_EMAIL) return;
  const p = perfis[0];
  const tipos = perfis.map((x) => TIPOS[x.tipo]).join(" + ");
  const linhas = [
    "Novo cadastro de parceiro no site, aguardando aprovação" + (perfis.length > 1 ? " (" + perfis.length + " perfis, aprove cada um)" : "") + ".", "",
    "Tipo: " + tipos, "E-mail: " + email, p.whatsapp ? "WhatsApp: " + p.whatsapp : "", "Cidade: " + p.cidade + "/" + p.uf,
  ];
  perfis.forEach((x) => {
    linhas.push("", TIPOS[x.tipo] + ": " + x.nome,
      x.responsavel ? "Responsável: " + x.responsavel : "", x.documento ? "CNPJ: " + x.documento : "", x.registro ? "CREF: " + x.registro : "",
      x.instagram ? "Instagram: @" + x.instagram : "",
      x.youtube ? "YouTube: " + x.youtube : "",
      x.seguidores ? "Seguidores (estimado): " + x.seguidores.toLocaleString("pt-BR") : "");
  });
  linhas.push("", "Aprovar ou recusar no painel: " + origem + "/admin.html");
  const corpoTxt = linhas.filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({
        from: env.AVISO_REMETENTE || "Tardim Produções <onboarding@resend.dev>",
        to: String(env.AVISO_EMAIL).split(",").map((s) => s.trim()).filter(Boolean),
        reply_to: email,
        subject: "Novo cadastro: " + perfis.map((x) => x.nome).filter((n, i, a) => a.indexOf(n) === i).join(" / ") + " (" + tipos + ")",
        text: corpoTxt,
      }),
    });
  } catch (e) { /* o aviso no painel continua valendo */ }
}

// ---------- rotas ----------
async function cadastro(request: Request, env: Env, ctx: ComEspera): Promise<Response> {
  const ip = ipDe(request);
  await limite(env, "cad:" + ip, MAX_CADASTROS, JANELA_CADASTROS, "Muitos cadastros deste endereço. Tente de novo mais tarde.");
  const d = await corpo(request);
  // Um ou mais tipos (aceita também o antigo { tipo })
  const pedidos = ([] as unknown[]).concat(Array.isArray(d.tipos) ? d.tipos : d.tipo ? [d.tipo] : []).map((t) => texto(t, 20));
  const tipos = Object.keys(TIPOS).filter((t) => pedidos.includes(t));
  if (!tipos.length || tipos.length !== new Set(pedidos).size) throw new Erro(400, "Marque se você é assessoria/grupo/equipe, influenciador e/ou profissional de Educação Física.");
  const tem = (t: string): boolean => tipos.includes(t);
  const comum = {
    nome: texto(d.nome, 120), whatsapp: texto(d.whatsapp, 20), uf: texto(d.uf, 2).toUpperCase(), cidade: "",
    instagram: limpaInsta(d.instagram), // aceita "@perfil", "perfil" ou o link do perfil
  };
  if (comum.nome.length < 2) throw new Erro(400, "Informe o seu nome.");
  if (comum.whatsapp.replace(/\D/g, "").length < 10) throw new Erro(400, "Informe um WhatsApp com DDD.");
  if (!CIDADES[comum.uf]) throw new Erro(400, "Escolha o estado.");
  comum.cidade = cidadeOficial(comum.uf, d.cidade);
  if (!comum.cidade) throw new Erro(400, "Escolha a cidade na lista do estado " + comum.uf + ".");
  if (comum.instagram && !/^[\w.]{1,30}$/.test(comum.instagram)) throw new Erro(400, "Perfil do Instagram inválido.");

  const perfis: Perfil[] = [];
  if (tem("assessoria")) {
    const a: Perfil = { tipo: "assessoria", nome: texto(d.assessoria_nome, 120), responsavel: comum.nome,
      documento: cnpjValido(d.cnpj), instagram: limpaInsta(d.assessoria_instagram), seguidores: 0 };
    if (a.nome.length < 2) throw new Erro(400, "Informe o nome da assessoria, grupo ou equipe.");
    // Grupos e equipes nem sempre têm CNPJ: é opcional, mas se vier precisa ser válido
    if (texto(d.cnpj, 20).replace(/\D/g, "") && !a.documento) throw new Erro(400, "CNPJ inválido. Confira os números ou deixe em branco.");
    if (a.instagram && !/^[\w.]{1,30}$/.test(a.instagram)) throw new Erro(400, "Instagram da assessoria inválido.");
    perfis.push(a);
  }
  if (tem("influenciador")) {
    if (!comum.instagram) throw new Erro(400, "Informe o seu perfil do Instagram.");
    const seguidores = parseInt(String(d.seguidores == null ? "" : d.seguidores).replace(/\D/g, ""), 10) || 0;
    if (seguidores < 1 || seguidores > 1000000000) throw new Erro(400, "Informe o número estimado de seguidores.");
    // canal do YouTube: opcional; aceita "@canal" ou o link
    const youtube = d.youtube ? canalYoutube(texto(d.youtube, 100)) : "";
    if (d.youtube && !youtube) throw new Erro(400, "Canal do YouTube inválido. Use o @ do canal ou o link dele.");
    perfis.push({ tipo: "influenciador", nome: comum.nome, responsavel: "", documento: "", instagram: comum.instagram, seguidores, youtube });
  }
  if (tem("embaixador")) {
    // Só profissionais de Educação Física: o registro no CREF é obrigatório (o de MG o painel confere no CREF6)
    const registro = texto(d.cref, 30);
    if (registro.replace(/\D/g, "").length < 3) throw new Erro(400, "Informe o seu registro no CREF.");
    const profissao = comum.uf === "MG" ? "Profissional de Educação Física (CREF6/MG)" : "Profissional de Educação Física (outro CREF)";
    perfis.push({ tipo: "embaixador", nome: comum.nome, responsavel: "", documento: "", instagram: comum.instagram, seguidores: 0, profissao, registro });
  }
  perfis.forEach((x) => Object.assign(x, { whatsapp: comum.whatsapp, cidade: comum.cidade, uf: comum.uf }));
  if (d.aceite !== true) throw new Erro(400, "É preciso aceitar a política de privacidade e as regras do programa.");

  let email: string, senha = "", sub: string | null = null;
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
  const existe = await env.DB.prepare("SELECT 1 FROM contas WHERE email = ?").bind(email).first();
  // Com e-mail e senha: nada é gravado antes de a pessoa abrir o link do e-mail, e a resposta é a mesma
  // com ou sem cadastro (quem já tem conta recebe um e-mail explicando como entrar). Sem o Resend
  // configurado (servidor local), cadastra direto como antes.
  if (!sub && env.RESEND_API_KEY) {
    await marca(env, "cad:" + ip);
    await mandaConfirmacao(env, new URL(request.url).origin, email, existe ? null : { perfis, email, senha });
    return json({ ok: true, confirmar: true, email });
  }
  if (existe) {
    // Conta no limite por IP: sem isso, dá para testar à vontade quais e-mails têm cadastro
    await marca(env, "cad:" + ip);
    throw new Erro(409, "Já existe um cadastro com este e-mail. Use \"Entrar\".");
  }
  await marca(env, "cad:" + ip);
  return criaConta(env, ctx, new URL(request.url).origin, perfis, email, senha, sub);
}

// Grava os perfis e o login, avisa a Tardim e já entra (cadastro com Google, ou e-mail confirmado)
async function criaConta(env: Env, ctx: ComEspera, origem: string, perfis: Perfil[], email: string, senha: string, sub: string | null): Promise<Response> {
  const cid = crypto.randomUUID();
  perfis.forEach((x) => { x.id = crypto.randomUUID(); });
  await env.DB.batch(perfis.map((x) => env.DB.prepare(
    "INSERT INTO parceiros (id, tipo, nome, responsavel, whatsapp, email, instagram, youtube, cidade, uf, seguidores, documento, profissao, registro, conta_id, ativo, situacao, origem) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pendente', 'cadastro')"
  ).bind(x.id, x.tipo, x.nome, x.responsavel, x.whatsapp, email, x.instagram, x.youtube || "", x.cidade, x.uf, x.seguidores, x.documento, x.profissao || "", x.registro || "", cid)).concat([
    env.DB.prepare("INSERT INTO contas (id, parceiro_id, email, senha, google_sub) VALUES (?, ?, ?, ?, ?)").bind(cid, perfis[0].id, email, senha, sub),
  ]));
  ctx.waitUntil(avisaTardim(env, origem, perfis, email));
  // Já confere os seguidores reais para a tela de aprovação (sem IG_TOKEN, não faz nada)
  perfis.forEach((x) => { if (x.instagram) ctx.waitUntil(confereInstagramParceiro(env, x.id as string).catch(() => {})); });
  perfis.forEach((x) => { if (x.youtube) ctx.waitUntil(confereYoutubeParceiro(env, x.id as string).catch(() => {})); });
  return entra(env, { id: cid });
}

// ---------- confirmação do e-mail (cadastro com senha) ----------
// O link leva os dados do cadastro cifrados (AES-GCM, chave derivada do SESSAO_SEGREDO) e vale 24 horas.
// Depois de confirmado, o e-mail já tem conta e o mesmo link não cria outra.
const VALIDADE_CONFIRMACAO = 24 * 60 * 60;
async function chaveConfirmacao(env: Env): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(env.SESSAO_SEGREDO as string), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode("tardim-parceiro"), info: enc.encode("confirmacao-cadastro-v1") },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function cifraCadastro(env: Env, dados: CadastroPendente): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await chaveConfirmacao(env), enc.encode(JSON.stringify(dados)));
  return b64url(iv) + "." + b64url(new Uint8Array(c));
}
async function decifraCadastro(env: Env, token: string): Promise<CadastroPendente | null> {
  try {
    const [iv, c] = token.split(".");
    const t = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64url(iv) }, await chaveConfirmacao(env), deB64url(c));
    return JSON.parse(new TextDecoder().decode(t));
  } catch (e) {
    return null;
  }
}

async function enviaEmail(env: Env, para: string, assunto: string, linhas: string[]): Promise<void> {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.AVISO_REMETENTE || "Tardim Produções <onboarding@resend.dev>",
      to: [para], subject: assunto, text: linhas.join("\n"),
    }),
  }).catch(() => null);
  if (!r || !r.ok) throw new Erro(502, "Não consegui enviar o e-mail agora. Tente de novo em alguns minutos ou fale com a Tardim pelo WhatsApp.");
}

// cadastro = null: o e-mail já tem conta, então o e-mail só explica como entrar
async function mandaConfirmacao(env: Env, origem: string, email: string, cadastro: CadastroPendente | null): Promise<void> {
  if (!cadastro) {
    return enviaEmail(env, email, "Você já tem cadastro · Área do parceiro Tardim Produções", [
      "Olá!", "",
      "Alguém tentou fazer um cadastro de parceiro da Tardim Produções com este e-mail, mas ele já tem cadastro.",
      "Para entrar, use o seu e-mail e a sua senha (ou o botão \"Entrar com Google\") em:", "",
      origem + "/parceiro.html", "",
      "Esqueceu a senha? Na mesma página, use \"Esqueci minha senha\".",
      "Se não foi você, ignore este e-mail: nada mudou na sua conta.", "",
      "Tardim Produções",
    ]);
  }
  const token = await cifraCadastro(env, Object.assign({ exp: Math.floor(Date.now() / 1000) + VALIDADE_CONFIRMACAO }, cadastro));
  return enviaEmail(env, email, "Confirme o seu cadastro · Área do parceiro Tardim Produções", [
    "Olá!", "",
    "Para concluir o seu cadastro de parceiro da Tardim Produções, abra o link abaixo (vale por 24 horas):", "",
    origem + "/parceiro.html#confirmar=" + token, "",
    "Depois disso, a Tardim confere os seus dados e avisa quando o cadastro for aprovado.",
    "Se não foi você, ignore este e-mail: nenhum cadastro é feito sem a confirmação.", "",
    "Tardim Produções",
  ]);
}

async function confirma(request: Request, env: Env, ctx: ComEspera): Promise<Response> {
  const chave = "parc:" + ipDe(request);
  await limite(env, chave, MAX_ERROS, JANELA_ERROS, "Muitas tentativas. Espere 15 minutos e tente de novo.");
  const d = await corpo(request);
  const c = await decifraCadastro(env, texto(d.token, 8000));
  if (!c || !(Number(c.exp) > Date.now() / 1000) || !Array.isArray(c.perfis) || !c.perfis.length || !c.email) {
    await marca(env, chave);
    throw new Erro(400, "Este link expirou ou não é válido. Faça o cadastro de novo.");
  }
  if (await env.DB.prepare("SELECT 1 FROM contas WHERE email = ?").bind(c.email).first()) {
    throw new Erro(409, "Este cadastro já foi confirmado. Entre com o seu e-mail e a sua senha.");
  }
  return criaConta(env, ctx, new URL(request.url).origin, c.perfis, c.email, c.senha || "", null);
}

async function loginSenha(request: Request, env: Env): Promise<Response> {
  const chave = "parc:" + ipDe(request);
  await limite(env, chave, MAX_ERROS, JANELA_ERROS, "Muitas tentativas erradas. Espere 15 minutos e tente de novo.");
  const d = await corpo(request);
  const email = texto(d.email, 120).toLowerCase();
  // Também por e-mail: tentativas vindas de muitos IPs contra a mesma conta (mais folgado que o por IP,
  // para um ataque não trancar o dono fácil; "Esqueci a senha" continua funcionando)
  const chaveEmail = "parc-email:" + email;
  if (email) await limite(env, chaveEmail, MAX_ERROS_EMAIL, JANELA_ERROS, "Muitas tentativas erradas neste e-mail. Espere 15 minutos ou use \"Esqueci a senha\".");
  const senha = typeof d.senha === "string" ? d.senha.slice(0, 200) : "";
  const conta = email ? await env.DB.prepare("SELECT * FROM contas WHERE email = ?").bind(email).first<Conta>() : null;
  if (!conta || !senha || !(await confereSenha(senha, conta.senha))) {
    await marca(env, chave);
    if (email) await marca(env, chaveEmail);
    await new Promise((r) => setTimeout(r, 600));
    if (conta && !conta.senha) throw new Erro(401, "Este e-mail entra pelo botão \"Entrar com Google\".");
    throw new Erro(401, "E-mail ou senha incorretos.");
  }
  return entra(env, conta);
}

// ---------- esqueci a senha ----------
// Link assinado (sem tabela nova): conta.expira.assinatura, com a assinatura amarrada ao hash da
// senha atual. Trocou a senha, o link para de valer; vale por 1 hora.
const VALIDADE_LINK = 60 * 60;
const MAX_PEDIDOS = 5, JANELA_PEDIDOS = 60 * 60;
const assinaTroca = (env: Env, conta: Conta, exp: number | string): Promise<string> => hmac(env.SESSAO_SEGREDO as string, "senha." + conta.id + "." + exp + "." + (conta.senha || ""));

async function esqueci(request: Request, env: Env): Promise<Response> {
  const ip = ipDe(request);
  await limite(env, "esq:" + ip, MAX_PEDIDOS, JANELA_PEDIDOS, "Muitos pedidos deste endereço. Tente de novo mais tarde.");
  const d = await corpo(request);
  const email = texto(d.email, 120).toLowerCase();
  if (!RE_EMAIL.test(email)) throw new Erro(400, "Informe o e-mail do seu cadastro.");
  // Sem e-mail configurado, a página orienta a falar com a Tardim pelo WhatsApp
  if (!env.RESEND_API_KEY) return json({ ok: false, semEmail: true });
  await marca(env, "esq:" + ip);
  const conta = await env.DB.prepare("SELECT * FROM contas WHERE email = ?").bind(email).first<Conta>();
  // A resposta é a mesma com ou sem cadastro: não revela quem é parceiro
  if (!conta) return json({ ok: true });
  const exp = Math.floor(Date.now() / 1000) + VALIDADE_LINK;
  const token = conta.id + "." + exp + "." + (await assinaTroca(env, conta, exp));
  const link = new URL(request.url).origin + "/parceiro.html#redefinir=" + token;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.AVISO_REMETENTE || "Tardim Produções <onboarding@resend.dev>",
      to: [conta.email],
      subject: "Criar uma senha nova · Área do parceiro Tardim Produções",
      text: [
        "Olá!", "",
        "Recebemos um pedido para criar uma senha nova na área do parceiro da Tardim Produções.",
        "Para criar, abra o link abaixo (vale por 1 hora e funciona uma vez só):", "",
        link, "",
        "Se não foi você, ignore este e-mail: sua senha continua a mesma.", "",
        "Tardim Produções",
      ].join("\n"),
    }),
  }).catch(() => null);
  if (!r || !r.ok) throw new Erro(502, "Não consegui enviar o e-mail agora. Tente de novo em alguns minutos ou fale com a Tardim pelo WhatsApp.");
  return json({ ok: true });
}

async function novaSenha(request: Request, env: Env): Promise<Response> {
  const chave = "parc:" + ipDe(request);
  await limite(env, chave, MAX_ERROS, JANELA_ERROS, "Muitas tentativas. Espere 15 minutos e tente de novo.");
  const d = await corpo(request);
  const [id, exp, sig] = texto(d.token, 300).split(".");
  const s = typeof d.senha === "string" ? d.senha : "";
  if (s.length < 8 || s.length > 200) throw new Erro(400, "A senha precisa ter pelo menos 8 caracteres.");
  const conta = id ? await env.DB.prepare("SELECT * FROM contas WHERE id = ?").bind(id).first<Conta>() : null;
  const valido = conta && sig && Number(exp) > Date.now() / 1000 && iguais(sig, await assinaTroca(env, conta, exp));
  if (!valido || !conta) {
    await marca(env, chave);
    throw new Erro(400, "Este link expirou ou já foi usado. Peça um novo em \"Esqueci minha senha\".");
  }
  await env.DB.prepare("UPDATE contas SET senha = ? WHERE id = ?").bind(await hashSenha(s), conta.id).run();
  return entra(env, conta);
}

async function loginGoogle(request: Request, env: Env): Promise<Response> {
  const d = await corpo(request);
  const g = await verificaGoogle(d.credential, env);
  let conta = await env.DB.prepare("SELECT * FROM contas WHERE google_sub = ?").bind(g.sub).first<Conta>();
  if (!conta) {
    // Mesma pessoa que se cadastrou com e-mail e senha: liga a conta Google (o Google confirmou o e-mail)
    conta = await env.DB.prepare("SELECT * FROM contas WHERE email = ?").bind(g.email).first<Conta>();
    if (conta) await env.DB.prepare("UPDATE contas SET google_sub = ? WHERE id = ?").bind(g.sub, conta.id).run();
  }
  if (!conta) return json({ novo: true, email: g.email, nome: g.nome });
  return entra(env, conta);
}

type PerfilEu = Pick<Parceiro, "id" | "tipo" | "nome" | "responsavel" | "whatsapp" | "instagram" | "cidade" | "logo" | "cor" | "situacao" | "motivo_recusa" | "criado_em"
  | "tiktok" | "tt_situacao" | "tt_seguidores" | "tt_conferido_em">
  & { ativo: number | boolean; convites: Dados[] };

// ---------- inscrições feitas no site da Tardim (pagamentos_site), por convite ----------
interface ContagemSite { atletas: number; pedidos: number; aguardando: number; ultima: string }
async function contagemSite(env: Env, parceiros: string[]): Promise<Record<string, ContagemSite>> {
  const out: Record<string, ContagemSite> = {};
  if (!parceiros.length) return out;
  const rs = (await env.DB.prepare(
    "SELECT convite_id, " +
    "SUM(CASE WHEN situacao IN ('pago', 'cortesia') THEN n_atletas ELSE 0 END) AS atletas, " +
    "SUM(CASE WHEN situacao IN ('pago', 'cortesia') THEN 1 ELSE 0 END) AS pedidos, " +
    "SUM(CASE WHEN situacao = 'aguardando' THEN n_atletas ELSE 0 END) AS aguardando, " +
    "MAX(CASE WHEN situacao IN ('pago', 'cortesia') THEN pago_em ELSE '' END) AS ultima " +
    "FROM pagamentos_site WHERE parceiro_id IN (" + parceiros.map(() => "?").join(",") + ") GROUP BY convite_id"
  ).bind(...parceiros).all<Dados>().catch(() => ({ results: [] as Dados[] }))).results;
  rs.forEach((l) => { out[l.convite_id] = { atletas: Number(l.atletas) || 0, pedidos: Number(l.pedidos) || 0, aguardando: Number(l.aguardando) || 0, ultima: l.ultima || "" }; });
  return out;
}
// Perfis aprovados do login (os únicos que veem convites)
async function perfisAprovados(env: Env, conta: Conta): Promise<string[]> {
  return (await env.DB.prepare("SELECT id FROM parceiros WHERE (id = ?1 OR conta_id = ?2) AND situacao = 'aprovado' AND ativo = 1")
    .bind(conta.parceiro_id, conta.id).all<Dados>()).results.map((x) => String(x.id));
}
// Só os números, para a área do parceiro atualizar sozinha
async function inscricoesSite(request: Request, env: Env): Promise<Response> {
  const conta = await contaDaSessao(request, env);
  if (!conta) throw new Erro(401, "Entre na sua conta.");
  return json({ convites: await contagemSite(env, await perfisAprovados(env, conta)) }, 200, { "cache-control": "no-store" });
}

async function eu(request: Request, env: Env): Promise<Response> {
  const conta = await contaDaSessao(request, env);
  if (!conta) throw new Erro(401, "Entre na sua conta.");
  // Perfil principal primeiro, depois os outros na ordem assessoria, influenciador, profissional de Educação Física
  const perfis = (await env.DB.prepare(
    "SELECT id, tipo, nome, responsavel, whatsapp, instagram, cidade, logo, cor, ativo, situacao, motivo_recusa, criado_em, tiktok, tt_situacao, tt_seguidores, tt_conferido_em FROM parceiros " +
    "WHERE id = ?1 OR conta_id = ?2 ORDER BY id = ?1 DESC, CASE tipo WHEN 'assessoria' THEN 0 WHEN 'influenciador' THEN 1 ELSE 2 END"
  ).bind(conta.parceiro_id, conta.id).all<PerfilEu>()).results;
  if (!perfis.length) throw new Erro(401, "Cadastro não encontrado. Fale com a Tardim Produções.");
  for (const p of perfis) {
    p.convites = [];
    if (p.situacao === "aprovado" && p.ativo) {
      p.convites = (await env.DB.prepare(
        "SELECT id, prova_id, cupom, desconto, comissao_pct, cortesias, contrapartida, condicoes, coletiva FROM convites WHERE parceiro_id = ? ORDER BY criado_em DESC"
      ).bind(p.id).all<Dados>()).results.map((c) => {
        try { c.coletiva = JSON.parse(c.coletiva || "{}"); } catch (e) { c.coletiva = {}; }
        return c;
      });
    }
    p.ativo = !!p.ativo;
  }
  const site = await contagemSite(env, perfis.filter((p) => p.convites.length).map((p) => p.id));
  perfis.forEach((p) => p.convites.forEach((c) => { c.site = site[c.id] || { atletas: 0, pedidos: 0, aguardando: 0, ultima: "" }; }));
  return json({ email: conta.email, google: !!conta.google_sub, senha: !!conta.senha, tiktok: tiktokPronto(env), perfis });
}

// ---------- TikTok (functions/_lib/tiktok.ts) ----------
// Só o perfil de influenciador do próprio login conecta
async function perfilInfluenciador(env: Env, conta: Conta, id: string): Promise<boolean> {
  const p = await env.DB.prepare("SELECT id FROM parceiros WHERE id = ?1 AND tipo = 'influenciador' AND (id = ?2 OR conta_id = ?3)")
    .bind(id, conta.parceiro_id, conta.id).first();
  return !!p;
}
const voltaParceiro = (origem: string, resultado: string): Response =>
  new Response(null, { status: 302, headers: { location: origem + "/parceiro#tiktok=" + resultado, "cache-control": "no-store" } });

async function tiktokConectar(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const conta = await contaDaSessao(request, env);
  if (!conta) return voltaParceiro(url.origin, "sessao");
  if (!tiktokPronto(env)) return voltaParceiro(url.origin, "config");
  const perfil = texto(url.searchParams.get("perfil"), 60);
  if (!(await perfilInfluenciador(env, conta, perfil))) return voltaParceiro(url.origin, "perfil");
  const estado = await criaEstado(env, conta.id, perfil);
  return new Response(null, { status: 302, headers: { location: urlAutorizacao(env, url.origin, estado), "cache-control": "no-store" } });
}

async function tiktokRetorno(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams;
  if (q.get("error")) return voltaParceiro(url.origin, q.get("error") === "access_denied" ? "cancelado" : "erro");
  const est = await leEstado(env, q.get("state") || "");
  const conta = await contaDaSessao(request, env);
  // o retorno precisa ser de quem pediu, na mesma sessão
  if (!est || !conta || conta.id !== est.c || !(await perfilInfluenciador(env, conta, est.p))) return voltaParceiro(url.origin, "sessao");
  const escopos = String(q.get("scopes") || "");
  if (escopos && !/user\.info\.stats/.test(escopos)) return voltaParceiro(url.origin, "permissao");
  const t = await trocaCodigo(env, url.origin, q.get("code") || "");
  if ("erro" in t) return voltaParceiro(url.origin, "erro");
  const r = await conectaParceiro(env, est.p, t);
  return voltaParceiro(url.origin, r.ok ? "ok" : "erro");
}

async function tiktokDesconectar(request: Request, env: Env): Promise<Response> {
  const conta = await contaDaSessao(request, env);
  if (!conta) throw new Erro(401, "Entre na sua conta.");
  const d = await corpo(request);
  const perfil = texto(d.perfil, 60);
  if (!(await perfilInfluenciador(env, conta, perfil))) throw new Erro(404, "Perfil não encontrado.");
  await desconectaParceiro(env, perfil);
  return json({ ok: true });
}

// ---------- app Hono ----------
// Ordem (igual à de antes): caminho com mais de um segmento (404, antes de tudo) -> escrita de outra origem (403)
// -> rotas -> 404. Rota GET não atende HEAD (segue para o 404).
const app = new Hono<AppHono>({ strict: false }).basePath("/api/parceiro");

app.all("/:a/:b/*", () => { throw new Erro(404, "Rota não encontrada."); });
app.use(async (c, next) => {
  if (c.req.method !== "GET" && !mesmaOrigem(c.req.raw)) throw new Erro(403, "Origem não permitida.");
  await next();
});

app.get("/config", metodo("GET", (c) => json({ google: c.env.GOOGLE_CLIENT_ID || "" })));
app.get("/cidades", metodo("GET", (c) => {
  const uf = String(new URL(c.req.url).searchParams.get("uf") || "").toUpperCase();
  if (!CIDADES[uf]) throw new Erro(400, "Estado inválido.");
  return json({ uf, cidades: CIDADES[uf] }, 200, { "cache-control": "public, max-age=86400" });
}));
app.post("/cadastro", (c) => cadastro(c.req.raw, c.env, c.executionCtx));
app.post("/confirmar", (c) => confirma(c.req.raw, c.env, c.executionCtx));
app.post("/login", (c) => loginSenha(c.req.raw, c.env));
app.post("/google", (c) => loginGoogle(c.req.raw, c.env));
app.post("/esqueci", (c) => esqueci(c.req.raw, c.env));
app.post("/nova-senha", (c) => novaSenha(c.req.raw, c.env));
app.post("/sair", () => json({ ok: true }, 200, { "set-cookie": cookieFim() }));
app.get("/eu", metodo("GET", (c) => eu(c.req.raw, c.env)));
app.get("/inscricoes-site", metodo("GET", (c) => inscricoesSite(c.req.raw, c.env)));
app.get("/tiktok-conectar", metodo("GET", (c) => tiktokConectar(c.req.raw, c.env)));
app.get("/tiktok-retorno", metodo("GET", (c) => tiktokRetorno(c.req.raw, c.env)));
app.post("/tiktok-desconectar", (c) => tiktokDesconectar(c.req.raw, c.env));

app.notFound(() => json({ erro: 404, mensagem: "Rota não encontrada." }, 404));

app.onError((e) => {
  if (e instanceof Erro) return json({ erro: e.status, mensagem: e.message }, e.status);
  const msg = String((e && e.message) || e);
  if (/UNIQUE/i.test(msg)) return json({ erro: 409, mensagem: "Já existe um cadastro com este e-mail ou conta Google." }, 409);
  if (/no such (table|column)/i.test(msg)) return json({ erro: 503, mensagem: "Falta atualizar o banco: rode as migrações de d1/migracoes (a mais recente é 005-parceiros-conta.sql)." }, 503);
  return json({ erro: 500, mensagem: "Erro no servidor." }, 500);
});

const hono = handle(app);

// Conferência de configuração (503) e a decodificação dos segmentos ficam antes do Hono, como antes.
export async function onRequest(ctx: Contexto<"rota">): Promise<Response> {
  const { env, params } = ctx;
  if (!env.DB || !env.SESSAO_SEGREDO) return json({ erro: "config", mensagem: "O cadastro de parceiros ainda não foi configurado." }, 503);
  segmentos(params, "rota");
  return hono(ctx as unknown as Parameters<typeof hono>[0]);
}
