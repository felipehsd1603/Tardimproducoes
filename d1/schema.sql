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
  canal       TEXT NOT NULL,              -- whatsapp | email | api | site (pago pelo site, d1/migracoes/020)
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

-- Envios por IP das funções públicas (functions/_lib/limite.js): 10 por rota por hora
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

-- Inscrição coletiva paga pelo site (assessorias.html, functions/_lib/pagamento-site.ts); em banco já criado, rode d1/migracoes/020-pagamentos-site.sql
CREATE TABLE IF NOT EXISTS pagamentos_site (
  id             TEXT PRIMARY KEY,                   -- uuid (também é o id da linha em inscricoes depois de pago)
  codigo_hash    TEXT NOT NULL,                      -- SHA-256 do código com que a equipe acompanha o pagamento
  convite_id     TEXT NOT NULL,
  parceiro_id    TEXT NOT NULL,
  cupom          TEXT NOT NULL DEFAULT '',
  prova_id       TEXT NOT NULL,
  prova_nome     TEXT NOT NULL DEFAULT '',
  prova_data     TEXT NOT NULL DEFAULT '',
  equipe         TEXT NOT NULL,
  responsavel    TEXT NOT NULL DEFAULT '',
  telefone       TEXT NOT NULL DEFAULT '',
  email          TEXT NOT NULL DEFAULT '',
  atletas_json   TEXT NOT NULL DEFAULT '[]',         -- atletas da planilha conferida (entram em atletas quando o pagamento confirma)
  atletas_hash   TEXT NOT NULL DEFAULT '',
  n_atletas      INTEGER NOT NULL DEFAULT 0,
  cortesias      INTEGER NOT NULL DEFAULT 0,         -- inscrições grátis do convite usadas neste pedido
  valor_atleta   INTEGER NOT NULL DEFAULT 0,         -- centavos: valor combinado por atleta (convites.coletiva.v)
  desconto_pct   REAL NOT NULL DEFAULT 0,            -- faixa de desconto por volume
  valor_unit     INTEGER NOT NULL DEFAULT 0,         -- centavos: por atleta pagante, já com o desconto
  valor_cheio    INTEGER NOT NULL DEFAULT 0,         -- centavos: atletas x valor por atleta
  desconto       INTEGER NOT NULL DEFAULT 0,         -- centavos: cortesias + desconto por volume
  acrescimo      INTEGER NOT NULL DEFAULT 0,         -- centavos: taxa do cartão repassada à equipe
  valor          INTEGER NOT NULL DEFAULT 0,         -- centavos: o que a equipe paga
  valor_pago     INTEGER NOT NULL DEFAULT 0,         -- centavos: o que o banco ou o Mercado Pago confirmou
  forma          TEXT NOT NULL DEFAULT 'pix',        -- pix | cartao
  situacao       TEXT NOT NULL DEFAULT 'aguardando', -- aguardando | pago | cortesia | expirado | cancelado
  txid           TEXT NOT NULL DEFAULT '',           -- cobrança PIX no banco
  pix_copia_cola TEXT NOT NULL DEFAULT '',
  e2e_id         TEXT NOT NULL DEFAULT '',           -- identificador do PIX recebido
  mp_preferencia TEXT NOT NULL DEFAULT '',           -- checkout do Mercado Pago
  checkout_url   TEXT NOT NULL DEFAULT '',
  mp_pagamento   TEXT NOT NULL DEFAULT '',           -- id do pagamento aprovado no Mercado Pago
  expira_em      TEXT NOT NULL DEFAULT '',
  pago_em        TEXT NOT NULL DEFAULT '',
  conferido_em   TEXT NOT NULL DEFAULT '',           -- última consulta ao banco ou ao Mercado Pago
  registrado_em  TEXT NOT NULL DEFAULT '',           -- quando os atletas entraram em inscricoes/atletas
  aviso_email    TEXT NOT NULL DEFAULT '',           -- '' | ok | erro: ... (e-mail de confirmação)
  criado_em      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX IF NOT EXISTS pagamentos_site_convite ON pagamentos_site (convite_id, situacao);
CREATE INDEX IF NOT EXISTS pagamentos_site_prova ON pagamentos_site (prova_id, criado_em);
CREATE INDEX IF NOT EXISTS pagamentos_site_aguardando ON pagamentos_site (situacao, conferido_em);
CREATE UNIQUE INDEX IF NOT EXISTS pagamentos_site_txid ON pagamentos_site (txid) WHERE txid <> '';
