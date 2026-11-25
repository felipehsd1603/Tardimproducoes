-- 015-fila-avisos.sql (aplicada por `npm run db:migracoes:producao`)
-- Avisos às plataformas (webhooks) que falharam: novas tentativas em 1 min, 5 min, 30 min, 2 h, 6 h e 24 h.
-- O mesmo id de entrega é reenviado (x-tardim-entrega), para a plataforma não processar duas vezes.

CREATE TABLE IF NOT EXISTS avisos_fila (
  id            TEXT PRIMARY KEY,                -- ent_<uuid> (x-tardim-entrega)
  integracao_id TEXT NOT NULL,
  evento        TEXT NOT NULL,
  corpo         TEXT NOT NULL,                   -- JSON exatamente como enviado (id, evento, criado_em, dados)
  tentativas    INTEGER NOT NULL DEFAULT 1,
  proxima_em    TEXT NOT NULL,                   -- quando tentar de novo (UTC)
  ultimo_erro   TEXT NOT NULL DEFAULT '',
  entregue_em   TEXT NOT NULL DEFAULT '',
  desistido_em  TEXT NOT NULL DEFAULT '',        -- passou das 6 novas tentativas ou a conexão acabou
  criado_em     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX IF NOT EXISTS avisos_fila_pendentes ON avisos_fila (proxima_em) WHERE entregue_em = '' AND desistido_em = '';
