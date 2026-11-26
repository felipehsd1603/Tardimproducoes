// POST /api/inscricao — guarda a inscrição coletiva (equipe + atletas) no D1 (binding DB).
// Limite: 10 envios por IP por hora.

import { dentroDoLimite } from "../_lib/limite.ts";
import { json, mesmaOrigem, cpfValido } from "../_lib/http.ts";
import type { Contexto, Dados } from "../_lib/tipos.ts";

const MAX_ATLETAS = 1000;
const POR_LOTE = 10; // 10 atletas x 10 colunas = 100 parâmetros, o teto do D1 por comando

function txt(valor: unknown, max: number): string | null {
  const s = typeof valor === "string" ? valor.trim() : "";
  return s.length > max ? null : s;
}

export async function onRequestPost({ request, env }: Contexto): Promise<Response> {
  if (!mesmaOrigem(request)) return json({ erro: "origem" }, 403);
  const texto = await request.text();
  if (texto.length > 600000) return json({ erro: "tamanho" }, 413);
  let d: Dados | null;
  try { d = JSON.parse(texto); } catch (e) { return json({ erro: "json" }, 400); }
  if (!d || typeof d !== "object" || !d.prova || !Array.isArray(d.atletas)) return json({ erro: "json" }, 400);

  const cab: Record<string, string | null> = {
    prova_id: txt(d.prova.id, 80), prova_nome: txt(d.prova.nome, 160), convite: txt(d.convite, 400),
    equipe: txt(d.equipe, 120), responsavel: txt(d.responsavel, 120), telefone: txt(d.telefone, 30),
  };
  for (const k in cab) if (cab[k] === null) return json({ erro: "campo", campo: k }, 400);
  if (!cab.prova_id || !cab.prova_nome || !cab.equipe) return json({ erro: "obrigatorio" }, 400);
  if (!d.atletas.length || d.atletas.length > MAX_ATLETAS) return json({ erro: "atletas" }, 400);
  const canal = d.canal === "email" ? "email" : "whatsapp";

  const id = crypto.randomUUID();
  const linhas: (string | null)[][] = [];
  for (let i = 0; i < d.atletas.length; i++) {
    const a = d.atletas[i] || {};
    const l = [
      id, txt(a.nome, 120), txt(a.cpf, 14), txt(a.nasc, 10), txt(a.sexo, 1), txt(a.dist, 40),
      txt(a.cam, 10), txt(a.email, 160), txt(a.tel, 20), txt(a.equipe, 120),
    ];
    const faltou = l.slice(1, 9).some(function (c) { return !c; });
    if (faltou || l[9] === null || !cpfValido((l[2] as string).replace(/\D/g, ""))) return json({ erro: "atleta", linha: i + 1 }, 400);
    linhas.push(l);
  }

  if (!(await dentroDoLimite(env, request, "inscricao", 10, 3600))) return json({ erro: "limite" }, 429);

  const comandos = [
    env.DB.prepare(
      "INSERT INTO inscricoes (id, canal, prova_id, prova_nome, convite, equipe, responsavel, telefone, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(id, canal, cab.prova_id, cab.prova_nome, cab.convite, cab.equipe, cab.responsavel, cab.telefone, linhas.length),
  ];
  for (let i = 0; i < linhas.length; i += POR_LOTE) {
    const lote = linhas.slice(i, i + POR_LOTE);
    comandos.push(env.DB.prepare(
      "INSERT INTO atletas (inscricao_id, nome, cpf, nascimento, sexo, distancia, camiseta, email, telefone, equipe) VALUES " +
      lote.map(function () { return "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"; }).join(", ")
    ).bind(...lote.flat()));
  }
  await env.DB.batch(comandos); // tudo ou nada

  return json({ ok: true, id, atletas: linhas.length }, 201);
}
