// Consultas da assessoria conectada: quem é a chave, provas com convite e convites de prova.

import { json } from "../_lib/http.ts";
import { linhasProvas, formataProva, conviteApi, absoluto, isoBanco } from "./provas.ts";
import { ErroApi, corpoJson, texto } from "./comum.ts";
import type { Env, IntegracaoComParceiro } from "../_lib/tipos.ts";

type Integ = IntegracaoComParceiro;

/** GET /eu */
export function eu(integ: Integ, url: URL): Response {
  return json({
    assessoria: { id: integ.parceiro_id, nome: integ.p_nome, cidade: integ.p_cidade || null, uf: integ.p_uf || null, logo_url: absoluto(url.origin, integ.p_logo ? "arquivos/" + integ.p_logo : "") },
    chave: { prefixo: integ.prefixo, nome: integ.nome || null, ambiente: integ.ambiente, criada_em: isoBanco(integ.criada_em) },
  });
}

function paginacao(url: URL): { limite: number; inicio: number } {
  const limite = Math.min(Math.max(parseInt(url.searchParams.get("limite") as string, 10) || 100, 1), 500);
  let inicio = 0;
  const c = url.searchParams.get("cursor");
  if (c) {
    try { inicio = parseInt(atob(c.replace(/-/g, "+").replace(/_/g, "/")), 10); } catch (e) { inicio = -1; }
    if (!(inicio >= 0)) throw new ErroApi(400, "campo_obrigatorio", "Cursor inválido.");
  }
  return { limite, inicio };
}
const cursor = (n: number): string => btoa(String(n)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** GET /provas?desde=&atualizadas_desde=&limite=&cursor= */
export async function listaProvas(env: Env, integ: Integ, url: URL): Promise<Response> {
  const { limite, inicio } = paginacao(url);
  const desde = url.searchParams.get("desde");
  if (desde && !/^\d{4}-\d{2}-\d{2}$/.test(desde)) throw new ErroApi(400, "campo_obrigatorio", "Use desde=AAAA-MM-DD.");
  const mudou = url.searchParams.get("atualizadas_desde");
  const mudouIso = mudou ? isoBanco(mudou) : null;
  if (mudou && !mudouIso) throw new ErroApi(400, "campo_obrigatorio", "Data inválida em atualizadas_desde.");
  let linhas = await linhasProvas(env, integ);
  if (desde) linhas = linhas.filter((l) => l.data >= desde);
  if (mudouIso) linhas = linhas.filter((l) => [l.atualizado_em, l.c_atualizado].some((x) => x && (isoBanco(x) as string) >= mudouIso));
  const pagina = linhas.slice(inicio, inicio + limite);
  const provas = [];
  for (const l of pagina) provas.push(await formataProva(env, l, integ, url.origin));
  return json({ provas, proximo_cursor: inicio + limite < linhas.length ? cursor(inicio + limite) : null });
}

/** GET /provas/<id> */
export async function umaProva(env: Env, integ: Integ, id: string, url: URL): Promise<Response> {
  const [l] = await linhasProvas(env, integ, { provaId: id });
  if (!l) throw new ErroApi(404, "nao_encontrado", "Prova não encontrada ou sem convite para esta assessoria.");
  return json(await formataProva(env, l, integ, url.origin));
}

const SITUACOES = ["pendente", "aceito", "recusado"];

/** GET /convites?situacao= */
export async function listaConvites(env: Env, integ: Integ, url: URL): Promise<Response> {
  const s = url.searchParams.get("situacao");
  if (s && !SITUACOES.includes(s)) throw new ErroApi(400, "campo_obrigatorio", "situacao: pendente, aceito ou recusado.");
  const linhas = (await linhasProvas(env, integ, { todosConvites: true, situacao: s || null })).filter((l) => l.c_situacao);
  const convites = [];
  for (const l of linhas) convites.push(Object.assign(conviteApi(l), { prova: await formataProva(env, l, integ, url.origin) }));
  return json({ convites });
}

/** POST /convites/<id>/aceitar | /recusar */
export async function respondeConvite(request: Request, env: Env, integ: Integ, id: string, acao: "aceitar" | "recusar"): Promise<Response> {
  const [l] = await linhasProvas(env, integ, { conviteId: id, todosConvites: true });
  if (!l) throw new ErroApi(404, "nao_encontrado", "Convite não encontrado para esta assessoria.");
  const d = await corpoJson(request);
  const agora = isoBanco(Date.now());
  if (acao === "aceitar") {
    if (!["assessoria", "ticketsports"].includes(d.modo_pagamento)) throw new ErroApi(400, "campo_obrigatorio", "modo_pagamento: assessoria ou ticketsports.");
    await env.DB.prepare("UPDATE convites SET api_situacao = 'aceito', api_modo_pagamento = ?, api_motivo = '', api_respondido_em = ? WHERE id = ?")
      .bind(d.modo_pagamento, agora, id).run();
  } else {
    await env.DB.prepare("UPDATE convites SET api_situacao = 'recusado', api_modo_pagamento = '', api_motivo = ?, api_respondido_em = ? WHERE id = ?")
      .bind(texto(d.motivo, 300), agora, id).run();
  }
  const [novo] = await linhasProvas(env, integ, { conviteId: id, todosConvites: true });
  return json({ convite: conviteApi(novo) });
}
