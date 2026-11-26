// Compara as páginas de antes (HTML escrito à mão + scripts/gerar-paginas.js de um commit) com as
// páginas geradas pelo Astro (publico/). Confere, página por página, o DOM normalizado: título,
// descrição, prévia (og/twitter), canonical, JSON-LD, títulos, textos, links, scripts, estilos e
// atributos data-*. Diferenças aceitas: só o valor do ?v= (versão dos arquivos), espaços entre
// tags, comentários comuns (os marcadores <!--og--> contam), aspas/entidades e a ordem dos atributos.
//
// Uso: npm run site:build && node scripts/comparar-paginas.mjs [--ref <commit>] [--novo publico]
//   --ref   commit de antes (padrão: servidor-ts-sem-inscricao, a base da migração)
// Sai com código 1 se houver diferença.
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

const arg = (nome, padrao) => {
  const i = process.argv.indexOf(nome);
  return i > 0 ? process.argv[i + 1] : padrao;
};
const REF = arg("--ref", "servidor-ts-sem-inscricao");
const NOVO = arg("--novo", "publico");

// ---------- 1. Páginas de antes: git archive do commit + gerar-paginas.js ----------
function extraiCommit(ref) {
  const r = spawnSync("git", ["archive", "--format=tar", ref], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error("git archive " + ref + " falhou: " + r.stderr);
  const tar = r.stdout;
  const dir = mkdtempSync(join(tmpdir(), "tardim-antes-"));
  let longo = null;
  for (let o = 0; o + 512 <= tar.length; ) {
    const cab = tar.subarray(o, o + 512);
    if (cab.every((b) => b === 0)) break;
    const txt = (a, b) => cab.subarray(a, b).toString("utf8").replace(/\0.*$/s, "");
    let nome = txt(0, 100);
    const prefixo = txt(345, 500);
    if (prefixo) nome = prefixo + "/" + nome;
    const tam = parseInt(txt(124, 136).trim() || "0", 8);
    const tipo = String.fromCharCode(cab[156]);
    const dados = tar.subarray(o + 512, o + 512 + tam);
    o += 512 + Math.ceil(tam / 512) * 512;
    if (tipo === "x") { // cabeçalho pax: nome longo
      const m = dados.toString("utf8").match(/\d+ path=(.*)\n/);
      if (m) longo = m[1];
      continue;
    }
    if (tipo === "g") continue;
    if (longo) { nome = longo; longo = null; }
    const destino = join(dir, nome);
    if (tipo === "5") mkdirSync(destino, { recursive: true });
    else if (tipo === "0" || tipo === "\0") {
      mkdirSync(dirname(destino), { recursive: true });
      writeFileSync(destino, dados);
    }
  }
  return dir;
}

// ---------- 2. DOM normalizado ----------
const VAZIOS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const NOMEADAS = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decodifica = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) =>
    e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : NOMEADAS[e.toLowerCase()] ?? m);
const versao = (v) => v.replace(/(\.(?:css|js))\?v=[\w.-]+/g, "$1?v=*");

