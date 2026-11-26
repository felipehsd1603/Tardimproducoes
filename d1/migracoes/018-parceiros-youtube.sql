-- 018-parceiros-youtube.sql
-- Canal do YouTube do parceiro, conferido pela YouTube Data API v3 (functions/_lib/youtube.ts).
--   youtube          "@canal" ou id "UC..." (aceita também o link do canal no cadastro)
--   yt_situacao      '' (não conferido) | ok | oculto (canal achado, inscritos escondidos) | nao_encontrado
ALTER TABLE parceiros ADD COLUMN youtube TEXT NOT NULL DEFAULT '';
ALTER TABLE parceiros ADD COLUMN yt_situacao TEXT NOT NULL DEFAULT '';
ALTER TABLE parceiros ADD COLUMN yt_inscritos INTEGER NOT NULL DEFAULT 0;
ALTER TABLE parceiros ADD COLUMN yt_videos INTEGER NOT NULL DEFAULT 0;
ALTER TABLE parceiros ADD COLUMN yt_views INTEGER NOT NULL DEFAULT 0;
ALTER TABLE parceiros ADD COLUMN yt_conferido_em TEXT NOT NULL DEFAULT '';
