// Provas publicadas no painel (tabela provas do D1), servidas na hora, sem
// precisar publicar o site de novo:
//   /js/provas-db.js      lista que o calendário, as páginas e o kit leem
//   /prova-<id>.html      página da prova com a prévia (WhatsApp/redes) certa
// Qualquer outra rota (ou banco fora do ar) segue para os arquivos estáticos.
// As rotas que passam por aqui estão limitadas em _routes.json.

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const dataBR = (iso) => { const p = String(iso).split("-").map(Number); return p[2] + " de " + MESES[p[1] - 1] + " de " + p[0]; };
const lerJson = (t, padrao) => { try { return JSON.parse(t); } catch (e) { return padrao; } };

// Linha do banco -> formato do js/eventos.js
function daLinha(r) {
  return {
    id: r.id, nome: r.nome, data: r.data, hora: r.hora, local: r.local,
    percursos: lerJson(r.percursos, []), resumo: r.resumo, poster: r.poster, inscricao: r.inscricao,
    valores: lerJson(r.valores, []), kit: lerJson(r.kit, { itens: [], retirada: "" }), programacao: lerJson(r.programacao, []),
    premiacao: r.premiacao, percursoMapa: r.percurso_mapa, regulamento: r.regulamento, resultados: r.resultados,
    fotos: r.fotos, realizacao: r.realizacao, textoDivulgacao: r.texto_divulgacao, hashtags: r.hashtags, painel: true,
  };
}

async function provasJs(env) {
  const r = await env.DB.prepare("SELECT * FROM provas WHERE publicada = 1 ORDER BY data").all();
  const lista = r.results.map(daLinha);
  const corpo = "/* Provas publicadas no painel (D1). */\n(function () {\n  var DB = " + JSON.stringify(lista).replace(/</g, "\\u003c") + ";\n" +
    "  if (typeof PROXIMAS === \"undefined\") return;\n  DB.forEach(function (p) {\n" +
    "    for (var i = 0; i < PROXIMAS.length; i++) if (PROXIMAS[i].id === p.id) { PROXIMAS[i] = p; return; }\n" +
    "    PROXIMAS.push(p);\n  });\n})();\n";
  return new Response(corpo, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=60" } });
}

// Lê um arquivo estático (o Pages pode redirecionar /x.html para /x)
async function estatico(env, url) {
  let r = await env.ASSETS.fetch(url);
  for (let i = 0; i < 3 && r.status >= 300 && r.status < 400 && r.headers.get("location"); i++) {
    r = await env.ASSETS.fetch(new URL(r.headers.get("location"), url));
  }
  return r;
}

async function paginaProva(env, id, url) {
  const linha = await env.DB.prepare("SELECT * FROM provas WHERE id = ? AND publicada = 1").bind(id).first();
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
  ].join("\n");
  let html = await tpl.text();
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(titulo)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${esc(descricao)}" />`)
    .replace(/<!--og-->[\s\S]*?<!--\/og-->/, og)
    .replace(/(\s*)<script src="js\/eventos\.js/, `$1<script>window.PAGINA_ID = ${JSON.stringify(id)};</script>$1<script src="js/eventos.js`);
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60" } });
}

// A pasta inteira é publicada: o código do servidor, o esquema do banco e os
// arquivos de configuração não devem ser lidos pelo endereço do site.
const PRIVADO = /^\/(functions|d1|scripts|\.github|node_modules|\.wrangler)(\/|$)|^\/(wrangler\.toml|README\.md|\.gitignore|_routes\.json|_headers|\.dev\.vars|\.assetsignore)$/i;

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  if (PRIVADO.test(decodeURIComponent(url.pathname))) {
    return new Response("Não encontrado", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  }
  if (request.method !== "GET" || !env.DB) return protege(await next());
  let resp = null;
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
const SEGURANCA = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "SAMEORIGIN",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "strict-transport-security": "max-age=31536000",
};
function protege(resp) {
  try {
    const r = new Response(resp.body, resp);
    for (const k in SEGURANCA) if (!r.headers.has(k)) r.headers.set(k, SEGURANCA[k]);
    return r;
  } catch (e) {
    return resp; // resposta imutável (ex.: redirecionamento): segue como veio
  }
}
