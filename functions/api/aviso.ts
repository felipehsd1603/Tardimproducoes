// /api/aviso — "Me avise quando as inscrições abrirem" (js/avise.js), no D1 (tabela avisos).
//
//   POST /api/aviso              { prova_id, nome, email }   guarda o pedido (repetido = ok, sem duplicar)
//   GET  /api/aviso?cancelar=<id>                            apaga o pedido (link no rodapé do e-mail)
//
// O e-mail sai pelo painel (functions/api/admin, POST avisos/<prova>/enviar) quando a prova
// ganha o link da Ticket Sports. Limite: 10 pedidos por IP por hora.

import { dentroDoLimite } from "../_lib/limite.ts";
import { json, mesmaOrigem } from "../_lib/http.ts";
import type { Contexto, Dados } from "../_lib/tipos.ts";

const RE_EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[a-z]{2,}$/i;
const RE_ID_PROVA = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RE_UUID = /^[0-9a-f-]{36}$/;

function pagina(titulo: string, texto: string): Response {
  const h = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${titulo} · Tardim Produções</title><link rel="stylesheet" href="/css/style.css"></head>
<body><main class="legal"><div class="wrap legal__wrap"><h1>${titulo}</h1><p class="legal__lead">${texto}</p>
<p class="legal__voltar"><a class="btn btn--red" href="/#calendario">Ver o calendário de provas</a></p></div></main></body></html>`;
  return new Response(h, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

export async function onRequestPost({ request, env }: Contexto): Promise<Response> {
  if (!env.DB) return json({ mensagem: "Aviso indisponível no momento." }, 503);
  if (!mesmaOrigem(request)) return json({ mensagem: "Origem não permitida." }, 403);
  const t = await request.text();
  if (t.length > 2000) return json({ mensagem: "Dados grandes demais." }, 413);
  let d: Dados | null;
  try { d = JSON.parse(t); } catch (e) { d = null; }
  if (!d || typeof d !== "object") return json({ mensagem: "Dados inválidos." }, 400);
  const prova = typeof d.prova_id === "string" ? d.prova_id.trim().slice(0, 80) : "";
  const nome = typeof d.nome === "string" ? d.nome.trim().slice(0, 120) : "";
  const email = typeof d.email === "string" ? d.email.trim().toLowerCase().slice(0, 120) : "";
  if (!RE_ID_PROVA.test(prova)) return json({ mensagem: "Prova inválida." }, 400);
  if (!RE_EMAIL.test(email)) return json({ mensagem: "Informe um e-mail válido." }, 400);
  if (!(await dentroDoLimite(env, request, "aviso", 10, 3600))) return json({ mensagem: "Muitos pedidos deste endereço. Tente mais tarde." }, 429);
  // Mesmo e-mail na mesma prova: atualiza o nome e volta a ficar pendente
  await env.DB.prepare(
    "INSERT INTO avisos (id, prova_id, nome, email) VALUES (?, ?, ?, ?) " +
    "ON CONFLICT (prova_id, email) DO UPDATE SET nome = excluded.nome, enviado_em = ''"
  ).bind(crypto.randomUUID(), prova, nome, email).run();
  return json({ ok: true }, 201);
}

export async function onRequestGet({ request, env }: Contexto): Promise<Response> {
  const id = new URL(request.url).searchParams.get("cancelar") || "";
  if (!env.DB || !RE_UUID.test(id)) return pagina("Link inválido", "Este link de cancelamento não é válido.");
  await env.DB.prepare("DELETE FROM avisos WHERE id = ?").bind(id).run();
  return pagina("Aviso cancelado", "Pronto, você não vai mais receber o aviso de inscrições desta prova.");
}
