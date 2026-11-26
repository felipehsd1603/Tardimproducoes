// Variáveis globais dos scripts do site que o painel carrega antes dele (vite.config.mts, arquivosDoSite):
// js/eventos.js (SITE, PROXIMAS), js/convite.js (CONVITE) e js/vendor/xlsx (XLSX).

interface SiteTardim {
  urlBase?: string; razaoSocial?: string; cnpj?: string; cidade?: string; whatsapp?: string; email?: string;
  [k: string]: unknown;
}

/** Prova no formato do js/eventos.js (PROXIMAS). */
interface ProvaEventos {
  esgotado?: boolean; encerrado?: boolean;
  id: string; nome: string; data: string; hora?: string; local?: string; percursos?: string[] | string; resumo?: string;
  poster?: string; inscricao?: string; valores?: { nome: string; valor: string; detalhe?: string; esgotado?: boolean; ate?: string }[];
  kit?: { itens: string[]; retirada: string }; programacao?: [string, string][]; premiacao?: string; percursoMapa?: string;
  regulamento?: string; resultados?: string; fotos?: string; realizacao?: string; textoDivulgacao?: string; hashtags?: string;
  faq?: [string, string][]; demo?: boolean;
}

interface PlanilhaXLSX {
  read(dados: Uint8Array, op: { type: "array"; raw?: boolean }): { SheetNames: string[]; Sheets: Record<string, unknown> };
  writeFile(wb: unknown, nome: string): void;
  utils: {
    sheet_to_json(ws: unknown, op: { header: 1; defval: string; raw: boolean }): unknown[][];
    json_to_sheet(linhas: Record<string, unknown>[]): unknown;
    book_new(): unknown;
    book_append_sheet(wb: unknown, ws: unknown, nome: string): void;
  };
}

// js/eventos.js declara com const: são globais, mas não ficam em window (ler com typeof antes)
declare const SITE: SiteTardim;
declare const PROXIMAS: ProvaEventos[];

interface Window {
  CONVITE?: { gera(dados: Record<string, unknown>): string };
  XLSX?: PlanilhaXLSX;
}
