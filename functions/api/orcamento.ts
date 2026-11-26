// POST /api/orcamento — guarda o pedido de orçamento no D1 (binding DB).
// Limite: 10 pedidos por IP por hora.

import { dentroDoLimite } from "../_lib/limite.ts";
import { json, mesmaOrigem } from "../_lib/http.ts";
import type { Contexto, Dados } from "../_lib/tipos.ts";

const LIMITES: Record<string, number> = { servico: 60, nome: 120, contratante: 60, empresa: 120, cidade: 120, quando: 40, publico: 40, detalhes: 2000 };

export async function onRequestPost({ request, env }: Contexto): Promise<Response> {
  if (!mesmaOrigem(request)) return json({ erro: "origem" }, 403);
  const texto = await request.text();
  if (texto.length > 8000) return json({ erro: "tamanho" }, 413);
  let d: Dados | null;
  try { d = JSON.parse(texto); } catch (e) { return json({ erro: "json" }, 400); }
  if (!d || typeof d !== "object") return json({ erro: "json" }, 400);

  const v: Record<string, string> = {};
  for (const campo in LIMITES) {
    const valor = typeof d[campo] === "string" ? d[campo].trim() : "";
    if (valor.length > LIMITES[campo]) return json({ erro: "campo", campo }, 400);
    v[campo] = valor;
  }
  if (!v.servico || !v.nome || !v.cidade) return json({ erro: "obrigatorio" }, 400);
  const canal = d.canal === "email" ? "email" : "whatsapp";
  if (!(await dentroDoLimite(env, request, "orcamento", 10, 3600))) return json({ erro: "limite" }, 429);

  await env.DB.prepare(
    "INSERT INTO orcamentos (canal, servico, nome, contratante, empresa, cidade, quando, publico, detalhes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(canal, v.servico, v.nome, v.contratante, v.empresa, v.cidade, v.quando, v.publico, v.detalhes).run();

  return json({ ok: true }, 201);
}
