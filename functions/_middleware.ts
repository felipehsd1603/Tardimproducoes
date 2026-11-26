// Provas publicadas no painel (tabela provas do D1), servidas na hora, sem
// precisar publicar o site de novo:
//   /js/provas-db.js      lista que o calendário, as páginas e o kit leem
//   /prova-<id>.html      página da prova com a prévia (WhatsApp/redes) certa
// Qualquer outra rota (ou banco fora do ar) segue para os arquivos estáticos.
// As rotas que passam por aqui estão limitadas em _routes.json.

import { processaFila } from "./_api-v1/avisos.ts";
import type { Env, Contexto, Prova } from "./_lib/tipos.ts";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const esc = (s: unknown): string => String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const dataBR = (iso: string): string => { const p = String(iso).split("-").map(Number); return p[2] + " de " + MESES[p[1] - 1] + " de " + p[0]; };
const lerJson = <T>(t: string, padrao: T): T => { try { return JSON.parse(t); } catch (e) { return padrao; } };

// Linha do banco -> formato do js/eventos.js
function daLinha(r: Prova) {
  return {
    id: r.id, nome: r.nome, data: r.data, hora: r.hora, local: r.local,
    percursos: lerJson(r.percursos, []), resumo: r.resumo, poster: r.poster, inscricao: r.inscricao,
    valores: lerJson(r.valores, []), kit: lerJson(r.kit, { itens: [], retirada: "" }), programacao: lerJson(r.programacao, []),
    premiacao: r.premiacao, percursoMapa: r.percurso_mapa, regulamento: r.regulamento, resultados: r.resultados,
    fotos: r.fotos, realizacao: r.realizacao, textoDivulgacao: r.texto_divulgacao, hashtags: r.hashtags,
    faq: lerJson(r.faq, []), painel: true,
    // Situação das inscrições: a do painel manda; "automático" segue a conferência na Ticket Sports.
    // Vazio = o site decide pelas datas dos lotes (FECHAR_INSCRICOES em js/eventos.js)
    inscricoes: r.inscricoes || r.ts_situacao || "",
  };
}

