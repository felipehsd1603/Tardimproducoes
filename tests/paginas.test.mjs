// Páginas geradas (publico/, de npm run site:build): o CSP do middleware não aceita script inline
// nem atributos on*=, e o prova.html precisa dos pontos que o middleware troca nas provas do painel.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { RAIZ } from "./apoio/ambiente.mjs";

const PUBLICO = join(RAIZ, "publico");
const paginas = existsSync(PUBLICO) ? readdirSync(PUBLICO).filter((f) => f.endsWith(".html")) : [];
const ler = (f) => readFileSync(join(PUBLICO, f), "utf8");

describe("páginas geradas", () => {
  test("o build existe (npm run site:build)", () => {
    assert.ok(paginas.includes("index.html") && paginas.includes("prova.html") && paginas.includes("admin.html"), "publico/ sem páginas");
  });

  test("nenhum script inline (fora JSON-LD) e nenhum atributo on*=", () => {
    const achados = [];
    for (const f of paginas) {
      const html = ler(f).replace(/<!--[\s\S]*?-->/g, "");
      for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
        const attrs = m[1];
        if (/\btype\s*=\s*["']?application\/ld\+json/i.test(attrs)) continue;
        if (!/\bsrc\s*=/i.test(attrs)) achados.push(`${f}: <script${attrs}> sem src`);
        else if (m[2].trim()) achados.push(`${f}: <script${attrs}> com código dentro`);
      }
      for (const m of html.matchAll(/<[a-zA-Z][^>]*?\s(on[a-z]+)\s*=/g)) achados.push(`${f}: atributo ${m[1]}`);
      for (const m of html.matchAll(/\s(?:href|src|action)\s*=\s*["']?\s*javascript:/gi)) achados.push(`${f}: ${m[0].trim()}`);
    }
    assert.deepEqual(achados, []);
  });

  test("prova.html mantém os pontos que o middleware troca", () => {
    const html = ler("prova.html");
    assert.match(html, /<html lang="pt-BR">/);
    assert.match(html, /<title>[^<]+<\/title>/);
    assert.match(html, /<meta name="description" content="[^"]*"\s*\/>/);
    assert.match(html, /<!--og-->[\s\S]*?<link rel="canonical"[\s\S]*?<!--\/og-->/);
  });
});
