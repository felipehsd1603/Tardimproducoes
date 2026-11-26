// /api/ticketsports — "Url do post" da Ticket Sports (Integração > Aplicativos).
//
//   qualquer método ?token=<TICKETSPORTS_TOKEN>        guarda a chamada crua em ticketsports_posts
//   e responde, em texto puro, a "Chave de validação" da Ticket Sports (segredo TICKETSPORTS_CHAVE)
//
// O formato do post não é documentado: por enquanto só guardamos tudo para ver
// os campos (cupom, valor, situação) e depois ligar à Apuração.
// O token fica em segredo: npx wrangler pages secret put TICKETSPORTS_TOKEN --project-name <projeto>

import type { Env, Contexto } from "../_lib/tipos.ts";

const MAX = 256 * 1024;
const SEM = /^(cookie|authorization|cf-|x-forwarded|x-real-ip|true-client-ip)/i;

function resp(corpo: unknown, status?: number): Response {
  return new Response(JSON.stringify(corpo), { status: status || 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

function tokenOk(request: Request, env: Env): boolean {
  const esperado = env.TICKETSPORTS_TOKEN || "";
  const t = new URL(request.url).searchParams.get("token") || "";
  if (esperado.length < 16 || t.length !== esperado.length) return false;
  let d = 0;
  for (let i = 0; i < t.length; i++) d |= t.charCodeAt(i) ^ esperado.charCodeAt(i);
  return d === 0;
}

async function guardar(request: Request, env: Env): Promise<void> {
  const corpo = await request.text();
  const cab: Record<string, string> = {};
  for (const [k, v] of request.headers) if (!SEM.test(k)) cab[k] = v.slice(0, 500);
  const q = new URL(request.url).searchParams;
  q.delete("token");
  await env.DB.prepare("INSERT INTO ticketsports_posts (metodo, tipo, cabecalhos, consulta, corpo) VALUES (?, ?, ?, ?, ?)")
    .bind(request.method, request.headers.get("content-type") || "", JSON.stringify(cab), q.toString(), corpo.slice(0, MAX)).run();
}

export async function onRequest({ request, env }: Contexto): Promise<Response> {
  if (!tokenOk(request, env)) return resp({ ok: false }, 401);
  if (!env.DB) return resp({ ok: false }, 503);
  if (Number(request.headers.get("content-length") || 0) > MAX * 4) return resp({ ok: false }, 413);
  await guardar(request, env);
  // A Ticket Sports valida a URL conferindo se a resposta é a "Chave de validação" dela
  return new Response(env.TICKETSPORTS_CHAVE || "", { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
