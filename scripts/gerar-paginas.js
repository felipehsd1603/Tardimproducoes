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
vm.runInContext(ler("js/eventos.js") + "\n;this.SITE=SITE;this.PROXIMAS=PROXIMAS;this.REALIZADAS=REALIZADAS;", ctx);
const { SITE, PROXIMAS, REALIZADAS } = ctx;
const BASE = (SITE.urlBase || "").replace(/\/?$/, "/");
const BASE_PATH = BASE.replace(/^https?:\/\/[^/]+/, "") || "/";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const dataBR = (iso) => { const p = iso.split("-").map(Number); return p[2] + " de " + MESES[p[1] - 1] + " de " + p[0]; };

// Para a prévia, usa JPG/PNG (o WhatsApp lê melhor que WebP)
function imagemPrevia(img) {
  if (!img) return BASE + "assets/logo-tardim.png";
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
    `    <meta property="og:url" content="${esc(url)}" />`,
    `    <meta name="twitter:card" content="summary_large_image" />`,
    "    <!--/og-->",
  ].join("\n");
}
const trocaOG = (html, bloco) => html.replace(/<!--og-->[\s\S]*?<!--\/og-->/, bloco);
const trocaTitulo = (html, t) => html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(t)}</title>`);
const trocaDescricao = (html, d) => html.replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${esc(d)}" />`);
const marcaId = (html, id) => html.replace(/(\s*)<script src="js\/eventos\.js/, `$1<script>window.PAGINA_ID = ${JSON.stringify(id)};</script>$1<script src="js/eventos.js`);

// Apaga páginas geradas antes
for (const f of fs.readdirSync(RAIZ)) {
  if (/^(prova|trabalho)-.+\.html$/.test(f)) fs.unlinkSync(path.join(RAIZ, f));
}

const urls = [];

// Páginas fixas: só atualiza a prévia
const fixas = [
  { arquivo: "index.html", titulo: "Tardim Produções · Fazendo bem feito!", descricao: "Corridas de rua, eventos esportivos e prevenção contra incêndio em Belo Horizonte e Minas Gerais. Veja o calendário de provas.", imagem: "assets/fotos/hulk-run-largada.jpg", url: BASE },
  { arquivo: "portfolio.html", titulo: "Portfólio · Tardim Produções", descricao: "Eventos esportivos e serviços de prevenção contra incêndio para tribunais, prefeituras, conselhos e empresas em Minas Gerais.", imagem: "assets/fotos/hulk-run-largada.jpg", url: BASE + "portfolio.html" },
  { arquivo: "prova.html", titulo: "Prova · Tardim Produções", descricao: "Calendário de provas da Tardim Produções.", imagem: "", url: BASE + "prova.html" },
  { arquivo: "evento.html", titulo: "Portfólio · Tardim Produções", descricao: "Trabalho realizado pela Tardim Produções.", imagem: "", url: BASE + "evento.html" },
];
for (const p of fixas) {
  gravar(p.arquivo, trocaOG(ler(p.arquivo), blocoOG({ titulo: p.titulo, descricao: p.descricao, imagem: imagemPrevia(p.imagem), url: p.url })));
}
urls.push(BASE, BASE + "portfolio.html");

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
  html = trocaOG(html, blocoOG({ titulo: ev.nome, descricao, imagem: imagemPrevia(ev.poster), url: BASE + arquivo }));
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

console.log(`Páginas geradas: ${urls.length - 2} (provas e trabalhos). Base: ${BASE}`);
