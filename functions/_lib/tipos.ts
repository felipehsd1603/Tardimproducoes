// Tipos compartilhados pelas Functions: ligações e segredos do projeto (Env) e as linhas das tabelas do D1
// (d1/schema.sql + d1/painel.sql). Só tipos: nada daqui existe em tempo de execução.

/** Ligações (wrangler.toml) e segredos do projeto Cloudflare Pages (docs/arquitetura.md, "Segredos"). */
export interface Env {
  /** Banco D1 `tardim`. As rotas ainda conferem `!env.DB` (projeto sem a ligação responde 503). */
  DB: D1Database;
  /** Arquivos estáticos do Pages (o middleware lê prova.html daqui). */
  ASSETS: Fetcher;

  // Painel e área do parceiro
  ADMIN_SENHA?: string;
  SESSAO_SEGREDO?: string;
  GOOGLE_CLIENT_ID?: string;

  // API v1: chave privada ES256 (JWK) que assina os convites de conexão
  TARDIM_ASSINATURA_JWK?: string;

  // E-mails (Resend)
  RESEND_API_KEY?: string;
  AVISO_EMAIL?: string;
  AVISO_REMETENTE?: string;

  // Instagram (Business Discovery)
  IG_USER_ID?: string;
  IG_TOKEN?: string;

  // Ticket Sports ("Url do post")
  TICKETSPORTS_TOKEN?: string;
  TICKETSPORTS_CHAVE?: string;
}

/** Contexto de uma Function do Pages com o Env do projeto. */
export type Contexto<P extends string = any> = EventContext<Env, P, Record<string, unknown>>;

/** Objeto JSON qualquer vindo de fora (corpo de requisição, resposta de API externa). */
export type Dados = Record<string, any>;

// ---------- linhas das tabelas ----------

export interface Prova {
  id: string; nome: string; data: string; hora: string; local: string;
  percursos: string; resumo: string; poster: string; inscricao: string; valores: string; kit: string; programacao: string;
  premiacao: string; percurso_mapa: string; regulamento: string; resultados: string; fotos: string; realizacao: string;
  texto_divulgacao: string; hashtags: string; faq: string;
  publicada: number; criado_em: string; atualizado_em: string;
}

export interface Parceiro {
  id: string; tipo: string; nome: string; responsavel: string; whatsapp: string; email: string; instagram: string;
  cidade: string; uf: string; seguidores: number; ig_situacao: string; ig_seguidores: number; ig_posts: number; ig_conferido_em: string;
  documento: string; pix: string; observacoes: string; profissao: string; registro: string; registro_situacao: string;
  registro_nome: string; registro_conferido_em: string; logo: string; cor: string; ativo: number; situacao: string;
  origem: string; motivo_recusa: string; conta_id: string | null; criado_em: string; atualizado_em: string;
}

export interface Convite {
  id: string; parceiro_id: string; prova_id: string; cupom: string; desconto: string; comissao_pct: number; cortesias: number;
  contrapartida: string; condicoes: string; coletiva: string;
  api_situacao: string; api_modo_pagamento: string; api_motivo: string; api_respondido_em: string; api_aviso: string;
  criado_em: string; atualizado_em: string;
}

export interface Conta {
  id: string; parceiro_id: string; email: string; senha: string; google_sub: string | null; criado_em: string; ultimo_acesso: string;
}

export interface Atleta {
  id: number; inscricao_id: string; nome: string; cpf: string; nascimento: string; sexo: string; distancia: string;
  camiseta: string; email: string; telefone: string; equipe: string; origem: string; prova_id: string; parceiro_id: string;
  id_externo: string; percurso_id: string; situacao: string; motivo: string; numero_peito: string; modo_pagamento: string;
  consentimento_em: string; envio_id: string; atualizado_em: string; aviso: string;
}

export interface Conexao {
  id: string; parceiro_id: string; plataforma_url: string; ambiente: string; codigo_hash: string; situacao: string;
  erro: string; motivo: string; respondido_por: string; integracao_id: string | null; expira_em: string;
  enviado_em: string; respondido_em: string; criado_em: string;
}

export interface Integracao {
  id: string; parceiro_id: string; nome: string; plataforma_url: string; conexao_id: string | null; ambiente: string;
  prefixo: string; hash: string; webhook_url: string; webhook_segredo: string; usada_em: string; revogada_em: string; criada_em: string;
}

/** Integração com os dados da assessoria (autenticação da API v1). */
export interface IntegracaoComParceiro extends Integracao {
  p_nome: string; p_tipo?: string; p_situacao?: string; p_ativo?: number; p_cidade?: string; p_uf?: string; p_logo?: string;
}

export interface EnvioApi {
  id: string; integracao_id: string; prova_id: string; referencia_externa: string; idempotency_key: string;
  corpo_hash: string; resposta: string; inscricao_id: string | null; criado_em: string;
}

export interface AvisoFila {
  id: string; integracao_id: string; evento: string; corpo: string; tentativas: number; proxima_em: string;
  ultimo_erro: string; entregue_em: string; desistido_em: string; criado_em: string;
}

/** Contagem (SELECT COUNT(*) AS n ...). */
export interface Contagem { n: number }

/** O que as rotas usam do contexto do Pages para trabalho depois da resposta. */
export interface ComEspera { waitUntil(promessa: Promise<unknown>): void }
