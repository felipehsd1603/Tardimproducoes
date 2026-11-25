// POST /api/evento — medição do site (js/ui.js): soma 1 no total do dia para
// o par evento + referência (tabela medicao). Não guarda IP, cookie nem nada
// que identifique o visitante; o painel lê os totais na aba "Medição".

import { json } from "../_lib/http.js";
import { dentroDoLimite } from "../_lib/limite.js";

// Até 60 eventos por hora por IP: um visitante real fica muito abaixo; quem tenta inflar os números para aqui
const MAX_POR_HORA = 60;

const EVENTOS = ["visita", "inscricao", "whatsapp", "orcamento", "agenda", "compartilhar"];

export async function onRequestPost({ request, env }) {
  let origem = "";
  try { origem = new URL(request.headers.get("Origin")).host; } catch (e) { origem = ""; }
  if (origem !== new URL(request.url).host) return json({ erro: "origem" }, 403);
  const texto = await request.text();
  if (texto.length > 300) return json({ erro: "tamanho" }, 413);
  let d;
  try { d = JSON.parse(texto); } catch (e) { return json({ erro: "json" }, 400); }
  if (!d || EVENTOS.indexOf(d.e) < 0) return json({ erro: "evento" }, 400);
  const ref = typeof d.r === "string" ? d.r : "";
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(ref) || ref.length > 60) return json({ erro: "ref" }, 400);
  if (!(await dentroDoLimite(env, request, "evento", MAX_POR_HORA, 3600))) return json({ erro: "limite" }, 429);
  // Dia no horário de Brasília (UTC-3, sem horário de verão)
  const dia = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  await env.DB.prepare(
    "INSERT INTO medicao (dia, evento, ref, n) VALUES (?, ?, ?, 1) ON CONFLICT (dia, evento, ref) DO UPDATE SET n = n + 1"
  ).bind(dia, d.e, ref).run();
  return json({ ok: true }, 201);
}
