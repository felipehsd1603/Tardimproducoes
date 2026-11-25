// /api/parceiro/* — cadastro e acesso dos parceiros (parceiro.html), no D1 (binding DB).
//
// O parceiro se cadastra (e-mail e senha ou Google) e fica "pendente" até a
// Tardim Produções aprovar no painel. A Tardim recebe aviso no painel e, se
// configurado, por e-mail (Resend). Cookie HttpOnly assinado com SESSAO_SEGREDO.
//
//   GET  config                 { google: client id ou "" }
//   GET  cidades?uf=MG          { uf, cidades }  (municípios do IBGE, functions/_lib/cidades.js)
//   POST cadastro               { tipos: [assessoria|influenciador|embaixador...], nome, whatsapp, uf, cidade, instagram, seguidores,
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
//   POST inscricao              { convite_id, nome, cpf, email, telefone, nascimento, sexo, camiseta, modalidade, aceite }
//                               inscrição no site pelo próprio parceiro: cortesia do convite enquanto houver, depois PIX com desconto
//   GET  inscricoes             { resumo: { <convite>: { site, pelo_link, cortesias, cortesias_usadas } }, proprias: [...] }
//
// Segredos/variáveis: SESSAO_SEGREDO (obrigatório), GOOGLE_CLIENT_ID (login com Google),
// RESEND_API_KEY + AVISO_EMAIL (+ AVISO_REMETENTE opcional) para o e-mail de novo cadastro.

import { CIDADES } from "../../_lib/cidades.js";
import { confereInstagramParceiro } from "../../_lib/instagram.js";
import { ErroInscricao, provaAberta, validaAtleta, criaInscricao, publica, confere } from "../../_lib/inscricoes-site.js";
import { json, mesmaOrigem, enc, b64url, deB64url, hmacB64url as hmac, iguais } from "../../_lib/http.js";

const COOKIE = "tardim_parceiro";
const DURACAO = 60 * 60 * 24 * 30; // 30 dias
const MAX_ERROS = 5, JANELA_ERROS = 15 * 60, MAX_ERROS_EMAIL = 10;
const MAX_CADASTROS = 5, JANELA_CADASTROS = 60 * 60;
const ITERACOES = 100000; // máximo do PBKDF2 no Cloudflare Workers
const TIPOS = { assessoria: "Assessoria", influenciador: "Influenciador", embaixador: "Embaixador" };
const RE_EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[a-z]{2,}$/i;

