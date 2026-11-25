-- Rodar UMA vez em banco criado antes de 23/11/2026 (rodar de novo não estraga nada):
--   npx wrangler d1 execute tardim --remote --file d1/migracoes/007-ticketsports.sql
-- Posts da Ticket Sports (Integração > Aplicativos > "Url do post"), guardados crus
-- por functions/api/ticketsports.js até conhecermos o formato.
CREATE TABLE IF NOT EXISTS ticketsports_posts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  recebido_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  metodo      TEXT NOT NULL DEFAULT '',
  tipo        TEXT NOT NULL DEFAULT '',          -- content-type
  cabecalhos  TEXT NOT NULL DEFAULT '{}',        -- JSON, sem cookies/autorização
  consulta    TEXT NOT NULL DEFAULT '',          -- query string sem o token
  corpo       TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ticketsports_posts_data ON ticketsports_posts (recebido_em);
