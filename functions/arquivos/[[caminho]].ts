// GET /arquivos/<caminho> — imagens enviadas pelo painel (tabela arquivos do D1).
// Cada envio tem nome novo, então a resposta pode ficar em cache para sempre.

const RE_ARQUIVO = /^(provas|assessorias)\/[\w-][\w.-]*\.(jpe?g|png|webp)$/;

export async function onRequestGet({ request, env, params, waitUntil }) {
  const caminho = [].concat(params.caminho || []).map((x) => decodeURIComponent(x)).join("/");
  if (!RE_ARQUIVO.test(caminho) || !env.DB) return new Response("Não encontrado", { status: 404 });

  const cache = caches.default;
  const guardado = await cache.match(request);
  if (guardado) return guardado;

  const r = await env.DB.prepare("SELECT tipo, dados FROM arquivos WHERE caminho = ?").bind(caminho).first();
  if (!r) return new Response("Não encontrado", { status: 404 });
  const bytes = r.dados instanceof ArrayBuffer ? r.dados : new Uint8Array(r.dados).buffer;
  const resp = new Response(bytes, {
    headers: {
      "content-type": r.tipo,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "access-control-allow-origin": "*",
    },
  });
  waitUntil(cache.put(request, resp.clone()));
  return resp;
}
