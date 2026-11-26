// Dados combinados: provas do painel (banco) + provas do js/eventos.js que ainda não vieram para o painel.
import { pega } from "./loja.tsx";
import type { Parceiro, ProvaLista } from "./tipos.ts";
import { curta, ESTATICAS } from "./util.ts";

export function todasProvas(): ProvaLista[] {
  const lista: ProvaLista[] = pega().provas.map((r) => ({ id: r.id, nome: r.nome, data: r.data, fonte: r.publicada ? "publicada" : "rascunho", linha: r }));
  ESTATICAS.forEach((p) => {
    if (!lista.some((x) => x.id === p.id)) lista.push({ id: p.id, nome: p.nome, data: p.data, fonte: "codigo", obj: p });
  });
  return lista.sort((a, b) => String(a.data).localeCompare(String(b.data)));
}
export const provaPorId = (id: string): ProvaLista | undefined => todasProvas().filter((p) => p.id === id)[0];
export const parceiroPorId = (id: string): Parceiro | undefined => pega().parceiros.filter((p) => p.id === id)[0];
export function opcoesProvas(incluirTodas: boolean): [string, string][] {
  const o = todasProvas().map((p): [string, string] => [p.id, p.nome + " · " + curta(p.data)]);
  return incluirTodas ? ([["", "Todas as provas"]] as [string, string][]).concat(o) : o;
}
export function porId<T extends { id: string | number }>(lista: T[] | null, id: string | null | undefined): T | undefined {
  return (lista || []).filter((x) => String(x.id) === String(id))[0];
}
/** Campos da prova (do banco ou do js/eventos.js) para inscrição, local... */
export const camposDa = (p: ProvaLista | undefined): { inscricao?: string; local?: string } => (p ? p.linha || p.obj || {} : {});
