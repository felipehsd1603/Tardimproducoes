// sitemap.xml: páginas principais, uma por prova e uma por trabalho do portfólio.
import type { APIRoute } from "astro";
import { BASE, PROVAS, TRABALHOS, esc } from "../lib/dados.ts";

export const GET: APIRoute = () => {
  const urls = [
    BASE,
    BASE + "empresas.html",
    BASE + "portfolio.html",
    BASE + "institucional.html",
    BASE + "privacidade.html",
    ...PROVAS.map((ev) => `${BASE}prova-${ev.id}.html`),
    ...TRABALHOS.map((tr) => `${BASE}trabalho-${tr.id}.html`),
  ];
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join("\n") + "\n</urlset>\n";
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
};
