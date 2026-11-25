// Registra migrações como JÁ APLICADAS na tabela d1_migrations (a que o `wrangler d1 migrations apply`
// usa), sem rodar o SQL delas. Para bancos em que as migrações foram aplicadas à mão, antes do controle.
//
// Uso:
//   node scripts/db-registrar-migracoes.mjs --remote --ate 012   produção (uma vez): 001 a 012 já rodaram à mão
//   node scripts/db-registrar-migracoes.mjs --local --todas       banco novo criado por d1/schema.sql + d1/painel.sql
// Depois: npm run db:migracoes:producao (aplica só as que faltam, ex.: 013 e 014).

import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const raiz = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const alvo = args.includes("--remote") ? "--remote" : args.includes("--local") ? "--local" : null;
const ate = args.includes("--ate") ? args[args.indexOf("--ate") + 1] : null;
if (!alvo || (!ate && !args.includes("--todas"))) {
  console.error("Use --remote ou --local, e --ate <número> ou --todas.");
  process.exit(1);
}
const nomes = readdirSync(join(raiz, "d1", "migracoes")).filter((f) => f.endsWith(".sql")).sort()
  .filter((f) => !ate || f.slice(0, ate.length) <= ate);
if (!nomes.length) { console.error("Nenhuma migração encontrada."); process.exit(1); }

const sql = [
  "CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)",
  ...nomes.map((n) => `INSERT OR IGNORE INTO d1_migrations (name) VALUES ('${n.replace(/'/g, "''")}')`),
].join("; ");
console.log(`Registrando como aplicadas (${alvo}):\n  ` + nomes.join("\n  "));
const r = spawnSync(process.execPath, [join(raiz, "node_modules", "wrangler", "bin", "wrangler.js"), "d1", "execute", "tardim", alvo, "--command", sql], { cwd: raiz, stdio: "inherit" });
process.exit(r.status ?? 1);
