-- Rodar UMA vez em banco criado antes de 24/11/2026 (rodar de novo não estraga nada):
--   npx wrangler d1 execute tardim --remote --file d1/migracoes/008-depoimentos.sql
-- Depoimentos cadastrados no painel (aba Depoimentos), mostrados no site
-- pelo js/provas-db.js (functions/_middleware.js) e js/ui.js.
CREATE TABLE IF NOT EXISTS depoimentos (
  id            TEXT PRIMARY KEY,              -- uuid
  nome          TEXT NOT NULL,                 -- quem falou
  cargo         TEXT NOT NULL DEFAULT '',      -- cargo e instituição, ex.: Diretora de eventos · CREA-MG
  texto         TEXT NOT NULL,
  onde          TEXT NOT NULL DEFAULT 'empresas', -- empresas | inicio | ambas
  publicado     INTEGER NOT NULL DEFAULT 1,
  criado_em     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  atualizado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
