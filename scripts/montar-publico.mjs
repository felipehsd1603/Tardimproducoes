// Monta publico/ só com o que o site serve: as páginas do Astro (dist/), as páginas que continuam
// escritas à mão na raiz (admin.html), css, js, imagens e as regras do Pages.
// É a pasta que o wrangler serve (npm test, npm run dev) e a que o deploy sobe: código, banco, docs,
// testes e segredos (.dev.vars) nunca entram no ar. As funções vêm de functions/ (o wrangler lê da pasta do projeto).
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, mkdirSync, writeFileSync } from "node:fs";

const PASTAS = ["assets", "css", "js"];
const REGRAS = ["manifest.webmanifest", "_headers", "_redirects", "_routes.json"];

if (!existsSync("dist/index.html")) {
  console.error("dist/ não tem as páginas do site: rode npm run site:build");
  process.exit(1);
}
rmSync("publico", { recursive: true, force: true });
cpSync("dist", "publico", { recursive: true });
const paginas = readdirSync("publico").filter((n) => n.endsWith(".html"));
for (const p of PASTAS) if (existsSync(p)) cpSync(p, "publico/" + p, { recursive: true });
for (const n of REGRAS) if (existsSync(n)) cpSync(n, "publico/" + n);

// Páginas que não passam pelo Astro (o painel): vão como estão, só com o ?v= da mesma versão das outras
const versao = (readFileSync("dist/index.html", "utf8").match(/\.css\?v=([\w.-]+)/) || [])[1];
const soltas = readdirSync(".").filter((n) => /^[\w-]+\.html$/.test(n));
for (const n of soltas) {
  if (paginas.includes(n)) {
    console.error(`${n} existe na raiz e no site Astro (site/pages): deixe só um`);
    process.exit(1);
  }
  const html = readFileSync(n, "utf8");
  writeFileSync("publico/" + n, versao ? html.replace(/(\.(?:css|js))\?v=[\w.-]+/g, `$1?v=${versao}`) : html);
}
console.log(`publico/: ${paginas.length} páginas do Astro + ${soltas.join(", ")} + ${PASTAS.join(", ")} (versão ${versao || "sem ?v="})`);