class Erro extends Error {
  constructor(status, mensagem) { super(mensagem); this.status = status; }
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
// CNPJ com dígitos verificadores; devolve "00.000.000/0000-00" ou "" se inválido
function cnpjValido(v) {
  const d = String(v || "").replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return "";
  const dv = (n) => {
    let s = 0, p = n - 7;
    for (let i = 0; i < n; i++) { s += Number(d[i]) * p--; if (p < 2) p = 9; }
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  if (dv(12) !== Number(d[12]) || dv(13) !== Number(d[13])) return "";
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}
const limpaInsta = (v) => texto(v, 100).replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "");

// ---------- criptografia (comuns em functions/_lib/http.js) ----------
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
async function avisaTardim(env, origem, perfis, email) {
  if (!env.RESEND_API_KEY || !env.AVISO_EMAIL) return;
  const p = perfis[0];
  const tipos = perfis.map((x) => TIPOS[x.tipo]).join(" + ");
  const linhas = [
    "Novo cadastro de parceiro no site, aguardando aprovação" + (perfis.length > 1 ? " (" + perfis.length + " perfis, aprove cada um)" : "") + ".", "",
    "Tipo: " + tipos, "E-mail: " + email, p.whatsapp ? "WhatsApp: " + p.whatsapp : "", "Cidade: " + p.cidade + "/" + p.uf,
  ];
  perfis.forEach((x) => {
    linhas.push("", TIPOS[x.tipo] + ": " + x.nome,
      x.responsavel ? "Responsável: " + x.responsavel : "", x.documento ? "CNPJ: " + x.documento : "",
      x.instagram ? "Instagram: @" + x.instagram : "",
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
async function cadastro(request, env, ctx) {
  const ip = ipDe(request);
  await limite(env, "cad:" + ip, MAX_CADASTROS, JANELA_CADASTROS, "Muitos cadastros deste endereço. Tente de novo mais tarde.");
  const d = await corpo(request);
  // Um ou mais tipos (aceita também o antigo { tipo })
  const pedidos = [].concat(Array.isArray(d.tipos) ? d.tipos : d.tipo ? [d.tipo] : []).map((t) => texto(t, 20));
  const tipos = Object.keys(TIPOS).filter((t) => pedidos.includes(t));
  if (!tipos.length || tipos.length !== new Set(pedidos).size) throw new Erro(400, "Marque se você é assessoria, influenciador e/ou embaixador.");
  const tem = (t) => tipos.includes(t);
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

  const perfis = [];
  if (tem("assessoria")) {
    const a = { tipo: "assessoria", nome: texto(d.assessoria_nome, 120), responsavel: comum.nome,
      documento: cnpjValido(d.cnpj), instagram: limpaInsta(d.assessoria_instagram), seguidores: 0 };
    if (a.nome.length < 2) throw new Erro(400, "Informe o nome da assessoria.");
    if (!a.documento) throw new Erro(400, "Informe um CNPJ válido da assessoria.");
    if (a.instagram && !/^[\w.]{1,30}$/.test(a.instagram)) throw new Erro(400, "Instagram da assessoria inválido.");
    perfis.push(a);
  }
  if (tem("influenciador")) {
    if (!comum.instagram) throw new Erro(400, "Informe o seu perfil do Instagram.");
    const seguidores = parseInt(String(d.seguidores == null ? "" : d.seguidores).replace(/\D/g, ""), 10) || 0;
    if (seguidores < 1 || seguidores > 1000000000) throw new Erro(400, "Informe o número estimado de seguidores.");
    perfis.push({ tipo: "influenciador", nome: comum.nome, responsavel: "", documento: "", instagram: comum.instagram, seguidores });
  }
  if (tem("embaixador")) {
    perfis.push({ tipo: "embaixador", nome: comum.nome, responsavel: "", documento: "", instagram: comum.instagram, seguidores: 0 });
  }
  perfis.forEach((x) => Object.assign(x, { whatsapp: comum.whatsapp, cidade: comum.cidade, uf: comum.uf }));
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
async function criaConta(env, ctx, origem, perfis, email, senha, sub) {
  const cid = crypto.randomUUID();
  perfis.forEach((x) => { x.id = crypto.randomUUID(); });
  await env.DB.batch(perfis.map((x) => env.DB.prepare(
    "INSERT INTO parceiros (id, tipo, nome, responsavel, whatsapp, email, instagram, cidade, uf, seguidores, documento, conta_id, ativo, situacao, origem) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pendente', 'cadastro')"
  ).bind(x.id, x.tipo, x.nome, x.responsavel, x.whatsapp, email, x.instagram, x.cidade, x.uf, x.seguidores, x.documento, cid)).concat([
    env.DB.prepare("INSERT INTO contas (id, parceiro_id, email, senha, google_sub) VALUES (?, ?, ?, ?, ?)").bind(cid, perfis[0].id, email, senha, sub),
  ]));
  ctx.waitUntil(avisaTardim(env, origem, perfis, email));
  // Já confere os seguidores reais para a tela de aprovação (sem IG_TOKEN, não faz nada)
  perfis.forEach((x) => { if (x.instagram) ctx.waitUntil(confereInstagramParceiro(env, x.id).catch(() => {})); });
  return entra(env, { id: cid });
}

// ---------- confirmação do e-mail (cadastro com senha) ----------
// O link leva os dados do cadastro cifrados (AES-GCM, chave derivada do SESSAO_SEGREDO) e vale 24 horas.
// Depois de confirmado, o e-mail já tem conta e o mesmo link não cria outra.
const VALIDADE_CONFIRMACAO = 24 * 60 * 60;
async function chaveConfirmacao(env) {
  const base = await crypto.subtle.importKey("raw", enc.encode(env.SESSAO_SEGREDO), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode("tardim-parceiro"), info: enc.encode("confirmacao-cadastro-v1") },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function cifraCadastro(env, dados) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await chaveConfirmacao(env), enc.encode(JSON.stringify(dados)));
  return b64url(iv) + "." + b64url(new Uint8Array(c));
}
async function decifraCadastro(env, token) {
  try {
    const [iv, c] = token.split(".");
    const t = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64url(iv) }, await chaveConfirmacao(env), deB64url(c));
    return JSON.parse(new TextDecoder().decode(t));
  } catch (e) {
    return null;
  }
}

async function enviaEmail(env, para, assunto, linhas) {
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
async function mandaConfirmacao(env, origem, email, cadastro) {
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

async function confirma(request, env, ctx) {
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

async function loginSenha(request, env) {
  const chave = "parc:" + ipDe(request);
  await limite(env, chave, MAX_ERROS, JANELA_ERROS, "Muitas tentativas erradas. Espere 15 minutos e tente de novo.");
  const d = await corpo(request);
  const email = texto(d.email, 120).toLowerCase();
  // Também por e-mail: tentativas vindas de muitos IPs contra a mesma conta (mais folgado que o por IP,
  // para um ataque não trancar o dono fácil; "Esqueci a senha" continua funcionando)
  const chaveEmail = "parc-email:" + email;
  if (email) await limite(env, chaveEmail, MAX_ERROS_EMAIL, JANELA_ERROS, "Muitas tentativas erradas neste e-mail. Espere 15 minutos ou use \"Esqueci a senha\".");
  const senha = typeof d.senha === "string" ? d.senha.slice(0, 200) : "";
  const conta = email ? await env.DB.prepare("SELECT * FROM contas WHERE email = ?").bind(email).first() : null;
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
const assinaTroca = (env, conta, exp) => hmac(env.SESSAO_SEGREDO, "senha." + conta.id + "." + exp + "." + (conta.senha || ""));

async function esqueci(request, env) {
  const ip = ipDe(request);
  await limite(env, "esq:" + ip, MAX_PEDIDOS, JANELA_PEDIDOS, "Muitos pedidos deste endereço. Tente de novo mais tarde.");
  const d = await corpo(request);
  const email = texto(d.email, 120).toLowerCase();
  if (!RE_EMAIL.test(email)) throw new Erro(400, "Informe o e-mail do seu cadastro.");
  // Sem e-mail configurado, a página orienta a falar com a Tardim pelo WhatsApp
  if (!env.RESEND_API_KEY) return json({ ok: false, semEmail: true });
  await marca(env, "esq:" + ip);
  const conta = await env.DB.prepare("SELECT * FROM contas WHERE email = ?").bind(email).first();
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

async function novaSenha(request, env) {
  const chave = "parc:" + ipDe(request);
  await limite(env, chave, MAX_ERROS, JANELA_ERROS, "Muitas tentativas. Espere 15 minutos e tente de novo.");
  const d = await corpo(request);
  const [id, exp, sig] = texto(d.token, 300).split(".");
  const s = typeof d.senha === "string" ? d.senha : "";
  if (s.length < 8 || s.length > 200) throw new Erro(400, "A senha precisa ter pelo menos 8 caracteres.");
  const conta = id ? await env.DB.prepare("SELECT * FROM contas WHERE id = ?").bind(id).first() : null;
  const valido = conta && sig && Number(exp) > Date.now() / 1000 && iguais(sig, await assinaTroca(env, conta, exp));
  if (!valido) {
    await marca(env, chave);
    throw new Erro(400, "Este link expirou ou já foi usado. Peça um novo em \"Esqueci minha senha\".");
  }
  await env.DB.prepare("UPDATE contas SET senha = ? WHERE id = ?").bind(await hashSenha(s), conta.id).run();
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

// ---------- inscrição pelo site, feita pelo próprio parceiro (functions/_lib/inscricoes-site.js) ----------
// Usa as cortesias do convite enquanto houver; depois, paga por PIX com o desconto do cupom.
async function conviteDaConta(env, conta, conviteId) {
  return env.DB.prepare(
    "SELECT c.*, p.nome AS parceiro_nome, p.tipo AS parceiro_tipo FROM convites c JOIN parceiros p ON p.id = c.parceiro_id " +
    "WHERE c.id = ? AND (p.id = ? OR p.conta_id = ?) AND p.ativo = 1 AND p.situacao = 'aprovado' AND p.tipo IN ('embaixador','influenciador')"
  ).bind(String(conviteId || ""), conta.parceiro_id, conta.id).first();
}
const cortesiasUsadas = async (env, conviteId) => ((await env.DB.prepare(
  "SELECT COUNT(*) AS n FROM inscricoes_site WHERE convite_id = ? AND origem = 'parceiro' AND situacao = 'cortesia'"
).bind(conviteId).first()) || {}).n || 0;

async function inscricaoParceiro(request, env, ctx) {
  const conta = await contaDaSessao(request, env);
  if (!conta) throw new Erro(401, "Entre na sua conta.");
  const d = await corpo(request);
  const convite = await conviteDaConta(env, conta, d.convite_id);
  if (!convite) throw new Erro(404, "Convite não encontrado.");
  try {
    const { prova, cfg } = await provaAberta(env, convite.prova_id);
    const atleta = validaAtleta(d, cfg);
    const cortesia = (Number(convite.cortesias) || 0) > (await cortesiasUsadas(env, convite.id));
    return json(await criaInscricao(env, ctx, { prova, cfg, convite, origem: "parceiro", atleta, cortesia, site: new URL(request.url).origin, forma: d.forma }), 201);
  } catch (e) {
    if (e instanceof ErroInscricao) throw new Erro(e.status, e.message);
    throw e;
  }
}

async function inscricoesParceiro(request, env) {
  const conta = await contaDaSessao(request, env);
  if (!conta) throw new Erro(401, "Entre na sua conta.");
  const convites = (await env.DB.prepare(
    "SELECT c.id, c.prova_id, c.cortesias FROM convites c JOIN parceiros p ON p.id = c.parceiro_id " +
    "WHERE (p.id = ? OR p.conta_id = ?) AND p.ativo = 1 AND p.situacao = 'aprovado' AND p.tipo IN ('embaixador','influenciador')"
  ).bind(conta.parceiro_id, conta.id).all()).results;
  const resumo = {};
  const proprias = [];
  for (const c of convites) {
    const r = await env.DB.prepare(
      "SELECT origem, situacao, COUNT(*) AS n, SUM(valor - acrescimo) AS v FROM inscricoes_site WHERE convite_id = ? GROUP BY origem, situacao"
    ).bind(c.id).all();
    const conta_ = (o, s) => r.results.filter((x) => x.origem === o && x.situacao === s).reduce((t, x) => t + x.n, 0);
    let site = false;
    try { site = !!(await provaAberta(env, c.prova_id)); } catch (e) { site = false; }
    resumo[c.id] = { site, pelo_link: conta_("link", "pago"), pelo_link_valor: r.results.filter((x) => x.origem === "link" && x.situacao === "pago").reduce((t, x) => t + (x.v || 0), 0), cortesias: Number(c.cortesias) || 0, cortesias_usadas: conta_("parceiro", "cortesia") };
    const minhas = (await env.DB.prepare(
      "SELECT * FROM inscricoes_site WHERE convite_id = ? AND origem = 'parceiro' AND situacao IN ('pago','cortesia','aguardando') ORDER BY criado_em DESC"
    ).bind(c.id).all()).results;
    for (let l of minhas) {
      if (l.situacao === "aguardando") l = await confere(env, l, { site: new URL(request.url).origin }); // PIX pago já aparece como pago
      proprias.push(Object.assign(publica(l), { convite_id: c.id, nome: l.nome }));
    }
  }
  return json({ resumo, proprias });
}

async function eu(request, env) {
  const conta = await contaDaSessao(request, env);
  if (!conta) throw new Erro(401, "Entre na sua conta.");
  // Perfil principal primeiro, depois os outros na ordem assessoria, influenciador, embaixador
  const perfis = (await env.DB.prepare(
    "SELECT id, tipo, nome, responsavel, whatsapp, instagram, cidade, logo, cor, ativo, situacao, motivo_recusa, criado_em FROM parceiros " +
    "WHERE id = ?1 OR conta_id = ?2 ORDER BY id = ?1 DESC, CASE tipo WHEN 'assessoria' THEN 0 WHEN 'influenciador' THEN 1 ELSE 2 END"
  ).bind(conta.parceiro_id, conta.id).all()).results;
  if (!perfis.length) throw new Erro(401, "Cadastro não encontrado. Fale com a Tardim Produções.");
  for (const p of perfis) {
    p.convites = [];
    if (p.situacao === "aprovado" && p.ativo) {
      p.convites = (await env.DB.prepare(
        "SELECT id, prova_id, cupom, desconto, comissao_pct, cortesias, contrapartida, condicoes, coletiva FROM convites WHERE parceiro_id = ? ORDER BY criado_em DESC"
      ).bind(p.id).all()).results.map((c) => {
        try { c.coletiva = JSON.parse(c.coletiva || "{}"); } catch (e) { c.coletiva = {}; }
        return c;
      });
    }
    p.ativo = !!p.ativo;
  }
  return json({ email: conta.email, google: !!conta.google_sub, senha: !!conta.senha, perfis });
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
  if (a === "confirmar" && m === "POST") return confirma(request, env, ctx);
  if (a === "login" && m === "POST") return loginSenha(request, env);
  if (a === "google" && m === "POST") return loginGoogle(request, env);
  if (a === "esqueci" && m === "POST") return esqueci(request, env);
  if (a === "nova-senha" && m === "POST") return novaSenha(request, env);
  if (a === "sair" && m === "POST") return json({ ok: true }, 200, { "set-cookie": cookieFim() });
  if (a === "eu" && m === "GET") return eu(request, env);
  if (a === "inscricao" && m === "POST") return inscricaoParceiro(request, env, ctx);
  if (a === "inscricoes" && m === "GET") return inscricoesParceiro(request, env);
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
    if (/no such (table|column)/i.test(msg)) return json({ erro: 503, mensagem: "Falta atualizar o banco: rode as migrações de d1/migracoes (a mais recente é 005-parceiros-conta.sql)." }, 503);
    return json({ erro: 500, mensagem: "Erro no servidor." }, 500);
  }
}
