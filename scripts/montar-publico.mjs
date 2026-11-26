// Monta publico/ só com o que o site serve (páginas, css, js, imagens e as regras do Pages).
// O deploy sobe esta pasta: código, banco, docs, testes e segredos (.dev.vars) nunca entram no ar.
// As funções continuam vindo de functions/ (o wrangler as lê da pasta do projeto).
import { cpSync, existsSync, readdirSync, rmSync, mkdirSync } from "node:fs";

// assets/ leva também o painel gerado (assets/painel/, de npm run painel:build); o HTML dele vai como os outros da raiz
const PASTAS = ["assets", "css", "js"];
const ARQUIVOS = /^([\w-]+\.html|manifest\.webmanifest|robots\.txt|sitemap\.xml|_headers|_redirects|_routes\.json)$/;

// O painel (React) é gerado, não fica no git: sem ele, o deploy sairia sem o /admin
if (!existsSync("assets/painel") || !readdirSync(".").some((n) => /^admin(-novo)?\.html$/.test(n))) {
  console.error("Falta o painel: rode npm run painel:build antes (o npm run publicar já faz isso).");
  process.exit(1);
}
rmSync("publico", { recursive: true, force: true });
mkdirSync("publico");
for (const p of PASTAS) if (existsSync(p)) cpSync(p, "publico/" + p, { recursive: true });
const soltos = readdirSync(".").filter((n) => ARQUIVOS.test(n));
for (const n of soltos) cpSync(n, "publico/" + n);
console.log(`publico/: ${PASTAS.join(", ")} + ${soltos.length} arquivos`);
