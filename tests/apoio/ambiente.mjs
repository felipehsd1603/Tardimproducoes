// Ambiente dos testes de integração: a Tardim inteira (wrangler pages dev) num banco D1 local
// descartável, com segredos de teste. Nada aqui toca o banco de produção nem o .wrangler do dia a dia.
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { webcrypto } from "node:crypto";

export const RAIZ = resolve(import.meta.dirname, "..", "..");
export const PORTA = Number(process.env.TESTE_PORTA || 8899);
export const BASE = `http://127.0.0.1:${PORTA}`;
export const SENHA = "senha-de-teste";
const SEGREDO = "segredo-de-teste-sessao";
const WRANGLER = join(RAIZ, "node_modules", "wrangler", "bin", "wrangler.js");

function wrangler(args, opcoes = {}) {
  const r = spawnSync(process.execPath, [WRANGLER, ...args], { cwd: RAIZ, encoding: "utf8", ...opcoes });
  if (r.status !== 0) throw new Error(`wrangler ${args.join(" ")} falhou:\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
}

async function chaveAssinatura() {
  const par = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const j = await webcrypto.subtle.exportKey("jwk", par.privateKey);
  return JSON.stringify({ kty: j.kty, crv: j.crv, x: j.x, y: j.y, d: j.d, kid: "tdm-teste" });
}

// Banco novo com o esquema completo (d1/schema.sql + d1/painel.sql)
export function criaBanco(dir) {
  for (const f of ["d1/schema.sql", "d1/painel.sql"]) wrangler(["d1", "execute", "tardim", "--local", "--persist-to", dir, "--file", f]);
}

export function sql(dir, comando) {
  return wrangler(["d1", "execute", "tardim", "--local", "--persist-to", dir, "--json", "--command", comando]);
}

export async function sobeTardim() {
  const dir = mkdtempSync(join(tmpdir(), "tardim-teste-"));
  criaBanco(dir);
  const jwk = await chaveAssinatura();
  const proc = spawn(process.execPath, [WRANGLER, "pages", "dev", ".", "--port", String(PORTA), "--ip", "127.0.0.1", "--persist-to", dir,
    "--binding", `ADMIN_SENHA=${SENHA}`, "--binding", `SESSAO_SEGREDO=${SEGREDO}`, "--binding", `TARDIM_ASSINATURA_JWK=${jwk}`,
    "--show-interactive-dev-session=false"], { cwd: RAIZ, stdio: ["ignore", "pipe", "pipe"] });
  let saida = "";
  proc.stdout.on("data", (d) => (saida += d));
  proc.stderr.on("data", (d) => (saida += d));
  const limite = Date.now() + 90000;
  for (;;) {
    if (proc.exitCode !== null) throw new Error("wrangler pages dev saiu:\n" + saida);
    try { if ((await fetch(BASE + "/api/v1/chaves-publicas")).ok) break; } catch (e) { /* ainda subindo */ }
    if (Date.now() > limite) { proc.kill(); throw new Error("wrangler pages dev não subiu em 90 s:\n" + saida); }
    await new Promise((r) => setTimeout(r, 500));
  }
  return {
    dir,
    sql: (c) => JSON.parse(sql(dir, c))[0].results,
    async desce() {
      proc.kill();
      await new Promise((r) => setTimeout(r, 500));
      try { rmSync(dir, { recursive: true, force: true }); } catch (e) { /* o Windows às vezes segura o arquivo */ }
    },
  };
}

// Cliente HTTP com cookie (painel) e Origin do próprio site
export function cliente() {
  let cookie = "";
  async function chama(metodo, caminho, corpo, cab = {}) {
    const h = { origin: BASE, ...cab };
    if (cookie) h.cookie = cookie;
    let body;
    if (corpo instanceof Uint8Array || typeof corpo === "string") body = corpo;
    else if (corpo !== undefined) { body = JSON.stringify(corpo); h["content-type"] = h["content-type"] || "application/json"; }
    const r = await fetch(BASE + caminho, { method: metodo, headers: h, body, redirect: "manual" });
    const sc = r.headers.get("set-cookie");
    if (sc) cookie = sc.split(";")[0];
    const t = await r.text();
    let j = null;
    try { j = JSON.parse(t); } catch (e) { /* não é JSON */ }
    return { status: r.status, json: j, texto: t, headers: r.headers };
  }
  return { chama, entra: () => chama("POST", "/api/admin/login", { senha: SENHA }) };
}
