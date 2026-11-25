-- Rodar UMA vez em banco criado antes de 23/11/2026 (rodar de novo dá erro de coluna duplicada, sem estragar nada):
--   npx wrangler d1 execute tardim --remote --file d1/migracoes/002-contas-parceiros.sql
-- Cadastro dos parceiros pelo site (parceiro.html): situação do cadastro e contas de acesso.
-- Os parceiros que já existem ficam como "aprovado".
ALTER TABLE parceiros ADD COLUMN situacao TEXT NOT NULL DEFAULT 'aprovado';
ALTER TABLE parceiros ADD COLUMN origem TEXT NOT NULL DEFAULT 'painel';
ALTER TABLE parceiros ADD COLUMN motivo_recusa TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS contas (
  id           TEXT PRIMARY KEY,               -- uuid
  parceiro_id  TEXT NOT NULL UNIQUE REFERENCES parceiros(id),
  email        TEXT NOT NULL UNIQUE,           -- sempre em minúsculas
  senha        TEXT NOT NULL DEFAULT '',       -- pbkdf2$iteracoes$sal$hash (vazio = só Google)
  google_sub   TEXT UNIQUE,                    -- id da conta Google (NULL = só senha)
  criado_em    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ultimo_acesso TEXT NOT NULL DEFAULT ''
);
