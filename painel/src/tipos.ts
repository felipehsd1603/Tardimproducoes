// O que a API do painel (functions/api/admin) devolve. As linhas são as de functions/_lib/tipos.ts,
// já convertidas por functions/_admin/tabelas.ts (saida): campos JSON viram objeto e 0/1 vira boolean.
// Não dá para importar de lá: aquele arquivo usa os tipos do Cloudflare Workers, que não convivem com o DOM.

export interface Valor { nome: string; valor: string; detalhe?: string; esgotado?: boolean; ate?: string }
export interface Kit { itens: string[]; retirada: string }

export interface Prova {
  id: string; nome: string; data: string; hora: string; local: string; percursos: string[]; resumo: string; poster: string;
  inscricao: string; valores: Valor[]; kit: Kit; programacao: [string, string][]; premiacao: string; percurso_mapa: string;
  regulamento: string; resultados: string; fotos: string; realizacao: string; texto_divulgacao: string; hashtags: string;
  faq: [string, string][]; publicada: boolean; criado_em?: string; atualizado_em?: string;
  /** '' automático (Ticket Sports e datas dos lotes) | aberta | esgotado | encerrado; ts_* = última conferência na Ticket Sports */
  inscricoes?: string; ts_situacao?: string; ts_conferido_em?: string; ts_mudou_em?: string; ts_erro?: string;
}

export type TipoParceiro = "embaixador" | "influenciador" | "assessoria" | "equipe";
export interface Parceiro {
  id: string; tipo: TipoParceiro; nome: string; responsavel: string; whatsapp: string; email: string; instagram: string;
  cidade: string; uf: string; seguidores: number; ig_situacao: string; ig_seguidores: number; ig_posts: number; ig_conferido_em: string;
  documento: string; pix: string; observacoes: string; profissao: string; registro: string; registro_situacao: string;
  registro_nome: string; registro_conferido_em: string; logo: string; cor: string; ativo: boolean; situacao: string;
  origem?: string; motivo_recusa: string; criado_em: string; atualizado_em?: string;
}

/** Inscrição coletiva do convite (js/convite.js): d prazo, m limite, i prazo interno, v valor, f faixas, g pagamento, b benefícios, kt kit, pe encontro */
export interface Coletiva { d?: string; m?: number; i?: string; v?: number; f?: [number, number][]; g?: string; b?: string; kt?: string; pe?: string }
export interface Convite {
  id: string; parceiro_id: string; prova_id: string; cupom: string; desconto: string; comissao_pct: number; cortesias: number;
  contrapartida: string; condicoes: string; coletiva: Coletiva | unknown[];
  api_situacao?: string; api_modo_pagamento?: string; api_motivo?: string; api_aviso?: string;
}

export interface Depoimento { id: string; nome: string; cargo: string; texto: string; onde: string; publicado: boolean }

export interface Item { cat: string; desc: string; qtd: number; unit: number; pp?: boolean }
export interface Empresa { razao: string; cnpj: string; endereco: string; rep_nome: string; rep_cargo: string; rep_cpf: string; rep_rg: string }
export interface Contratante { nome: string; cnpj: string; endereco: string; rep_nome: string; rep_cargo: string; rep_cpf: string; rep_rg: string }
export interface DadosContrato {
  numero?: string; empresa?: Partial<Empresa>; contratante?: Partial<Contratante>; pagamento?: string; vigencia?: number;
  anexo2?: boolean; condicoes?: string; arquivo_assinado?: string; link_assinado?: string;
}
export type Etapa = "rascunho" | "enviada" | "aprovada" | "recusada" | "contrato" | "assinado";
export interface DadosProposta {
  data?: string; validade?: string; emitente?: string;
  cliente?: { nome?: string; cnpj?: string; endereco?: string; representante?: string };
  evento?: { nome?: string; data?: string; local?: string; participantes?: number };
  itens?: Item[]; obs?: string;
  sim?: { patrocinio?: number; inscricao?: number; imposto?: number | null; faixas?: string };
  etapa?: Etapa; marcos?: Partial<Record<Etapa, string>>; contrato?: DadosContrato;
}
export interface Proposta { id: string; numero: string; cliente: string; evento: string; dados: DadosProposta }

export interface ItemMinutario { id: string; categoria: string; descricao: string; dados: { unit?: number; qtd?: number; pp?: boolean; base?: number } }

export interface ConfigContrato { empresas?: Empresa[]; foro?: string; modelo?: string }

export interface Orcamento {
  id: number; criado_em: string; canal: string; servico: string; nome: string; contratante: string; empresa: string;
  cidade: string; quando: string; publico: string; detalhes: string;
}
export interface Inscricao {
  id: string; criado_em: string; prova_id: string; prova_nome: string; equipe: string; responsavel: string; telefone: string;
  canal: string; origem: string; modo_pagamento: string; total: number; atletas: number;
}
export interface Atleta {
  id: number; nome: string; cpf: string; nascimento: string; sexo: string; distancia: string; camiseta: string; email: string;
  telefone: string; equipe: string; situacao: string; motivo: string; numero_peito: string; aviso: string;
}
export interface ResumoAviso { prova_id: string; pendentes: number; enviados: number }
export interface LinhaMedicao { evento: string; ref: string; n: number }

export interface Conexao {
  id: string; plataforma_url: string; ambiente: string; situacao: string; erro: string; motivo: string; respondido_por: string;
  integracao_id: string | null; expira_em: string; enviado_em: string; respondido_em: string;
}
export interface Integracao { id: string; nome: string; plataforma_url: string; ambiente: string; usada_em: string; revogada_em: string; criada_em: string }
export interface Integracoes { conexoes: Conexao[]; integracoes: Integracao[]; assinatura: boolean }
export interface AvisoPlataforma { ok: boolean; erro?: string }

export interface Dados { provas: Prova[]; parceiros: Parceiro[]; convites: Convite[]; depoimentos: Depoimento[] | null }

/** Prova do painel (banco) ou do js/eventos.js ("No código") */
export interface ProvaLista { id: string; nome: string; data: string; fonte: "publicada" | "rascunho" | "codigo"; linha?: Prova; obj?: ProvaEventos }
