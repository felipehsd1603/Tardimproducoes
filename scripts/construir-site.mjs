// npm run site:build: gera as páginas com o Astro (site/ -> dist/) e monta publico/.
// Telemetria do Astro desligada: o build não manda nada para fora.
process.env.ASTRO_TELEMETRY_DISABLED = "1";
const { build } = await import("astro");
await build({ logLevel: process.argv.includes("--detalhes") ? "info" : "warn" });
await import("./montar-publico.mjs");
