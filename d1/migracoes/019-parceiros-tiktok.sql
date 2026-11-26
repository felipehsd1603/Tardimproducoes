-- 019-parceiros-tiktok.sql
-- TikTok do influenciador, conectado por ele mesmo na área do parceiro (Login Kit, functions/_lib/tiktok.ts).
--   tiktok           @ (username) da conta conectada
--   tt_situacao      '' (nunca conectou) | conectado | desconectado (o parceiro tirou ou revogou no TikTok)
--   tt_*             números da última conferência
ALTER TABLE parceiros ADD COLUMN tiktok TEXT NOT NULL DEFAULT '';
ALTER TABLE parceiros ADD COLUMN tt_situacao TEXT NOT NULL DEFAULT '';
ALTER TABLE parceiros ADD COLUMN tt_seguidores INTEGER NOT NULL DEFAULT 0;
ALTER TABLE parceiros ADD COLUMN tt_curtidas INTEGER NOT NULL DEFAULT 0;
ALTER TABLE parceiros ADD COLUMN tt_videos INTEGER NOT NULL DEFAULT 0;
ALTER TABLE parceiros ADD COLUMN tt_conferido_em TEXT NOT NULL DEFAULT '';

-- Tokens da conta conectada, cifrados (AES-GCM, segredo TIKTOK_CHAVE). Fora da tabela parceiros
-- para nunca irem junto nas listas do painel.
CREATE TABLE IF NOT EXISTS tiktok_contas (
  parceiro_id   TEXT PRIMARY KEY REFERENCES parceiros(id) ON DELETE CASCADE,
  open_id       TEXT NOT NULL,
  tokens        TEXT NOT NULL,                 -- { acesso, renovacao } cifrado
  acesso_expira INTEGER NOT NULL DEFAULT 0,    -- epoch (s)
  renova_expira INTEGER NOT NULL DEFAULT 0,    -- epoch (s)
  escopos       TEXT NOT NULL DEFAULT '',
  conectado_em  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
