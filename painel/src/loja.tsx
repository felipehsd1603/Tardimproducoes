// Estado do painel (dados lidos da API, tela, aviso, caixas de diálogo) e a navegação por endereço (#provas,
// #prova/<id>, #convite/<id>/links...). Mesmas regras do painel antigo (js/admin.js): Voltar do navegador e F5
// mantêm a tela, formulário alterado pergunta antes de sair, o item recém-salvo pisca na lista.
import { useSyncExternalStore, type ReactNode } from "react";
import type { Convite, ConfigContrato, Depoimento, Inscricao, ItemMinutario, Orcamento, Parceiro, Prova, Proposta, ResumoAviso } from "./tipos.ts";

export interface Aviso { msg: string; erro: boolean; link: [string, () => void] | null; id: number }
export interface Dialogo { id: number; classe: string; render: (fecha: (v: unknown) => void) => ReactNode; padrao: unknown; resolve: (v: unknown) => void }

export interface Estado {
  tela: "carregando" | "login" | "semApi" | "painel";
  msgTela: string;
  provas: Prova[]; parceiros: Parceiro[]; convites: Convite[]; depoimentos: Depoimento[]; semDepoimentos: boolean;
  // lidos só quando a aba abre (null = ainda não leu)
  orcamentos: Orcamento[] | null; inscricoes: Inscricao[] | null; propostas: Proposta[] | null;
  minutario: ItemMinutario[] | null; config: ConfigContrato | null; avisos: ResumoAviso[] | null;
  rota: string; versao: number; aba: string;
  aviso: Aviso | null;
  dialogos: Dialogo[];
}

let estado: Estado = {
  tela: "carregando", msgTela: "",
  provas: [], parceiros: [], convites: [], depoimentos: [], semDepoimentos: false,
  orcamentos: null, inscricoes: null, propostas: null, minutario: null, config: null, avisos: null,
  rota: "", versao: 0, aba: "provas", aviso: null, dialogos: [],
};
const ouvintes = new Set<() => void>();
export const pega = (): Estado => estado;
export function muda(p: Partial<Estado> | ((e: Estado) => Partial<Estado>)): void {
  estado = { ...estado, ...(typeof p === "function" ? p(estado) : p) };
  ouvintes.forEach((f) => f());
}
const assina = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };
export const usaEstado = (): Estado => useSyncExternalStore(assina, pega);

// Filtros que ficam guardados ao trocar de aba (como no painel antigo)
export const filtros = { tipo: "", busca: "", prova: "", dias: "30" };

// ---------- avisos ----------
let nAviso = 0, timerAviso: ReturnType<typeof setTimeout> | undefined;
export function aviso(msg: string, erro = false, link: [string, () => void] | null = null): void {
  const id = ++nAviso;
  muda({ aviso: { msg, erro, link, id } });
  clearTimeout(timerAviso);
  if (!erro && !link) timerAviso = setTimeout(() => { if (pega().aviso?.id === id) muda({ aviso: null }); }, 8000);
}
export const fechaAviso = () => muda({ aviso: null });
export function falha(e: unknown): void {
  if (e && (e as { silencioso?: boolean }).silencioso) return;
  aviso("Não deu certo: " + ((e as Error)?.message || String(e)), true);
}

// ---------- caixas de diálogo (no lugar do confirm/prompt do navegador) ----------
let nDialogo = 0;
export function abreDialogo<T>(padrao: T, render: (fecha: (v: T) => void) => ReactNode, classe = "painel-dialogo"): Promise<T> {
  return new Promise<T>((resolve) => {
    const d: Dialogo = { id: ++nDialogo, classe, render: render as Dialogo["render"], padrao, resolve: resolve as Dialogo["resolve"] };
    muda((e) => ({ dialogos: [...e.dialogos, d] }));
  });
}
export const tiraDialogo = (id: number) => muda((e) => ({ dialogos: e.dialogos.filter((d) => d.id !== id) }));

// ---------- navegação ----------
export const nav = { sujo: false, rotaAnterior: "", destaque: null as string | null };
export const rotaDoEndereco = () => location.hash.replace(/^#/, "");
export const marcaSujo = () => { nav.sujo = true; };
/** Abre (ou redesenha) a tela da rota: o formulário volta ao que está salvo. */
export function abre(rota: string): void {
  nav.sujo = false;
  muda((e) => ({ rota, versao: e.versao + 1, aba: abaDe(rota) }));
}
const ABA_DO_TIPO: Record<string, string> = { prova: "provas", parceiro: "parceiros", convite: "convites", depoimento: "depoimentos", proposta: "propostas", minutario: "propostas", "modelo-contrato": "propostas" };
const ABAS = ["provas", "parceiros", "convites", "apuracao", "inscricoes", "pagamentos", "avisos", "orcamentos", "propostas", "depoimentos", "medicao"];
/** Partes da rota: "convite/<id>/links?x=1" -> tipo convite, id, extra links, params, aba convites */
export function partesDa(rota: string) {
  const [caminho, busca] = rota.split("?");
  const cam = caminho.split("/").map((x) => { try { return decodeURIComponent(x); } catch (e) { return x; } });
  const tipo = cam[0], aba = ABA_DO_TIPO[tipo] || tipo;
  const valida = ABAS.includes(aba);
  return { tipo: valida ? tipo : "provas", id: cam[1], extra: cam[2], params: new URLSearchParams(busca || ""), aba: valida ? aba : "provas", valida };
}
export const abaDe = (rota: string) => partesDa(rota).aba;
export const redesenha = () => abre(pega().rota);

let perguntaSair: () => Promise<boolean> = () => Promise.resolve(true);
export const definePerguntaSair = (f: () => Promise<boolean>) => { perguntaSair = f; };
export const perguntaSairSemSalvar = () => perguntaSair();

/** Vai para uma tela (entra no histórico do navegador). */
export function ir(rota: string): void {
  if (rota === pega().rota) return redesenha();
  if (!nav.sujo) { location.hash = rota; return; }
  perguntaSair().then((s) => { if (s) { nav.sujo = false; location.hash = rota; } });
}
/** Volta para a lista depois de salvar, cancelar ou excluir (sem deixar o formulário no Voltar). */
export function voltarPara(rota: string): void {
  nav.sujo = false;
  if (nav.rotaAnterior === rota) history.back();
  else location.replace("#" + rota);
}
export function cancelar(rota: string): void {
  if (!nav.sujo) return voltarPara(rota);
  perguntaSair().then((s) => { if (s) voltarPara(rota); });
}
/** Rota inválida ou registro que sumiu: avisa e mostra a lista. */
export function naoAchou(aba: string, msg: string): void {
  aviso(msg, true);
  history.replaceState(null, "", "#" + aba);
  abre(aba);
}

export function telaLogin(msg = ""): void {
  nav.sujo = false;
  muda({ tela: "login", msgTela: msg, dialogos: [] });
}

export function hashchange(): void {
  const nova = rotaDoEndereco();
  const atual = pega().rota;
  if (pega().tela !== "painel" || nova === atual) return;
  if (nav.sujo) {
    // Voltar do navegador com formulário alterado: fica na tela e pergunta
    history.pushState(null, "", "#" + atual);
    perguntaSair().then((s) => { if (s) { nav.sujo = false; location.hash = nova; } });
    return;
  }
  nav.rotaAnterior = atual;
  abre(nova);
}