// Texto visível da página, com os espaços como o navegador mostra ("Tardim <b>Produções</b>" != "Tardim<b>Produções</b>")
function textoVisivel(html) {
  const corpo = html.replace(/<(script|style)[\s\S]*?<\/>/gi, " ").replace(/<!--[\s\S]*?-->/g, "").replace(/^[\s\S]*?<body[^>]*>/i, "");
  return decodifica(corpo.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

function tokens(html) {
  const out = [];
  const re = /<!--([\s\S]*?)-->|<!doctype[^>]*>|<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/gi;
  let i = 0;
  let m;
  const texto = (t) => {
    const s = decodifica(t).replace(/\s+/g, " ").trim();
    if (s) out.push({ t: "texto", v: s });
  };
  while ((m = re.exec(html))) {
    texto(html.slice(i, m.index));
    i = re.lastIndex;
    if (m[1] !== undefined) {
      const c = m[1].trim();
      if (c === "og" || c === "/og") out.push({ t: "marcador", v: "<!--" + c + "-->" });
      continue;
    }
    if (!m[3]) { out.push({ t: "doctype", v: "<!doctype html>" }); continue; }
    const nome = m[3].toLowerCase();
    if (m[2]) {
      if (!VAZIOS.has(nome)) out.push({ t: "fim", v: "</" + nome + ">" });
      continue;
    }
    const attrs = [];
    for (const a of m[4].matchAll(/([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      attrs.push([a[1].toLowerCase(), versao(decodifica(a[2] ?? a[3] ?? a[4] ?? ""))]);
    }
    attrs.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    out.push({ t: "tag", v: "<" + nome + attrs.map(([k, v]) => (v === "" ? " " + k : ` ${k}="${v}"`)).join("") + ">" });
    if (nome === "script" || nome === "style") {
      const fim = html.toLowerCase().indexOf("</" + nome, i);
      let corpo = html.slice(i, fim).trim();
      if (/application\/ld\+json/.test(m[4]) && corpo) corpo = "JSON " + JSON.stringify(JSON.parse(corpo));
      if (corpo) out.push({ t: "texto", v: corpo });
      i = fim;
      re.lastIndex = fim;
      continue;
    }
    if (m[5] || VAZIOS.has(nome)) {
      if (!VAZIOS.has(nome)) out.push({ t: "fim", v: "</" + nome + ">" });
    }
  }
  texto(html.slice(i));
  return out.map((x) => x.v);
}

// Diferenças entre duas listas (LCS), no formato "- antes" / "+ depois"
function difere(a, b) {
  const n = a.length, m = b.length;
  const L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let x = n - 1; x >= 0; x--) for (let y = m - 1; y >= 0; y--) L[x][y] = a[x] === b[y] ? L[x + 1][y + 1] + 1 : Math.max(L[x + 1][y], L[x][y + 1]);
  const d = [];
  let x = 0, y = 0;
  while (x < n || y < m) {
    if (x < n && y < m && a[x] === b[y]) { x++; y++; }
    else if (y < m && (x === n || L[x][y + 1] >= L[x + 1][y])) d.push("+ " + b[y++]);
    else d.push("- " + a[x++]);
  }
  return d;
}

// ---------- 3. Compara ----------
const antes = extraiCommit(REF);
const g = spawnSync(process.execPath, ["scripts/gerar-paginas.js"], { cwd: antes, encoding: "utf8", env: { ...process.env, GITHUB_SHA: "", CF_PAGES_COMMIT_SHA: "" } });
if (g.status !== 0) throw new Error("gerar-paginas.js do commit " + REF + " falhou:\n" + g.stderr);
if (!existsSync(join(NOVO, "index.html"))) throw new Error(`${NOVO}/index.html não existe: rode npm run site:build antes`);

const paginasAntes = readdirSync(antes).filter((f) => f.endsWith(".html")).sort();
const paginasNovo = readdirSync(NOVO).filter((f) => f.endsWith(".html")).sort();
let problemas = 0;
const linhas = [];
for (const f of paginasAntes) {
  if (!paginasNovo.includes(f)) { linhas.push(`FALTA  ${f} (não saiu no build novo)`); problemas++; continue; }
  const a = readFileSync(join(antes, f), "utf8"), b = readFileSync(join(NOVO, f), "utf8");
  const d = difere(tokens(a), tokens(b));
  const ta = textoVisivel(a), tb = textoVisivel(b);
  if (ta !== tb) {
    let k = 0;
    while (ta[k] === tb[k]) k++;
    d.push(`texto visível: "...${ta.slice(Math.max(0, k - 40), k + 40)}..." virou "...${tb.slice(Math.max(0, k - 40), k + 40)}..."`);
  }
  if (d.length) { problemas++; linhas.push(`DIFERE ${f}`, ...d.slice(0, 40).map((l) => "         " + l.slice(0, 200))); }
  else linhas.push(`igual  ${f}`);
}
for (const f of paginasNovo) if (!paginasAntes.includes(f)) { linhas.push(`NOVA   ${f} (não existia antes)`); problemas++; }
for (const f of ["sitemap.xml", "robots.txt"]) {
  const a = readFileSync(join(antes, f), "utf8"), b = existsSync(join(NOVO, f)) ? readFileSync(join(NOVO, f), "utf8") : "";
  if (a === b) linhas.push(`igual  ${f}`);
  else { problemas++; linhas.push(`DIFERE ${f}`, ...difere(a.split("\n"), b.split("\n")).map((l) => "         " + l)); }
}
rmSync(antes, { recursive: true, force: true });
console.log(linhas.join("\n"));
console.log(`\n${paginasAntes.length} páginas de ${REF} comparadas com ${NOVO}/ (+ sitemap.xml e robots.txt): ${problemas ? problemas + " com diferença" : "todas iguais"}.`);
process.exit(problemas ? 1 : 0);
