// Dados do site lidos no build, do mesmo jeito que o antigo scripts/gerar-paginas.js:
// js/eventos.js (SITE, PROXIMAS) e js/realizadas.js (REALIZADAS) rodam num contexto isolado do Node.
// As provas do painel não passam por aqui: ficam no D1 e o functions/_middleware.ts serve na hora.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createContext, runInContext } from "node:vm";

export interface Prova {
  id?: string;
  nome: string;
  data?: string;
  local?: string;
  percursos?: string[] | string;
  poster?: string;
  demo?: boolean;
}

export interface Trabalho {
  id?: string;
  nome: string;
  descricao?: string;
  cliente?: string;
  local?: string;
  ano?: string | number;
  capa?: string;
  logo?: string;
  demo?: boolean;
}

interface Contexto {
  SITE?: { urlBase?: string };
  PROXIMAS?: Prova[];
  REALIZADAS?: Trabalho[];
}

// O build roda na raiz do repositório (npm run site:build)
export const RAIZ = process.cwd();
const ler = (f: string): string => readFileSync(join(RAIZ, f), "utf8");

const ctx: Contexto = {};
createContext(ctx);
runInContext(ler("js/eventos.js") + "\n" + ler("js/realizadas.js") + "\n;this.SITE=SITE;this.PROXIMAS=PROXIMAS;this.REALIZADAS=REALIZADAS;", ctx);

/** Endereço do site com barra no fim (SITE.urlBase do js/eventos.js) */
export const BASE = (ctx.SITE?.urlBase || "").replace(/\/?$/, "/");
/** Só o caminho do endereço (a 404 usa como <base>) */
export const BASE_PATH = BASE.replace(/^https?:\/\/[^/]+/, "") || "/";

/** Provas do js/eventos.js que ganham página própria (prova-<id>.html) */
export const PROVAS: Prova[] = (ctx.PROXIMAS || []).filter((ev) => ev.id && !ev.demo);
/** Trabalhos do js/realizadas.js que ganham página própria (trabalho-<id>.html) */
export const TRABALHOS: Trabalho[] = (ctx.REALIZADAS || []).filter((tr) => tr.id && !tr.demo);

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const dataBR = (iso: string): string => {
  const p = iso.split("-").map(Number);
  return p[2] + " de " + MESES[p[1] - 1] + " de " + p[0];
};

/** Mesmo escape do gerador antigo (texto e atributos) */
export const esc = (s: unknown): string =>
  String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Imagem da prévia: prefere JPG/PNG ao WebP (o WhatsApp lê melhor) */
export function imagemPrevia(img?: string): string {
  if (!img) return BASE + "assets/compartilhar.jpg";
  if (/^https?:\/\//.test(img)) return img;
  const semExt = img.replace(/\.(webp|jpg|jpeg|png)$/i, "");
  for (const ext of [".jpg", ".png", ".jpeg"]) {
    if (existsSync(join(RAIZ, semExt + ext))) return BASE + semExt + ext;
  }
  return BASE + img;
}

/** Descrição da página de uma prova (a mesma que o middleware usa nas provas do painel) */
export function descricaoProva(ev: Prova): string {
  const percursos = Array.isArray(ev.percursos) ? ev.percursos.join(", ") : ev.percursos || "";
  return [ev.data ? dataBR(ev.data) : "", ev.local, percursos].filter(Boolean).join(" · ") + ". Inscrições e informações da prova.";
}

/** Descrição da página de um trabalho do portfólio */
export function descricaoTrabalho(tr: Trabalho): string {
  return tr.descricao || [tr.cliente, tr.local, tr.ano].filter(Boolean).join(" · ") || "Trabalho realizado pela Tardim Produções.";
}