async function provasJs(env: Env): Promise<Response> {
  const r = await env.DB.prepare("SELECT * FROM provas WHERE publicada = 1 ORDER BY data").all<Prova>();
  const lista = r.results.map(daLinha);
  // Depoimentos publicados no painel (js/ui.js mostra). Banco sem a tabela: segue sem eles.
  let depo: Record<string, unknown>[] = [];
  try {
    depo = (await env.DB.prepare("SELECT nome, cargo, texto, onde FROM depoimentos WHERE publicado = 1 ORDER BY criado_em DESC").all()).results;
  } catch (e) { depo = []; }
  const corpo = "/* Provas e depoimentos publicados no painel (D1). */\nvar DEPOIMENTOS = " + JSON.stringify(depo).replace(/</g, "\\u003c") + ";\n(function () {\n  var DB = " + JSON.stringify(lista).replace(/</g, "\\u003c") + ";\n" +
    "  if (typeof PROXIMAS === \"undefined\") return;\n  DB.forEach(function (p) {\n" +
    "    for (var i = 0; i < PROXIMAS.length; i++) if (PROXIMAS[i].id === p.id) { PROXIMAS[i] = p; return; }\n" +
    "    PROXIMAS.push(p);\n  });\n})();\n";
  return new Response(corpo, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=60" } });
}

// Lê um arquivo estático (o Pages pode redirecionar /x.html para /x)
async function estatico(env: Env, url: URL): Promise<Response> {
  let r = await env.ASSETS.fetch(url);
  for (let i = 0; i < 3 && r.status >= 300 && r.status < 400 && r.headers.get("location"); i++) {
    r = await env.ASSETS.fetch(new URL(r.headers.get("location") as string, url));
  }
  return r;
}

async function paginaProva(env: Env, id: string, url: URL): Promise<Response | null> {
  const linha = await env.DB.prepare("SELECT * FROM provas WHERE id = ? AND publicada = 1").bind(id).first<Prova>();
  if (!linha) return null;
  const tpl = await estatico(env, new URL("/prova.html", url));
  if (!tpl.ok) return null;
  const ev = daLinha(linha);
  const titulo = ev.nome + " · Tardim Produções";
  const descricao = [dataBR(ev.data), ev.local, (ev.percursos || []).join(", ")].filter(Boolean).join(" · ") + ". Inscrições e informações da prova.";
  const imagem = !ev.poster ? url.origin + "/assets/compartilhar.jpg" : (/^https?:/.test(ev.poster) ? ev.poster : url.origin + "/" + ev.poster.replace(/^\//, ""));
  const endereco = url.origin + url.pathname;
  const og = [
    "<!--og-->",
    `    <link rel="canonical" href="${esc(endereco)}" />`,
    `    <meta property="og:type" content="website" />`,
    `    <meta property="og:site_name" content="Tardim Produções" />`,
    `    <meta property="og:locale" content="pt_BR" />`,
    `    <meta property="og:title" content="${esc(ev.nome)}" />`,
    `    <meta property="og:description" content="${esc(descricao)}" />`,
    `    <meta property="og:image" content="${esc(imagem)}" />`,
    `    <meta property="og:image:secure_url" content="${esc(imagem)}" />`,
    `    <meta property="og:image:alt" content="${esc(ev.nome)}" />`,
    `    <meta property="og:url" content="${esc(endereco)}" />`,
    `    <meta name="twitter:card" content="summary_large_image" />`,
    "    <!--/og-->",
    // A arte é a maior imagem da tela e só entra pelo js/prova.js: o navegador já começa a baixar
    ...(ev.poster ? [`    <link rel="preload" as="image" href="${esc(ev.poster)}" fetchpriority="high" />`] : []),
  ].join("\n");
  let html = await tpl.text();
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(titulo)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${esc(descricao)}" />`)
    .replace(/<!--og-->[\s\S]*?<!--\/og-->/, og)
    .replace(/<html lang="pt-BR">/, `<html lang="pt-BR" data-pagina="${esc(id)}">`);
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60" } });
}

// O deploy sobe só publico/ (scripts/montar-publico.mjs), mas o Pages guarda em cache respostas
// de deploys antigos, que publicavam a pasta inteira. Por isso o _routes.json manda quase tudo
// para cá e o caminho é normalizado antes de conferir (//, \, /./, %2f, maiúsculas).
const PRIVADO = /^\/(functions|workers|d1|docs|scripts|tests|site|dist|painel|\.astro|\.github|node_modules|\.wrangler|\.git)(\/|$)|^\/(wrangler\.toml|README\.md|CHANGELOG\.md|package\.json|package-lock\.json|\.gitignore|\.gitattributes|\.editorconfig|_routes\.json|_headers|_redirects|\.dev\.vars|\.assetsignore|tsconfig\.json|astro\.config\.mjs)$/i;
function caminhoNormal(pathname: string): string {
  let p = pathname;
  for (let i = 0; i < 3; i++) { try { const d = decodeURIComponent(p); if (d === p) break; p = d; } catch (e) { break; } }
  p = p.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  const partes = [];
  for (const s of p.split("/")) {
    if (s === "..") partes.pop();
    else if (s !== ".") partes.push(s);
  }
  return ("/" + partes.filter((s, i) => s || i === partes.length - 1).join("/")).replace(/\/+/g, "/").replace(/[.\s]+$/, "");
}

// Avisos às plataformas que falharam: tentados de novo em segundo plano (Pages não tem tarefa agendada).
// Sempre nas chamadas do painel e da API v1; numa fração das visitas ao site, para não pesar.
function cuidaDaFila(env: Env, url: URL, waitUntil: (p: Promise<unknown>) => void): void {
  if (!env.DB || !waitUntil) return;
  const api = /^\/api\/(admin|v1)\//.test(url.pathname);
  if (api || Math.random() < 0.1) waitUntil(processaFila(env).catch(() => {}));
}

export async function onRequest({ request, env, next, waitUntil }: Contexto): Promise<Response> {
  const url = new URL(request.url);
  if (PRIVADO.test(caminhoNormal(url.pathname))) {
    return new Response("Não encontrado", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  }
  cuidaDaFila(env, url, waitUntil);
  if (request.method !== "GET" || !env.DB) return protege(await next());
  let resp: Response | null = null;
  try {
    if (url.pathname === "/js/provas-db.js") resp = await provasJs(env);
    else {
      const m = url.pathname.match(/^\/prova-([a-z0-9]+(?:-[a-z0-9]+)*?)(?:\.html)?$/);
      if (m) resp = await paginaProva(env, m[1], url);
    }
  } catch (e) {
    resp = null; // banco fora do ar ou sem a tabela: usa os arquivos estáticos
  }
  return protege(resp || (await next()));
}

// Cabeçalhos de segurança também nas respostas das funções (o _headers só vale
// para os arquivos estáticos)
const SEGURANCA: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "SAMEORIGIN",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "strict-transport-security": "max-age=31536000",
  // De fora, só o login do Google (parceiro.html), o Swagger (/api/*/docs, jsdelivr) e a previsão do tempo
  // (open-meteo). Nenhum script inline: as páginas só carregam arquivos .js (o Swagger manda o próprio CSP,
  // com o hash do script dele). 'unsafe-inline' fica só nos estilos (atributos style das páginas).
  "content-security-policy": [
    "default-src 'self'",
    "script-src 'self' https://accounts.google.com https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://accounts.google.com https://cdn.jsdelivr.net",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.open-meteo.com https://accounts.google.com",
    "frame-src https://accounts.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; "),
};
function protege(resp: Response): Response {
  try {
    const r = new Response(resp.body, resp);
    for (const k in SEGURANCA) if (!r.headers.has(k)) r.headers.set(k, SEGURANCA[k]);
    return r;
  } catch (e) {
    return resp; // resposta imutável (ex.: redirecionamento): segue como veio
  }
}
