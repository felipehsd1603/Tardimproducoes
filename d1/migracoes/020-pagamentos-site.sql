-- 020-pagamentos-site.sql
-- Inscrição coletiva paga pelo próprio site (assessorias.html, functions/_lib/pagamento-site.ts), sem a Ticket Sports:
-- a equipe confere a planilha e paga por PIX (API PIX do Banco Central / Banco Inter) ou cartão (Mercado Pago).
-- O preço sai do convite no banco (convites.coletiva: valor por atleta, faixas de desconto, limite; convites.cortesias),
-- nunca do link. Quando o pagamento confirma, o envio entra em inscricoes (canal 'site') e os atletas em atletas.
-- Só aparece no site com a variável PAGAMENTO_SITE = ligado.
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
