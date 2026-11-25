-- Rodar UMA vez em banco criado antes de 23/11/2026 (rodar de novo dá erro de coluna duplicada, sem estragar nada):
--   npx wrangler d1 execute tardim --remote --file d1/migracoes/004-parceiros-instagram.sql
-- Dados do Instagram conferidos pela API da Meta (functions/_instagram.js).
ALTER TABLE parceiros ADD COLUMN ig_situacao TEXT NOT NULL DEFAULT '';       -- '' (não conferido) | ok | nao_encontrado
ALTER TABLE parceiros ADD COLUMN ig_seguidores INTEGER NOT NULL DEFAULT 0;
ALTER TABLE parceiros ADD COLUMN ig_posts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE parceiros ADD COLUMN ig_conferido_em TEXT NOT NULL DEFAULT '';
