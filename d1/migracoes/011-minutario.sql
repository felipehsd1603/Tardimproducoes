-- Rodar UMA vez em banco criado antes de 24/11/2026 (rodar de novo não estraga nada):
--   npx wrangler d1 execute tardim --remote --file d1/migracoes/011-minutario.sql
-- Minutário: itens padrão das propostas (descrição, valor unitário e quantidade de referência).
CREATE TABLE IF NOT EXISTS minutario (
  id            TEXT PRIMARY KEY,              -- uuid
  categoria     TEXT NOT NULL DEFAULT '',      -- ex.: Estrutura do evento
  descricao     TEXT NOT NULL,
  dados         TEXT NOT NULL DEFAULT '{}',    -- JSON: { unit, qtd, pp (variável), base (participantes da quantidade de referência) }
  criado_em     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  atualizado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
