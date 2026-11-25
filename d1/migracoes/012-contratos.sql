-- Rodar UMA vez em banco criado antes de 24/11/2026 (rodar de novo não estraga nada):
--   npx wrangler d1 execute tardim --remote --file d1/migracoes/012-contratos.sql
-- Do orçamento ao contrato assinado (aba Propostas). A etapa de cada proposta fica no próprio
-- "dados" da proposta; aqui ficam só o que é da empresa e o PDF assinado.

-- Configurações do painel. Chave "contrato" = JSON { empresas: [...], foro, modelo }
CREATE TABLE IF NOT EXISTS configuracoes (
  chave         TEXT PRIMARY KEY,
  valor         TEXT NOT NULL DEFAULT '{}',
  atualizado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- PDF do contrato assinado, um por proposta. Fica fora da tabela arquivos de propósito:
-- aquela é servida em /arquivos sem login; esta só sai pela API do painel.
CREATE TABLE IF NOT EXISTS contratos_assinados (
  proposta_id TEXT PRIMARY KEY,
  nome        TEXT NOT NULL DEFAULT '',
  tamanho     INTEGER NOT NULL DEFAULT 0,
  dados       BLOB NOT NULL,
  enviado_em  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
