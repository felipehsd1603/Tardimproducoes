// Site público em Astro: só HTML estático (nada de ilhas nem scripts processados).
// Fontes em site/; o build sai em dist/ e scripts/montar-publico.mjs junta tudo em publico/,
// a pasta que o wrangler serve (testes, dev) e publica.
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://tardimproducoes.com.br",
  srcDir: "./site",
  publicDir: "./site/sem-public", // css, js e imagens ficam na raiz e entram em publico/ pelo montar-publico
  outDir: "./dist",
  // prova.html, prova-<id>.html... nos mesmos endereços de antes (não prova/index.html)
  build: { format: "file", inlineStylesheets: "never" },
  // Mantém o HTML como está escrito (espaços e comentários, inclusive os marcadores <!--og--> do middleware)
  compressHTML: false,
  devToolbar: { enabled: false },
  // CSP sem script inline: nada vira data: nem código embutido
  vite: { build: { assetsInlineLimit: 0 } },
});
