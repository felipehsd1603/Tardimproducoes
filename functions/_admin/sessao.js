// Sessão do painel: senha única (segredo ADMIN_SENHA) e cookie HttpOnly assinado (SESSAO_SEGREDO).
// Trocar a senha derruba todas as sessões. Bloqueio: 5 erros em 15 minutos por IP.

import { json, hmacB64url as hmac, iguais } from "../_lib/http.js";
import { Erro } from "./comum.js";

const COOKIE = "tardim_painel";
const DURACAO = 60 * 60 * 24 * 14; // 14 dias
const MAX_ERROS = 5, JANELA_ERROS = 15 * 60;

// ---------- sessão ----------
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

export { sessaoValida, login, cookie };
