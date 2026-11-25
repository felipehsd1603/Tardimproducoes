-- 013-integracoes.sql
-- Rodar UMA vez em banco criado antes de 25/11/2026:
--   npx wrangler d1 execute tardim --remote --file d1/migracoes/013-integracoes.sql
-- (rodar de novo dá erro de "duplicate column" nas últimas linhas, sem estragar nada)
-- API v1 para parceiros (docs/api-v1-parceiros.md): conexões por convite, chaves, envios e limite de uso.

-- Convite de conexão enviado à plataforma da assessoria (JWS assinado pela Tardim).
-- O código de uso único vai no convite; aqui fica só o SHA-256 dele.
CREATE TABLE IF NOT EXISTS conexoes (
  id             TEXT PRIMARY KEY,                 -- cnx_<uuid>
  parceiro_id    TEXT NOT NULL REFERENCES parceiros(id) ON DELETE CASCADE,
  plataforma_url TEXT NOT NULL,                    -- origem da plataforma: https://im3-eventos.vercel.app
  ambiente       TEXT NOT NULL DEFAULT 'live',     -- live | test
  codigo_hash    TEXT NOT NULL,
  situacao       TEXT NOT NULL DEFAULT 'enviando', -- enviando | enviado | falhou | aceito | recusado | cancelado
  erro           TEXT NOT NULL DEFAULT '',         -- por que a entrega falhou
  motivo         TEXT NOT NULL DEFAULT '',         -- motivo da recusa
  respondido_por TEXT NOT NULL DEFAULT '',
  integracao_id  TEXT,                             -- chave criada no aceite
  expira_em      TEXT NOT NULL,
  enviado_em     TEXT NOT NULL DEFAULT '',
  respondido_em  TEXT NOT NULL DEFAULT '',
  criado_em      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX IF NOT EXISTS conexoes_parceiro ON conexoes (parceiro_id);

-- Uma chave por conexão aceita. Guarda só o SHA-256 da chave.
CREATE TABLE IF NOT EXISTS integracoes (
  id              TEXT PRIMARY KEY,                -- uuid
  parceiro_id     TEXT NOT NULL REFERENCES parceiros(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL DEFAULT '',        -- ex.: IM3 (nome que a plataforma informou)
  plataforma_url  TEXT NOT NULL DEFAULT '',
  conexao_id      TEXT,
  ambiente        TEXT NOT NULL DEFAULT 'live',    -- live | test (test enxerga provas ainda não publicadas)
  prefixo         TEXT NOT NULL,                   -- tdm_live_3f9c (para reconhecer a chave)
  hash            TEXT NOT NULL UNIQUE,            -- sha256 hex da chave inteira
  webhook_url     TEXT NOT NULL DEFAULT '',        -- endereço que recebe os avisos (etapa 2)
  webhook_segredo TEXT NOT NULL DEFAULT '',        -- assina os avisos (HMAC-SHA256)
  usada_em        TEXT NOT NULL DEFAULT '',
  revogada_em     TEXT NOT NULL DEFAULT '',        -- vazio = valendo
  criada_em       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX IF NOT EXISTS integracoes_parceiro ON integracoes (parceiro_id);

-- Envios de inscrição coletiva pela API (POST /api/v1/envios, etapa 2).
-- Mesma Idempotency-Key + mesmo corpo = mesma resposta por 7 dias.
CREATE TABLE IF NOT EXISTS envios_api (
  id                 TEXT PRIMARY KEY,             -- env_<uuid>
  integracao_id      TEXT NOT NULL REFERENCES integracoes(id) ON DELETE CASCADE,
  prova_id           TEXT NOT NULL,
  referencia_externa TEXT NOT NULL DEFAULT '',
  idempotency_key    TEXT NOT NULL,
  corpo_hash         TEXT NOT NULL,
  resposta           TEXT NOT NULL DEFAULT '',
  inscricao_id       TEXT,                         -- inscricoes.id gerada por este envio
  criado_em          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE (integracao_id, idempotency_key)
);

-- Limite de uso: chamadas por chave por minuto
CREATE TABLE IF NOT EXISTS api_uso (
  integracao_id TEXT NOT NULL,
  minuto        INTEGER NOT NULL,                  -- epoch / 60
  n             INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (integracao_id, minuto)
);

-- Resposta da assessoria a cada convite de prova, dada na plataforma dela
ALTER TABLE convites ADD COLUMN api_situacao TEXT NOT NULL DEFAULT '';        -- '' | pendente | aceito | recusado
ALTER TABLE convites ADD COLUMN api_modo_pagamento TEXT NOT NULL DEFAULT '';  -- assessoria | ticketsports
ALTER TABLE convites ADD COLUMN api_motivo TEXT NOT NULL DEFAULT '';
ALTER TABLE convites ADD COLUMN api_respondido_em TEXT NOT NULL DEFAULT '';
ALTER TABLE convites ADD COLUMN api_aviso TEXT NOT NULL DEFAULT '';           -- '' | ok | erro: ... (último aviso enviado)
