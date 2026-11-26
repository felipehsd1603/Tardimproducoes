// O painel gerado pelo Vite (npm run painel:build, que o npm test roda antes) respeita o CSP do site
// (functions/_middleware.ts: script-src sem 'unsafe-inline'): só <script src> do próprio site, nenhum
// script inline, nenhum atributo on*= e nenhum polyfill de modulepreload embutido.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const RAIZ = resolve(import.meta.dirname, "..");
// O painel novo (React) e o antigo (js/admin.js), onde estiverem
const PAGINAS = ["admin.html", "admin-novo.html", "admin-classico.html"].filter((f) => existsSync(join(RAIZ, f)));

test("o painel foi gerado", () => {
  const react = PAGINAS.map((f) => readFileSync(join(RAIZ, f), "utf8")).filter((h) => /assets\/painel\//.test(h));
  assert.ok(react.length, "rode npm run painel:build: nenhuma página com assets/painel/ na raiz");
});

for (const f of PAGINAS) {
  const html = readFileSync(join(RAIZ, f), "utf8");
  test(f + ": nenhum script inline", () => {
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    assert.ok(scripts.length, "sem <script>");
    for (const [tag, attrs, corpo] of scripts) {
      assert.match(attrs, /\ssrc="\/?(js|assets\/painel)\/[^"]+"/, "script sem src do próprio site: " + tag.slice(0, 120));
      assert.equal(corpo.trim(), "", "script com código inline: " + tag.slice(0, 120));
    }
  });
  test(f + ": nenhum atributo on*= (onclick, onload...)", () => {
    const tags = html.match(/<[a-z][^>]*>/gi) || [];
    const comHandler = tags.filter((t) => /\son[a-z]+\s*=/i.test(t));
    assert.deepEqual(comHandler, []);
  });
  test(f + ": os scripts e estilos citados existem", () => {
    for (const [, caminho] of html.matchAll(/(?:src|href)="\/?((?:js|css|assets\/painel)\/[^"?#]+)/g)) {
      assert.ok(existsSync(join(RAIZ, caminho)), "falta " + caminho);
    }
  });
}

test("o JS do painel não traz o polyfill de modulepreload", () => {
  const html = PAGINAS.map((f) => readFileSync(join(RAIZ, f), "utf8")).find((h) => /assets\/painel\//.test(h)) || "";
  for (const [, js] of html.matchAll(/src="\/?(assets\/painel\/[^"]+\.js)"/g)) {
    // O polyfill do Vite vigia os <link rel="modulepreload"> com MutationObserver (o React não usa)
    assert.doesNotMatch(readFileSync(join(RAIZ, js), "utf8"), /MutationObserver/);
  }
});
