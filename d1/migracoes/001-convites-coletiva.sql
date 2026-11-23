-- Rodar UMA vez em banco criado antes de 22/11/2026 (rodar de novo dá erro de coluna duplicada, sem estragar nada):
--   npx wrangler d1 execute tardim --remote --file d1/migracoes/001-convites-coletiva.sql
-- Guarda no convite as condições da inscrição coletiva, que antes só existiam no link gerado em link-assessoria.html.
ALTER TABLE convites ADD COLUMN coletiva TEXT NOT NULL DEFAULT '{}';
