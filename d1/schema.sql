-- Banco do site (Cloudflare D1): pedidos de orçamento e inscrições coletivas.
-- Aplicar:  npx wrangler d1 execute tardim --remote --file d1/schema.sql
-- Pode rodar de novo sem perder dados.

CREATE TABLE IF NOT EXISTS orcamentos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  criado_em   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  canal       TEXT NOT NULL,              -- whatsapp | email
  servico     TEXT NOT NULL,
  nome        TEXT NOT NULL,
  contratante TEXT NOT NULL DEFAULT '',
  empresa     TEXT NOT NULL DEFAULT '',
  cidade      TEXT NOT NULL,
  quando      TEXT NOT NULL DEFAULT '',
  publico     TEXT NOT NULL DEFAULT '',
  detalhes    TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS inscricoes (
  id          TEXT PRIMARY KEY,           -- uuid gerado pela função
  criado_em   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  canal       TEXT NOT NULL,              -- whatsapp | email
  prova_id    TEXT NOT NULL,
  prova_nome  TEXT NOT NULL,
  convite     TEXT NOT NULL DEFAULT '',
  equipe      TEXT NOT NULL,
  responsavel TEXT NOT NULL DEFAULT '',
  telefone    TEXT NOT NULL DEFAULT '',
  total       INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS atletas (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  inscricao_id TEXT NOT NULL REFERENCES inscricoes(id) ON DELETE CASCADE,
  nome         TEXT NOT NULL,
  cpf          TEXT NOT NULL,
  nascimento   TEXT NOT NULL,
  sexo         TEXT NOT NULL,
  distancia    TEXT NOT NULL,
  camiseta     TEXT NOT NULL,
  email        TEXT NOT NULL,
  telefone     TEXT NOT NULL,
  equipe       TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS atletas_inscricao ON atletas (inscricao_id);
CREATE INDEX IF NOT EXISTS inscricoes_prova ON inscricoes (prova_id, criado_em);
