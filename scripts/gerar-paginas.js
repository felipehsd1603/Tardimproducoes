/*
 * Gera as páginas estáticas do site a partir de js/eventos.js:
 *   - prova-<id>.html     uma por prova do calendário
 *   - trabalho-<id>.html  uma por trabalho do portfólio
 *   - prévias para WhatsApp/redes (Open Graph) em todas as páginas
 *   - sitemap.xml, robots.txt e 404.html
 *
 * Uso: node scripts/gerar-paginas.js
 * Roda sozinho a cada publicação (workflow do GitHub Pages).
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RAIZ = path.join(__dirname, "..");
const ler = (f) => fs.readFileSync(path.join(RAIZ, f), "utf8");
const gravar = (f, s) => fs.writeFileSync(path.join(RAIZ, f), s);

// Carrega os dados do site
const ctx = {};
vm.createContext(ctx);
vm.runInContext(ler("js/eventos.js") + "\n" + ler("js/realizadas.js") + "\n;this.SITE=SITE;this.PROXIMAS=PROXIMAS;this.REALIZADAS=REALIZADAS;", ctx);
const { SITE, PROXIMAS, REALIZADAS } = ctx;
const BASE = (SITE.urlBase || "").replace(/\/?$/, "/");
const BASE_PATH = BASE.replace(/^https?:\/\/[^/]+/, "") || "/";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const dataBR = (iso) => { const p = iso.split("-").map(Number); return p[2] + " de " + MESES[p[1] - 1] + " de " + p[0]; };

// Para a prévia, usa JPG/PNG (o WhatsApp lê melhor que WebP)
function imagemPrevia(img) {
  if (!img) return BASE + "assets/compartilhar.jpg";
  if (/^https?:\/\//.test(img)) return img;
  const semExt = img.replace(/\.(webp|jpg|jpeg|png)$/i, "");
  for (const ext of [".jpg", ".png", ".jpeg"]) {
    if (fs.existsSync(path.join(RAIZ, semExt + ext))) return BASE + semExt + ext;
  }
  return BASE + img;
}

function blocoOG({ titulo, descricao, imagem, url, tipo }) {
  return [
    "<!--og-->",
    `    <link rel="canonical" href="${esc(url)}" />`,
    `    <meta property="og:type" content="${tipo || "website"}" />`,
    `    <meta property="og:site_name" content="Tardim Produções" />`,
    `    <meta property="og:locale" content="pt_BR" />`,
    `    <meta property="og:title" content="${esc(titulo)}" />`,
    `    <meta property="og:description" content="${esc(descricao)}" />`,
    `    <meta property="og:image" content="${esc(imagem)}" />`,
    `    <meta property="og:image:secure_url" content="${esc(imagem)}" />`,
    ...(/compartilhar\.jpg$/.test(imagem) ? [
      `    <meta property="og:image:type" content="image/jpeg" />`,
      `    <meta property="og:image:width" content="1200" />`,
      `    <meta property="og:image:height" content="630" />`,
    ] : []),
    `    <meta property="og:image:alt" content="${esc(titulo)}" />`,
    `    <meta property="og:url" content="${esc(url)}" />`,
    `    <meta name="twitter:card" content="summary_large_image" />`,
    "    <!--/og-->",
  ].join("\n");
}
const trocaOG = (html, bloco) => html.replace(/<!--og-->[\s\S]*?<!--\/og-->/, bloco);
const trocaTitulo = (html, t) => html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(t)}</title>`);
const trocaDescricao = (html, d) => html.replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${esc(d)}" />`);
const marcaId = (html, id) => html.replace(/(\s*)<script src="js\/eventos\.js/, `$1<script>window.PAGINA_ID = ${JSON.stringify(id)};</script>$1<script src="js/eventos.js`);

// As provas cadastradas no painel não passam por aqui: ficam no banco D1 e o
// Cloudflare serve js/provas-db.js e prova-<id>.html na hora (functions/_middleware.js).

async function main() {

// Apaga páginas geradas antes
for (const f of fs.readdirSync(RAIZ)) {
  if (/^(prova|trabalho)-.+\.html$/.test(f)) fs.unlinkSync(path.join(RAIZ, f));
}

const urls = [];

// Páginas fixas: só atualiza a prévia
const fixas = [
  { arquivo: "index.html", titulo: "Tardim Produções", descricao: "Fazendo bem feito!", imagem: "assets/compartilhar.jpg", url: BASE },
  { arquivo: "portfolio.html", titulo: "Portfólio · Tardim Produções", descricao: "Fazendo bem feito!", imagem: "assets/compartilhar.jpg", url: BASE + "portfolio.html" },
  { arquivo: "prova.html", titulo: "Prova · Tardim Produções", descricao: "Calendário de provas da Tardim Produções.", imagem: "", url: BASE + "prova.html" },
  { arquivo: "assessorias.html", titulo: "Inscrição coletiva para assessorias · Tardim Produções", descricao: "Baixe o modelo, confira a planilha da sua equipe e envie para a Tardim Produções.", imagem: "assets/compartilhar.jpg", url: BASE + "assessorias.html" },
  { arquivo: "equipe.html", titulo: "Página da equipe · Tardim Produções", descricao: "Corra com a sua assessoria: veja a prova, o prazo e mande seus dados para a inscrição.", imagem: "assets/compartilhar.jpg", url: BASE + "equipe.html" },
  { arquivo: "empresas.html", titulo: "Para empresas · Tardim Produções", descricao: "Sua corrida ou evento do começo ao fim, com um só fornecedor. Simule e peça seu orçamento.", imagem: "assets/compartilhar.jpg", url: BASE + "empresas.html" },
  { arquivo: "institucional.html", titulo: "Institucional · Tardim Produções", descricao: "Corridas, eventos e prevenção contra incêndio para órgãos públicos, conselhos e instituições.", imagem: "assets/compartilhar.jpg", url: BASE + "institucional.html" },
  { arquivo: "privacidade.html", titulo: "Política de privacidade · Tardim Produções", descricao: "Fazendo bem feito!", imagem: "assets/compartilhar.jpg", url: BASE + "privacidade.html" },
  { arquivo: "programa-embaixadores.html", titulo: "Programa de embaixadores · Tardim Produções", descricao: "Regras para quem divulga as provas da Tardim Produções com cupom e link próprios.", imagem: "assets/compartilhar.jpg", url: BASE + "programa-embaixadores.html" },
  { arquivo: "parceiro.html", titulo: "Área do parceiro · Tardim Produções", descricao: "Assessorias, influenciadores e embaixadores: cadastre-se e acompanhe seus convites, cupons e links.", imagem: "assets/compartilhar.jpg", url: BASE + "parceiro.html" },
  { arquivo: "kit.html", titulo: "Kit de divulgação · Tardim Produções", descricao: "Seu link, cupom, textos prontos e card para stories.", imagem: "assets/compartilhar.jpg", url: BASE + "kit.html" },
  { arquivo: "evento.html", titulo: "Portfólio · Tardim Produções", descricao: "Trabalho realizado pela Tardim Produções.", imagem: "", url: BASE + "evento.html" },
];
for (const p of fixas) {
  gravar(p.arquivo, trocaOG(ler(p.arquivo), blocoOG({ titulo: p.titulo, descricao: p.descricao, imagem: imagemPrevia(p.imagem), url: p.url })));
}
urls.push(BASE, BASE + "empresas.html", BASE + "portfolio.html", BASE + "institucional.html", BASE + "privacidade.html");
const FIXAS_NO_SITEMAP = urls.length;

// Uma página por prova
const modeloProva = ler("prova.html");
for (const ev of PROXIMAS) {
  if (!ev.id || ev.demo) continue;
  const arquivo = `prova-${ev.id}.html`;
  const titulo = `${ev.nome} · Tardim Produções`;
  const percursos = Array.isArray(ev.percursos) ? ev.percursos.join(", ") : (ev.percursos || "");
  const descricao = [ev.data ? dataBR(ev.data) : "", ev.local, percursos].filter(Boolean).join(" · ") + ". Inscrições e informações da prova.";
  let html = trocaTitulo(modeloProva, titulo);
  html = trocaDescricao(html, descricao);
  // A arte é a maior imagem da tela e só entra pelo js/prova.js: o navegador já começa a baixar
  html = trocaOG(html, blocoOG({ titulo: ev.nome, descricao, imagem: imagemPrevia(ev.poster), url: BASE + arquivo }) +
    (ev.poster ? `\n    <link rel="preload" as="image" href="${esc(ev.poster)}" fetchpriority="high" />` : ""));
  html = marcaId(html, ev.id);
  gravar(arquivo, html);
  urls.push(BASE + arquivo);
}

// Uma página por trabalho do portfólio
const modeloTrabalho = ler("evento.html");
for (const tr of REALIZADAS) {
  if (!tr.id || tr.demo) continue;
  const arquivo = `trabalho-${tr.id}.html`;
  const titulo = `${tr.nome} · Portfólio · Tardim Produções`;
  const descricao = tr.descricao || [tr.cliente, tr.local, tr.ano].filter(Boolean).join(" · ") || "Trabalho realizado pela Tardim Produções.";
  let html = trocaTitulo(modeloTrabalho, titulo);
  html = trocaDescricao(html, descricao);
  html = trocaOG(html, blocoOG({ titulo: tr.nome, descricao, imagem: imagemPrevia(tr.capa || tr.logo), url: BASE + arquivo, tipo: "article" }));
  html = marcaId(html, tr.id);
  gravar(arquivo, html);
  urls.push(BASE + arquivo);
}

// sitemap.xml e robots.txt
gravar("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join("\n") + "\n</urlset>\n");
gravar("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${BASE}sitemap.xml\n`);

// Página 404 (base absoluta para funcionar em qualquer endereço quebrado)
const p404 = ler("scripts/404-modelo.html").replace(/__BASE__/g, BASE_PATH);
gravar("404.html", p404);

// Na publicação, carimba o ?v= do CSS e dos JS para o navegador dos visitantes
// baixar a versão nova: com o commit no GitHub Actions ou no build do
// Cloudflare Pages ligado ao GitHub; com data e hora quando rodado no
// computador com --versao (antes de "wrangler pages deploy"). Sem isso, não mexe.
const agora = new Date();
const carimboLocal = process.argv.includes("--versao")
  ? agora.getFullYear() + String(agora.getMonth() + 1).padStart(2, "0") + String(agora.getDate()).padStart(2, "0") + "-" +
    String(agora.getHours()).padStart(2, "0") + String(agora.getMinutes()).padStart(2, "0")
  : "";
const versao = (process.env.GITHUB_SHA || process.env.CF_PAGES_COMMIT_SHA || "").slice(0, 8) || carimboLocal;
if (versao) {
  for (const f of fs.readdirSync(RAIZ)) {
    if (/\.html$/.test(f)) gravar(f, ler(f).replace(/(\.(?:css|js))\?v=[\w.-]+/g, `$1?v=${versao}`));
  }
}

console.log(`Páginas geradas: ${urls.length - FIXAS_NO_SITEMAP} (provas e trabalhos). Base: ${BASE}${versao ? ". Versão: " + versao : ""}`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
