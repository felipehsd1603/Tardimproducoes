-- 014-envios-api.sql
-- Rodar UMA vez em banco criado antes de 25/11/2026, depois da 013:
--   npx wrangler d1 execute tardim --remote --file d1/migracoes/014-envios-api.sql
-- (rodar de novo dá erro de "duplicate column", sem estragar nada)
-- Inscrição coletiva enviada pelo sistema da assessoria (POST /api/v1/envios, docs/api-v1-parceiros.md):
-- cada atleta guarda de onde veio, o código dele na plataforma e a situação da inscrição oficial.

ALTER TABLE inscricoes ADD COLUMN origem TEXT NOT NULL DEFAULT 'planilha';   -- planilha | api
ALTER TABLE inscricoes ADD COLUMN parceiro_id TEXT NOT NULL DEFAULT '';      -- assessoria (envios pela API)
ALTER TABLE inscricoes ADD COLUMN modo_pagamento TEXT NOT NULL DEFAULT '';   -- assessoria | ticketsports

ALTER TABLE atletas ADD COLUMN origem TEXT NOT NULL DEFAULT 'planilha';      -- planilha | api
ALTER TABLE atletas ADD COLUMN prova_id TEXT NOT NULL DEFAULT '';
ALTER TABLE atletas ADD COLUMN parceiro_id TEXT NOT NULL DEFAULT '';
ALTER TABLE atletas ADD COLUMN id_externo TEXT NOT NULL DEFAULT '';          -- código do atleta na plataforma
ALTER TABLE atletas ADD COLUMN percurso_id TEXT NOT NULL DEFAULT '';
ALTER TABLE atletas ADD COLUMN situacao TEXT NOT NULL DEFAULT '';            -- recebido | aguardando_pagamento | inscrito | recusado | cancelado
ALTER TABLE atletas ADD COLUMN motivo TEXT NOT NULL DEFAULT '';
ALTER TABLE atletas ADD COLUMN numero_peito TEXT NOT NULL DEFAULT '';
ALTER TABLE atletas ADD COLUMN modo_pagamento TEXT NOT NULL DEFAULT '';
ALTER TABLE atletas ADD COLUMN consentimento_em TEXT NOT NULL DEFAULT '';
ALTER TABLE atletas ADD COLUMN envio_id TEXT NOT NULL DEFAULT '';            -- último envio que mexeu no atleta
ALTER TABLE atletas ADD COLUMN atualizado_em TEXT NOT NULL DEFAULT '';
ALTER TABLE atletas ADD COLUMN aviso TEXT NOT NULL DEFAULT '';               -- '' | ok | erro: ... (último atleta.situacao)

CREATE UNIQUE INDEX IF NOT EXISTS atletas_externo ON atletas (prova_id, parceiro_id, id_externo) WHERE id_externo <> '';
CREATE INDEX IF NOT EXISTS atletas_envio ON atletas (envio_id);
