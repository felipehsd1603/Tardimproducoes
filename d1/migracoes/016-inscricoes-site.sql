-- Inscrição direta no site da Tardim (quem vem pelo link de embaixador ou influenciador, e o próprio parceiro),
-- com pagamento por PIX (API PIX padrão do Banco Central; functions/_lib/pix.js).

-- Configuração por prova (painel > Provas > Inscrição no site):
-- { aberta, modalidades: ["5 km", ...], camisetas: ["P", ...], lotes: [{ nome, valor (reais), ate (AAAA-MM-DD), vagas }],
--   cartao: { ativo, acrescimo_pct (taxa repassada ao atleta), parcelas (máximo) } }
ALTER TABLE provas ADD COLUMN inscricao_site TEXT NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS inscricoes_site (
  id             TEXT PRIMARY KEY,                 -- uuid
  codigo_hash    TEXT NOT NULL,                    -- SHA-256 do código que a pessoa usa para acompanhar a inscrição
  prova_id       TEXT NOT NULL,
  convite_id     TEXT NOT NULL DEFAULT '',
  parceiro_id    TEXT NOT NULL DEFAULT '',
  cupom          TEXT NOT NULL DEFAULT '',
  origem         TEXT NOT NULL DEFAULT 'link',     -- link (pelo link do parceiro) | parceiro (feita na área do parceiro)
  nome           TEXT NOT NULL,
  cpf            TEXT NOT NULL,
  email          TEXT NOT NULL,
  telefone       TEXT NOT NULL DEFAULT '',
  nascimento     TEXT NOT NULL DEFAULT '',         -- AAAA-MM-DD
  sexo           TEXT NOT NULL DEFAULT '',
  camiseta       TEXT NOT NULL DEFAULT '',
  modalidade     TEXT NOT NULL DEFAULT '',
  lote           TEXT NOT NULL DEFAULT '',
  valor_cheio    INTEGER NOT NULL DEFAULT 0,       -- centavos
  desconto       INTEGER NOT NULL DEFAULT 0,       -- centavos
  valor          INTEGER NOT NULL DEFAULT 0,       -- centavos (o que a pessoa paga)
  situacao       TEXT NOT NULL DEFAULT 'aguardando', -- aguardando | pago | cortesia | expirado | cancelado
  forma          TEXT NOT NULL DEFAULT 'pix',      -- pix | cartao (Mercado Pago, functions/_lib/mercadopago.js)
  acrescimo      INTEGER NOT NULL DEFAULT 0,       -- centavos: taxa do cartão repassada ao atleta
  mp_preferencia TEXT NOT NULL DEFAULT '',         -- checkout do Mercado Pago (cartão)
  checkout_url   TEXT NOT NULL DEFAULT '',
  mp_pagamento   TEXT NOT NULL DEFAULT '',         -- id do pagamento aprovado no Mercado Pago
  txid           TEXT NOT NULL DEFAULT '',         -- cobrança PIX no banco
  pix_copia_cola TEXT NOT NULL DEFAULT '',
  e2e_id         TEXT NOT NULL DEFAULT '',         -- identificador do PIX recebido
  expira_em      TEXT NOT NULL DEFAULT '',
  pago_em        TEXT NOT NULL DEFAULT '',
  conferido_em   TEXT NOT NULL DEFAULT '',         -- última consulta da cobrança no banco
  aviso_email    TEXT NOT NULL DEFAULT '',         -- '' | ok | erro: ... (e-mail de confirmação)
  criado_em      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX IF NOT EXISTS inscricoes_site_prova ON inscricoes_site (prova_id, situacao);
CREATE INDEX IF NOT EXISTS inscricoes_site_parceiro ON inscricoes_site (parceiro_id, situacao);
CREATE INDEX IF NOT EXISTS inscricoes_site_aguardando ON inscricoes_site (situacao, conferido_em);
CREATE UNIQUE INDEX IF NOT EXISTS inscricoes_site_txid ON inscricoes_site (txid) WHERE txid <> '';
