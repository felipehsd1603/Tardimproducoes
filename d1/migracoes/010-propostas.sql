-- Rodar UMA vez em banco criado antes de 24/11/2026 (rodar de novo não estraga nada):
--   npx wrangler d1 execute tardim --remote --file d1/migracoes/010-propostas.sql
-- Propostas comerciais montadas no painel (aba Propostas): itens, somas e impressão em PDF.
CREATE TABLE IF NOT EXISTS propostas (
  id            TEXT PRIMARY KEY,              -- uuid
  numero        TEXT NOT NULL DEFAULT '',      -- ex.: 69
  cliente       TEXT NOT NULL,
  evento        TEXT NOT NULL DEFAULT '',
  dados         TEXT NOT NULL DEFAULT '{}',    -- JSON: datas, cliente, evento, itens [{cat, desc, qtd, unit}], observações
  criado_em     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  atualizado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
