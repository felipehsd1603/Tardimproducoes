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
  total       INTEGER NOT NULL,
  origem      TEXT NOT NULL DEFAULT 'planilha', -- planilha | api (sistema da assessoria, d1/migracoes/014-envios-api.sql)
  parceiro_id TEXT NOT NULL DEFAULT '',
  modo_pagamento TEXT NOT NULL DEFAULT ''
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
  equipe       TEXT NOT NULL DEFAULT '',
  -- envios pelo sistema da assessoria (API v1); em banco já criado, rode d1/migracoes/014-envios-api.sql
  origem TEXT NOT NULL DEFAULT 'planilha', prova_id TEXT NOT NULL DEFAULT '', parceiro_id TEXT NOT NULL DEFAULT '', id_externo TEXT NOT NULL DEFAULT '',
  percurso_id TEXT NOT NULL DEFAULT '', situacao TEXT NOT NULL DEFAULT '', motivo TEXT NOT NULL DEFAULT '', numero_peito TEXT NOT NULL DEFAULT '',
  modo_pagamento TEXT NOT NULL DEFAULT '', consentimento_em TEXT NOT NULL DEFAULT '', envio_id TEXT NOT NULL DEFAULT '', atualizado_em TEXT NOT NULL DEFAULT '', aviso TEXT NOT NULL DEFAULT ''
);

-- Envios por IP das funções públicas (functions/_limite.js): 10 por rota por hora
CREATE TABLE IF NOT EXISTS envios_tentativas (
  rota   TEXT NOT NULL,                   -- orcamento | inscricao
  ip     TEXT NOT NULL,
  quando INTEGER NOT NULL                 -- epoch em segundos
);
CREATE INDEX IF NOT EXISTS envios_tentativas_ip ON envios_tentativas (rota, ip, quando);

CREATE INDEX IF NOT EXISTS atletas_inscricao ON atletas (inscricao_id);
CREATE INDEX IF NOT EXISTS inscricoes_prova ON inscricoes (prova_id, criado_em);
CREATE UNIQUE INDEX IF NOT EXISTS atletas_externo ON atletas (prova_id, parceiro_id, id_externo) WHERE id_externo <> '';
CREATE INDEX IF NOT EXISTS atletas_envio ON atletas (envio_id);
