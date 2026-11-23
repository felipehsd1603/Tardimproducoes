-- Banco do site (Cloudflare D1): tabelas do painel (admin.html).
-- Aplicar:  npx wrangler d1 execute tardim --remote --file d1/painel.sql
-- Pode rodar de novo sem perder dados. As tabelas de orçamentos e
-- inscrições coletivas ficam em d1/schema.sql.

-- Provas (viram páginas do site na hora quando publicada = 1)
CREATE TABLE IF NOT EXISTS provas (
  id               TEXT PRIMARY KEY,           -- ex.: corrida-da-lagoa-2027
  nome             TEXT NOT NULL,
  data             TEXT NOT NULL,              -- AAAA-MM-DD
  hora             TEXT NOT NULL DEFAULT '',
  local            TEXT NOT NULL DEFAULT '',
  percursos        TEXT NOT NULL DEFAULT '[]', -- JSON: ["5 km", "10 km"]
  resumo           TEXT NOT NULL DEFAULT '',
  poster           TEXT NOT NULL DEFAULT '',   -- ex.: arquivos/provas/<id>-<t>.jpg
  inscricao        TEXT NOT NULL DEFAULT '',
  valores          TEXT NOT NULL DEFAULT '[]', -- JSON: [{nome, valor, detalhe, esgotado}]
  kit              TEXT NOT NULL DEFAULT '{"itens":[],"retirada":""}',
  programacao      TEXT NOT NULL DEFAULT '[]', -- JSON: [["06h30", "Concentração"]]
  premiacao        TEXT NOT NULL DEFAULT '',
  percurso_mapa    TEXT NOT NULL DEFAULT '',
  regulamento      TEXT NOT NULL DEFAULT '',
  resultados       TEXT NOT NULL DEFAULT '',
  fotos            TEXT NOT NULL DEFAULT '',
  realizacao       TEXT NOT NULL DEFAULT '',
  texto_divulgacao TEXT NOT NULL DEFAULT '',
  hashtags         TEXT NOT NULL DEFAULT '',
  publicada        INTEGER NOT NULL DEFAULT 0,
  criado_em        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  atualizado_em    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Parceiros: embaixadores, influenciadores, assessorias e equipes
CREATE TABLE IF NOT EXISTS parceiros (
  id            TEXT PRIMARY KEY,              -- uuid
  tipo          TEXT NOT NULL,                 -- embaixador | influenciador | assessoria | equipe
  nome          TEXT NOT NULL,
  responsavel   TEXT NOT NULL DEFAULT '',
  whatsapp      TEXT NOT NULL DEFAULT '',
  email         TEXT NOT NULL DEFAULT '',
  instagram     TEXT NOT NULL DEFAULT '',
  cidade        TEXT NOT NULL DEFAULT '',
  documento     TEXT NOT NULL DEFAULT '',      -- CPF ou CNPJ, para o pagamento
  pix           TEXT NOT NULL DEFAULT '',
  observacoes   TEXT NOT NULL DEFAULT '',
  profissao     TEXT NOT NULL DEFAULT '',      -- ex.: Profissional de Educação Física (CREF6/MG)
  registro      TEXT NOT NULL DEFAULT '',      -- registro profissional, ex.: MG-012345 (CREF6)
  registro_situacao     TEXT NOT NULL DEFAULT '',  -- situação devolvida pelo CREF6, ex.: ATIVO
  registro_nome         TEXT NOT NULL DEFAULT '',  -- nome devolvido pelo CREF6
  registro_conferido_em TEXT NOT NULL DEFAULT '',  -- data da conferência automática (vazio = não conferido)
  logo          TEXT NOT NULL DEFAULT '',      -- caminho em arquivos: assessorias/<id>-<t>.png
  cor           TEXT NOT NULL DEFAULT '',      -- "rrggbb"
  ativo         INTEGER NOT NULL DEFAULT 1,
  criado_em     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  atualizado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Convites: um parceiro numa prova, com o cupom criado na Ticket Sports
-- (prova_id pode ser de uma prova do painel ou do js/eventos.js)
CREATE TABLE IF NOT EXISTS convites (
  id            TEXT PRIMARY KEY,              -- uuid
  parceiro_id   TEXT NOT NULL REFERENCES parceiros(id) ON DELETE CASCADE,
  prova_id      TEXT NOT NULL,
  cupom         TEXT NOT NULL,                 -- A-Z 0-9 _ -
  desconto      TEXT NOT NULL DEFAULT '',
  comissao_pct  REAL NOT NULL DEFAULT 0,
  cortesias     INTEGER NOT NULL DEFAULT 0,
  contrapartida TEXT NOT NULL DEFAULT '',
  condicoes     TEXT NOT NULL DEFAULT '',
  criado_em     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  atualizado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE (prova_id, cupom)
);
CREATE INDEX IF NOT EXISTS convites_prova ON convites (prova_id);
CREATE INDEX IF NOT EXISTS convites_parceiro ON convites (parceiro_id);

-- Tentativas de login erradas no painel (bloqueio por IP: 5 erros em 15 min)
CREATE TABLE IF NOT EXISTS login_erros (
  ip        TEXT NOT NULL,
  quando    INTEGER NOT NULL                   -- epoch em segundos
);
CREATE INDEX IF NOT EXISTS login_erros_ip ON login_erros (ip, quando);

-- Busca de parceiro pelo registro profissional
CREATE INDEX IF NOT EXISTS parceiros_registro ON parceiros (registro);

-- Imagens enviadas pelo painel (artes das provas e logos das equipes),
-- servidas em /arquivos/<caminho>. Cada envio tem nome novo.
CREATE TABLE IF NOT EXISTS arquivos (
  caminho   TEXT PRIMARY KEY,                  -- ex.: provas/<id>-<t>.jpg
  tipo      TEXT NOT NULL,                     -- image/jpeg, image/png, image/webp
  tamanho   INTEGER NOT NULL,
  dados     BLOB NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
