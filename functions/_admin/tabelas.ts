// Tabelas que o painel edita (provas, parceiros, convites, propostas, minutário, depoimentos):
// campos permitidos, validação por tabela, conversão de saída e o CRUD genérico.

import { numeroCref } from "../_lib/cref6.ts";
import { Erro, PROFISSOES, RE_ID_PROVA, TIPOS_PARCEIRO } from "./comum.ts";
import type { Env, Dados } from "../_lib/tipos.ts";

/** Regra de cada campo: número = tamanho máximo do texto; o resto, o tipo guardado. */
type Regra = number | "json" | "bool" | "num" | "int" | "grande";
interface DefTabela { campos: Record<string, Regra>; obrigatorios: string[]; ordem: string }

// Campos que o painel pode gravar em cada tabela: número = tamanho máximo do texto
const TABELAS: Record<string, DefTabela> = {
  provas: {
    campos: {
      nome: 120, data: 10, hora: 10, local: 200, percursos: "json", resumo: 400, poster: 300, inscricao: 500,
      valores: "json", kit: "json", programacao: "json", premiacao: 300, percurso_mapa: 500, regulamento: 500,
      resultados: 500, fotos: 500, realizacao: 120, texto_divulgacao: 1500, hashtags: 200, publicada: "bool",
      faq: "json", // [["pergunta", "resposta"]]; o painel só envia quando há o que gravar (banco sem a coluna continua salvando)
      inscricoes: 10, // '' automático (Ticket Sports e datas dos lotes) | aberta | esgotado | encerrado; os ts_* só a conferência grava
    },
    obrigatorios: ["nome", "data"], ordem: "data",
  },
  parceiros: {
    campos: {
      tipo: 20, nome: 120, responsavel: 120, whatsapp: 20, email: 120, instagram: 60, cidade: 80,
      documento: 20, pix: 120, observacoes: 1000, logo: 200, cor: 7, ativo: "bool",
      profissao: 60, registro: 20, registro_situacao: 40, registro_nome: 120, registro_conferido_em: 30,
      situacao: 12, motivo_recusa: 300, // cadastro feito pelo site (parceiro.html): pendente | aprovado | recusado
      uf: 2, seguidores: "grande",
    },
    obrigatorios: ["tipo", "nome"], ordem: "nome COLLATE NOCASE",
  },
  convites: {
    campos: {
      parceiro_id: 40, prova_id: 60, cupom: 40, desconto: 20, comissao_pct: "num", cortesias: "int",
      contrapartida: 300, condicoes: 1000,
      coletiva: "json", // inscrição coletiva (assessoria/equipe): { d, m, i, v, f, g, b, kt, pe } de js/convite.js
    },
    obrigatorios: ["parceiro_id", "prova_id", "cupom"], ordem: "criado_em DESC",
  },
  // Propostas comerciais (aba Propostas): os itens e as somas ficam em "dados"
  propostas: {
    campos: { numero: 20, cliente: 160, evento: 200, dados: "json" },
    obrigatorios: ["cliente"], ordem: "criado_em DESC",
  },
  // Minutário: itens padrão das propostas; "dados" = { unit, qtd, pp, base }
  minutario: {
    campos: { categoria: 80, descricao: 2000, dados: "json" },
    obrigatorios: ["descricao"], ordem: "categoria COLLATE NOCASE, criado_em, rowid",
  },
  // Depoimentos mostrados no site (functions/_middleware.ts entrega os publicados)
  depoimentos: {
    campos: { nome: 120, cargo: 160, texto: 600, onde: 10, publicado: "bool" },
    obrigatorios: ["nome", "texto"], ordem: "criado_em DESC",
  },
};

