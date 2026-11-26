// robots.txt: tudo liberado, com o endereço do sitemap.
import type { APIRoute } from "astro";
import { BASE } from "../lib/dados.ts";

export const GET: APIRoute = () => new Response(`User-agent: *\nAllow: /\nSitemap: ${BASE}sitemap.xml\n`, { headers: { "content-type": "text/plain; charset=utf-8" } });
