// Painel da Tardim (React + TypeScript). `npm run painel:build` gera o painel na raiz do site:
//   admin.html (ARQUIVO_HTML) + assets/painel/*.js|css (nomes com hash)
// Os dois são gerados (estão no .gitignore): `wrangler pages dev .` (testes e local) e
// scripts/montar-publico.mjs (deploy) pegam daí. O CSP do site não aceita script inline:
// o HTML gerado só tem <script src>, sem o polyfill de modulepreload (tests/painel-csp.test.mjs confere).
// `npm run painel:dev`: Vite em http://localhost:5173 com /api, /js, /css, /assets e /arquivos
// repassados para o wrangler local na porta 8791 (`npm run dev`).
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const RAIZ = resolve(import.meta.dirname, "..");
const SAIDA = resolve(import.meta.dirname, "dist");
// Endereço do painel novo: admin.html (o painel antigo fica em admin-classico.html)
const ARQUIVO_HTML = "admin.html";

// Arquivos do site que o painel usa como estão (fora do bundle): estilos, dados das provas (SITE,
// PROXIMAS), gerador do link de convite (CONVITE), planilhas (XLSX) e o menu/animações (ui.js).
// Entram depois do processamento do Vite (order: "post") para ele não tentar empacotar.
// O ?v= é trocado por scripts/gerar-paginas.js --versao na publicação, como nas outras páginas.
const V = "?v=painel";
function arquivosDoSite(): Plugin {
  return {
    name: "tardim-arquivos-do-site",
    transformIndexHtml: {
      order: "post",
      handler: () => [
        { tag: "link", attrs: { rel: "stylesheet", href: "/css/style.css" + V }, injectTo: "head" },
        { tag: "link", attrs: { rel: "stylesheet", href: "/css/painel.css" + V }, injectTo: "head" },
        { tag: "script", attrs: { src: "/js/eventos.js" + V }, injectTo: "body" },
        { tag: "script", attrs: { src: "/js/convite.js" + V }, injectTo: "body" },
        { tag: "script", attrs: { src: "/js/vendor/xlsx-0.18.5.min.js" }, injectTo: "body" },
        { tag: "script", attrs: { src: "/js/ui.js" + V }, injectTo: "body" },
      ],
    },
  };
}

// Depois do build: copia dist/index.html -> <raiz>/admin.html e dist/assets/painel -> <raiz>/assets/painel
function copiaParaORaiz(): Plugin {
  return {
    name: "tardim-copia-para-o-raiz",
    apply: "build",
    closeBundle() {
      const destino = resolve(RAIZ, "assets", "painel");
      rmSync(destino, { recursive: true, force: true });
      mkdirSync(destino, { recursive: true });
      if (existsSync(resolve(SAIDA, "assets", "painel"))) cpSync(resolve(SAIDA, "assets", "painel"), destino, { recursive: true });
      cpSync(resolve(SAIDA, "index.html"), resolve(RAIZ, ARQUIVO_HTML));
    },
  };
}

const WRANGLER = "http://127.0.0.1:8791";
export default defineConfig({
  root: import.meta.dirname,
  base: "/",
  publicDir: false,
  plugins: [react(), arquivosDoSite(), copiaParaORaiz()],
  build: {
    outDir: SAIDA,
    emptyOutDir: true,
    assetsDir: "assets/painel",
    modulePreload: { polyfill: false },
    sourcemap: false,
    target: "es2022",
  },
  server: {
    port: 5173,
    // A API só aceita escrita da própria origem: o Origin vai como o do wrangler
    proxy: Object.fromEntries(["/api", "/js", "/css", "/assets", "/arquivos", "/manifest.webmanifest"].map((p) => [p, {
      target: WRANGLER, changeOrigin: true,
      configure: (proxy) => {
        proxy.on("proxyReq", (req) => { if (req.getHeader("origin")) req.setHeader("origin", WRANGLER); });
      },
    }])),
  },
});