// ---------- validação ----------
function limpa(tabela: string, d: Dados, criando: boolean): Dados {
  const def = TABELAS[tabela];
  const v: Dados = {};
  for (const campo in def.campos) {
    if (!(campo in d)) continue;
    const regra = def.campos[campo];
    let x = d[campo];
    if (regra === "json") {
      x = JSON.stringify(x == null ? (campo === "kit" ? { itens: [], retirada: "" } : (campo === "dados" ? {} : [])) : x);
      if (x.length > (tabela === "propostas" ? 150000 : 20000)) throw new Erro(400, "O campo " + campo + " está grande demais.");
    } else if (regra === "bool") {
      x = x ? 1 : 0;
    } else if (regra === "num") {
      x = Number(x) || 0;
      if (x < 0 || x > 100) throw new Erro(400, "A comissão precisa estar entre 0 e 100%.");
    } else if (regra === "grande") {
      x = parseInt(x, 10) || 0;
      if (x < 0 || x > 1000000000) throw new Erro(400, "Número inválido em " + campo + ".");
    } else if (regra === "int") {
      x = parseInt(x, 10) || 0;
      if (x < 0 || x > 1000) throw new Erro(400, "Número inválido em " + campo + ".");
    } else {
      x = typeof x === "string" ? x.trim() : (x == null ? "" : String(x));
      if (x.length > regra) throw new Erro(400, "O campo " + campo + " passou de " + regra + " caracteres.");
    }
    v[campo] = x;
  }
  if (criando) for (const c of def.obrigatorios) if (!v[c]) throw new Erro(400, "Preencha o campo " + c + ".");
  // regras de cada tabela
  if (tabela === "provas") {
    if ("data" in v && !/^\d{4}-\d{2}-\d{2}$/.test(v.data)) throw new Erro(400, "Data inválida.");
    if ("inscricoes" in v && ["", "aberta", "esgotado", "encerrado"].indexOf(v.inscricoes) < 0) throw new Erro(400, "Situação das inscrições inválida.");
    if ("poster" in v && v.poster && !/^(arquivos\/|assets\/|https:\/\/)/.test(v.poster)) throw new Erro(400, "Endereço da arte inválido.");
    for (const c of ["inscricao", "percurso_mapa", "regulamento", "resultados", "fotos"]) {
      if (v[c] && !/^https?:\/\//.test(v[c])) throw new Erro(400, "O link em " + c + " precisa começar com http:// ou https://.");
    }
  }
  if (tabela === "parceiros") {
    if ("tipo" in v && TIPOS_PARCEIRO.indexOf(v.tipo) < 0) throw new Erro(400, "Tipo de parceiro inválido.");
    if ("uf" in v) { v.uf = v.uf.toUpperCase(); if (v.uf && !/^[A-Z]{2}$/.test(v.uf)) throw new Erro(400, "Estado inválido."); }
    if ("situacao" in v &&["pendente", "aprovado", "recusado"].indexOf(v.situacao) < 0) throw new Erro(400, "Situação do cadastro inválida.");
    if ("cor" in v) { v.cor = v.cor.replace(/^#/, "").toLowerCase(); if (v.cor && !/^[0-9a-f]{6}$/.test(v.cor)) throw new Erro(400, "Cor inválida."); }
    if ("logo" in v && v.logo && !/^assessorias\/[\w-][\w.-]*\.(png|jpe?g|webp)$/.test(v.logo)) throw new Erro(400, "Caminho da logo inválido.");
    if ("profissao" in v && v.profissao && PROFISSOES.indexOf(v.profissao) < 0) throw new Erro(400, "Tipo de profissional inválido.");
    if (v.profissao === PROFISSOES[0] && "registro" in v) {
      const n = numeroCref(v.registro);
      if (!n) throw new Erro(400, "Número do CREF6 inválido.");
      v.registro = "MG-" + n;
    }
    if ("registro_conferido_em" in v && v.registro_conferido_em && isNaN(Date.parse(v.registro_conferido_em))) throw new Erro(400, "Data de conferência inválida.");
  }
  if (tabela === "depoimentos") {
    if ("onde" in v && ["empresas", "inicio", "ambas"].indexOf(v.onde) < 0) throw new Erro(400, "Lugar do depoimento inválido.");
    if ("nome" in v && !v.nome) throw new Erro(400, "Preencha o campo nome.");
    if ("texto" in v && !v.texto) throw new Erro(400, "Preencha o campo texto.");
  }
  if (tabela === "convites") {
    if ("cupom" in v) { v.cupom = v.cupom.toUpperCase(); if (!/^[A-Z0-9_-]{3,40}$/.test(v.cupom)) throw new Erro(400, "Cupom inválido: use de 3 a 40 letras, números, hífen ou sublinhado."); }
    if ("prova_id" in v && !RE_ID_PROVA.test(v.prova_id)) throw new Erro(400, "Prova inválida.");
    if ("coletiva" in v) {
      if (v.coletiva[0] !== "{") v.coletiva = "{}";
      if (v.coletiva.length > 2000) throw new Erro(400, "As condições da inscrição coletiva estão grandes demais.");
    }
  }
  return v;
}

// Linha do banco -> objeto do painel (JSON e 0/1 convertidos)
function saida(tabela: string, r: Dados | null): Dados | null {
  if (!r) return r;
  const def = TABELAS[tabela];
  const o = Object.assign({}, r);
  for (const c in def.campos) {
    if (def.campos[c] === "json") { try { o[c] = JSON.parse(o[c]); } catch (e) { o[c] = c === "kit" ? { itens: [], retirada: "" } : (c === "dados" ? {} : []); } }
    if (def.campos[c] === "bool") o[c] = !!o[c];
  }
  return o;
}

async function lista(env: Env, tabela: string): Promise<(Dados | null)[]> {
  const r = await env.DB.prepare(`SELECT * FROM ${tabela} ORDER BY ${TABELAS[tabela].ordem}`).all<Dados>();
  return r.results.map((x) => saida(tabela, x));
}
async function uma(env: Env, tabela: string, id: string): Promise<Dados | null> {
  return saida(tabela, await env.DB.prepare(`SELECT * FROM ${tabela} WHERE id = ?`).bind(id).first<Dados>());
}

async function cria(env: Env, tabela: string, d: Dados): Promise<Dados | null> {
  const v = limpa(tabela, d, true);
  if (tabela === "provas") {
    v.id = typeof d.id === "string" ? d.id.trim() : "";
    if (!RE_ID_PROVA.test(v.id) || v.id.length > 60) throw new Erro(400, "Identificador da prova inválido.");
  } else {
    v.id = crypto.randomUUID();
  }
  if (tabela === "convites" && !(await env.DB.prepare("SELECT 1 FROM parceiros WHERE id = ?").bind(v.parceiro_id).first())) {
    throw new Erro(400, "Parceiro não encontrado.");
  }
  const cols = Object.keys(v);
  await env.DB.prepare(`INSERT INTO ${tabela} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).bind(...cols.map((c) => v[c])).run();
  return uma(env, tabela, v.id);
}

async function altera(env: Env, tabela: string, id: string, d: Dados): Promise<Dados> {
  const v = limpa(tabela, d, false);
  // Proposta: o andamento (etapa, datas e contrato) não some quando uma tela antiga salva só os itens
  if (tabela === "propostas" && "dados" in v) {
    const atual = await env.DB.prepare("SELECT dados FROM propostas WHERE id = ?").bind(id).first<{ dados: string }>();
    let antes: Dados = {}, nova: Dados = {};
    try { antes = JSON.parse((atual && atual.dados) || "{}"); nova = JSON.parse(v.dados); } catch (e) { /* segue com o que veio */ }
    let mudou = false;
    for (const k of ["etapa", "marcos", "contrato"]) if (!(k in nova) && k in antes) { nova[k] = antes[k]; mudou = true; }
    if (mudou) v.dados = JSON.stringify(nova);
  }
  // Trocou o @: a conferência antiga do Instagram deixa de valer
  if (tabela === "parceiros" && "instagram" in v) {
    const atual = await env.DB.prepare("SELECT instagram FROM parceiros WHERE id = ?").bind(id).first<{ instagram: string }>();
    if (atual && atual.instagram.replace(/^@/, "").toLowerCase() !== v.instagram.replace(/^@/, "").toLowerCase()) {
      Object.assign(v, { ig_situacao: "", ig_seguidores: 0, ig_posts: 0, ig_conferido_em: "" });
    }
  }
  const cols = Object.keys(v);
  if (cols.length) {
    const r = await env.DB.prepare(
      `UPDATE ${tabela} SET ${cols.map((c) => c + " = ?").join(", ")}, atualizado_em = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`
    ).bind(...cols.map((c) => v[c]), id).run();
    if (!r.meta || !r.meta.changes) throw new Erro(404, "Registro não encontrado.");
  }
  const o = await uma(env, tabela, id);
  if (!o) throw new Erro(404, "Registro não encontrado.");
  return o;
}

async function apaga(env: Env, tabela: string, id: string): Promise<{ ok: true }> {
  const passos: D1PreparedStatement[] = [];
  if (tabela === "parceiros") {
    passos.push(env.DB.prepare("DELETE FROM convites WHERE parceiro_id = ?").bind(id));
    // Se o login tem outros perfis, o principal passa a ser um deles; senão o login some junto
    passos.push(env.DB.prepare(
      "UPDATE contas SET parceiro_id = (SELECT p.id FROM parceiros p WHERE p.conta_id = contas.id AND p.id <> ?1 LIMIT 1) " +
      "WHERE parceiro_id = ?1 AND EXISTS (SELECT 1 FROM parceiros p WHERE p.conta_id = contas.id AND p.id <> ?1)"
    ).bind(id));
    passos.push(env.DB.prepare("DELETE FROM contas WHERE parceiro_id = ?").bind(id));
  }
  // Proposta excluída leva junto o PDF assinado (banco sem a tabela: segue excluindo a proposta)
  if (tabela === "propostas") await env.DB.prepare("DELETE FROM contratos_assinados WHERE proposta_id = ?").bind(id).run().catch(() => {});
  // Parceiro excluído leva junto as chaves da API e os envios delas (banco sem as tabelas: segue)
  if (tabela === "parceiros") {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM envios_api WHERE integracao_id IN (SELECT id FROM integracoes WHERE parceiro_id = ?)").bind(id),
      env.DB.prepare("DELETE FROM integracoes WHERE parceiro_id = ?").bind(id),
    ]).catch(() => {});
  }
  passos.push(env.DB.prepare(`DELETE FROM ${tabela} WHERE id = ?`).bind(id));
  await env.DB.batch(passos);
  return { ok: true };
}

export { TABELAS, lista, uma, cria, altera, apaga };
