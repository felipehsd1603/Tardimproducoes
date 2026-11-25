-- Rodar UMA vez em banco criado antes de 23/11/2026 (rodar de novo não estraga nada):
--   npx wrangler d1 execute tardim --remote --file d1/migracoes/006-avisos.sql
-- Pedidos de "Me avise quando as inscrições abrirem" (functions/api/aviso.js);
-- o painel envia o e-mail quando a prova ganha o link da Ticket Sports.
CREATE TABLE IF NOT EXISTS avisos (
  id         TEXT PRIMARY KEY,                 -- uuid (também serve para cancelar o aviso)
  prova_id   TEXT NOT NULL,
  nome       TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL,                    -- sempre em minúsculas
  criado_em  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  enviado_em TEXT NOT NULL DEFAULT '',         -- vazio = ainda não avisado
  UNIQUE (prova_id, email)
);
CREATE INDEX IF NOT EXISTS avisos_prova ON avisos (prova_id, enviado_em);
