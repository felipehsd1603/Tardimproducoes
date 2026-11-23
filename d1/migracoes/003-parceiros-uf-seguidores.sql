-- Rodar UMA vez em banco criado antes de 23/11/2026 (rodar de novo dá erro de coluna duplicada, sem estragar nada):
--   npx wrangler d1 execute tardim --remote --file d1/migracoes/003-parceiros-uf-seguidores.sql
-- Estado (UF) da cidade, escolhida da lista do IBGE no cadastro, e seguidores estimados do influenciador.
ALTER TABLE parceiros ADD COLUMN uf TEXT NOT NULL DEFAULT '';
ALTER TABLE parceiros ADD COLUMN seguidores INTEGER NOT NULL DEFAULT 0;
