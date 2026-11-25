// Peças comuns da API do painel: erro ({ erro: <status>, mensagem }), leitura do corpo e regras compartilhadas.

import { json } from "../_lib/http.ts";

export { json };

// O primeiro é o único com registro conferido no CREF6 (js/admin.js usa a mesma lista)
const PROFISSOES = [
  "Profissional de Educação Física (CREF6/MG)", "Profissional de Educação Física (outro CREF)",
  "Fisioterapeuta", "Nutricionista", "Médico", "Atleta/corredor", "Outro",
];

const MAX_ARQUIVO = 1900000;       // o D1 aceita até ~2 MB por linha

const RE_ID_PROVA = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RE_ARQUIVO = /^(provas|assessorias)\/[\w-][\w.-]*\.(jpe?g|png|webp)$/;
const TIPOS_PARCEIRO = ["embaixador", "influenciador", "assessoria", "equipe"];

class Erro extends Error {
  constructor(status, mensagem) { super(mensagem); this.status = status; }
}

async function corpo(request) {
  const t = await request.text();
  if (t.length > 200000) throw new Erro(413, "Dados grandes demais.");
  try { const d = JSON.parse(t); if (d && typeof d === "object" && !Array.isArray(d)) return d; } catch (e) { /* cai no erro abaixo */ }
  throw new Erro(400, "Dados inválidos.");
}

export { PROFISSOES, MAX_ARQUIVO, RE_ID_PROVA, RE_ARQUIVO, TIPOS_PARCEIRO, Erro, corpo };
