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
  faq              TEXT NOT NULL DEFAULT '[]', -- JSON: [["pergunta", "resposta"]]; em banco já criado, rode d1/migracoes/009-medicao-faq.sql
  publicada        INTEGER NOT NULL DEFAULT 0,
  -- Situação das inscrições (d1/migracoes/017-inscricoes-fechadas.sql): painel '' (automático) | aberta | esgotado | encerrado,
  -- e o que a conferência na Ticket Sports leu (functions/_lib/ticketsports-situacao.js)
  inscricoes       TEXT NOT NULL DEFAULT '',
  ts_situacao      TEXT NOT NULL DEFAULT '',
  ts_conferido_em  TEXT NOT NULL DEFAULT '',
  ts_mudou_em      TEXT NOT NULL DEFAULT '',
  ts_erro          TEXT NOT NULL DEFAULT '',
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
  cidade        TEXT NOT NULL DEFAULT '',      -- nome do município como no IBGE (functions/_lib/cidades.js)
  uf            TEXT NOT NULL DEFAULT '',      -- sigla do estado
  seguidores    INTEGER NOT NULL DEFAULT 0,    -- influenciador: seguidores estimados
  ig_situacao   TEXT NOT NULL DEFAULT '',      -- Instagram conferido pela API (functions/_lib/instagram.js): '' | ok | nao_encontrado
  ig_seguidores INTEGER NOT NULL DEFAULT 0,    -- seguidores reais na última conferência
  ig_posts      INTEGER NOT NULL DEFAULT 0,
  ig_conferido_em TEXT NOT NULL DEFAULT '',
  youtube       TEXT NOT NULL DEFAULT '',      -- "@canal" ou "UC..."
  yt_situacao   TEXT NOT NULL DEFAULT '',      -- YouTube conferido pela API (functions/_lib/youtube.ts): '' | ok | oculto | nao_encontrado
  yt_inscritos  INTEGER NOT NULL DEFAULT 0,
  yt_videos     INTEGER NOT NULL DEFAULT 0,
  yt_views      INTEGER NOT NULL DEFAULT 0,
  yt_conferido_em TEXT NOT NULL DEFAULT '',
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
  situacao      TEXT NOT NULL DEFAULT 'aprovado', -- pendente | aprovado | recusado (cadastro feito pelo site)
  origem        TEXT NOT NULL DEFAULT 'painel',   -- painel | cadastro
  motivo_recusa TEXT NOT NULL DEFAULT '',
  conta_id      TEXT,                          -- login dono deste perfil (um login pode ter assessoria + influenciador + embaixador)
  criado_em     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  atualizado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX IF NOT EXISTS parceiros_conta ON parceiros (conta_id);

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
  coletiva      TEXT NOT NULL DEFAULT '{}',    -- JSON da inscrição coletiva (prazo, limite, valor, faixas...); em banco já criado, rode d1/migracoes/001-convites-coletiva.sql
  api_situacao       TEXT NOT NULL DEFAULT '',   -- resposta da assessoria na plataforma dela (API v1): '' | pendente | aceito | recusado
  api_modo_pagamento TEXT NOT NULL DEFAULT '',   -- assessoria | ticketsports
  api_motivo         TEXT NOT NULL DEFAULT '',
  api_respondido_em  TEXT NOT NULL DEFAULT '',
  api_aviso          TEXT NOT NULL DEFAULT '',   -- '' | ok | erro: ... (último aviso enviado à plataforma)
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

-- Contas de acesso dos parceiros (parceiro.html): e-mail e senha e/ou Google
CREATE TABLE IF NOT EXISTS contas (
  id           TEXT PRIMARY KEY,               -- uuid
  parceiro_id  TEXT NOT NULL UNIQUE REFERENCES parceiros(id),  -- perfil principal (os outros: parceiros.conta_id)
  email        TEXT NOT NULL UNIQUE,           -- sempre em minúsculas
  senha        TEXT NOT NULL DEFAULT '',       -- pbkdf2$iteracoes$sal$hash (vazio = só Google)
  google_sub   TEXT UNIQUE,                    -- id da conta Google (NULL = só senha)
  criado_em    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ultimo_acesso TEXT NOT NULL DEFAULT ''
);

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

-- "Me avise quando as inscrições abrirem" (functions/api/aviso.js); o painel
-- envia o e-mail quando a prova ganha o link da Ticket Sports
CREATE TABLE IF NOT EXISTS avisos (
  id         TEXT PRIMARY KEY,                 -- uuid (também serve para cancelar o aviso)
  prova_id   TEXT NOT NULL,
  nome       TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL,                    -- sempre em minúsculas
  criado_em  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  enviado_em TEXT NOT NULL DEFAULT '',         -- vazio = ainda não avisado
  UNIQUE (prova_id, email)
);
CREATE INDEX IF NOT EXISTS avisos_prova ON avisos (prova_id, enviado_em);

-- Depoimentos (aba Depoimentos do painel), mostrados no site quando publicado = 1
CREATE TABLE IF NOT EXISTS depoimentos (
  id            TEXT PRIMARY KEY,              -- uuid
  nome          TEXT NOT NULL,                 -- quem falou
  cargo         TEXT NOT NULL DEFAULT '',      -- cargo e instituição, ex.: Diretora de eventos · CREA-MG
  texto         TEXT NOT NULL,
  onde          TEXT NOT NULL DEFAULT 'empresas', -- empresas | inicio | ambas
  publicado     INTEGER NOT NULL DEFAULT 1,
  criado_em     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  atualizado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Propostas comerciais montadas no painel (aba Propostas): itens, somas e impressão em PDF
CREATE TABLE IF NOT EXISTS propostas (
  id            TEXT PRIMARY KEY,              -- uuid
  numero        TEXT NOT NULL DEFAULT '',      -- ex.: 69
  cliente       TEXT NOT NULL,
  evento        TEXT NOT NULL DEFAULT '',
  dados         TEXT NOT NULL DEFAULT '{}',    -- JSON: datas, cliente, evento, itens [{cat, desc, qtd, unit}], observações
  criado_em     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  atualizado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Minutário: itens padrão das propostas (descrição, valor unitário e quantidade de referência)
CREATE TABLE IF NOT EXISTS minutario (
  id            TEXT PRIMARY KEY,              -- uuid
  categoria     TEXT NOT NULL DEFAULT '',      -- ex.: Estrutura do evento
  descricao     TEXT NOT NULL,
  dados         TEXT NOT NULL DEFAULT '{}',    -- JSON: { unit, qtd, pp (variável), base (participantes da quantidade de referência) }
  criado_em     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  atualizado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Configurações do painel. Chave "contrato" = JSON { empresas: [...], foro, modelo }
CREATE TABLE IF NOT EXISTS configuracoes (
  chave         TEXT PRIMARY KEY,
  valor         TEXT NOT NULL DEFAULT '{}',
  atualizado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- PDF do contrato assinado, um por proposta (só sai pela API do painel, nunca por /arquivos)
CREATE TABLE IF NOT EXISTS contratos_assinados (
  proposta_id TEXT PRIMARY KEY,
  nome        TEXT NOT NULL DEFAULT '',
  tamanho     INTEGER NOT NULL DEFAULT 0,
  dados       BLOB NOT NULL,
  enviado_em  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Medição (functions/api/evento.js): só totais por dia, sem nada que identifique o visitante
CREATE TABLE IF NOT EXISTS medicao (
  dia    TEXT NOT NULL,                    -- AAAA-MM-DD
  evento TEXT NOT NULL,                    -- visita | inscricao | whatsapp | orcamento | agenda | compartilhar
  ref    TEXT NOT NULL DEFAULT '',         -- id da prova ou nome da página
  n      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (dia, evento, ref)
);

-- Posts da Ticket Sports ("Url do post"), guardados crus por functions/api/ticketsports.js
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

-- API v1 para parceiros (docs/api-v1-parceiros.md); em banco já criado, rode d1/migracoes/013-integracoes.sql

-- Convite de conexão enviado à plataforma da assessoria (JWS assinado pela Tardim).
-- O código de uso único vai no convite; aqui fica só o SHA-256 dele.
CREATE TABLE IF NOT EXISTS conexoes (
  id             TEXT PRIMARY KEY,                 -- cnx_<uuid>
  parceiro_id    TEXT NOT NULL REFERENCES parceiros(id) ON DELETE CASCADE,
  plataforma_url TEXT NOT NULL,                    -- origem da plataforma: https://im3-eventos.vercel.app
  ambiente       TEXT NOT NULL DEFAULT 'live',     -- live | test
  codigo_hash    TEXT NOT NULL,
  situacao       TEXT NOT NULL DEFAULT 'enviando', -- enviando | enviado | falhou | aceito | recusado | cancelado
  erro           TEXT NOT NULL DEFAULT '',         -- por que a entrega falhou
  motivo         TEXT NOT NULL DEFAULT '',         -- motivo da recusa
  respondido_por TEXT NOT NULL DEFAULT '',
  integracao_id  TEXT,                             -- chave criada no aceite
  expira_em      TEXT NOT NULL,
  enviado_em     TEXT NOT NULL DEFAULT '',
  respondido_em  TEXT NOT NULL DEFAULT '',
  criado_em      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX IF NOT EXISTS conexoes_parceiro ON conexoes (parceiro_id);

-- Uma chave por conexão aceita. Guarda só o SHA-256 da chave.
CREATE TABLE IF NOT EXISTS integracoes (
  id              TEXT PRIMARY KEY,                -- uuid
  parceiro_id     TEXT NOT NULL REFERENCES parceiros(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL DEFAULT '',        -- ex.: IM3 (nome que a plataforma informou)
  plataforma_url  TEXT NOT NULL DEFAULT '',
  conexao_id      TEXT,
  ambiente        TEXT NOT NULL DEFAULT 'live',    -- live | test (test enxerga provas ainda não publicadas)
  prefixo         TEXT NOT NULL,                   -- tdm_live_3f9c (para reconhecer a chave)
  hash            TEXT NOT NULL UNIQUE,            -- sha256 hex da chave inteira
  webhook_url     TEXT NOT NULL DEFAULT '',        -- endereço que recebe os avisos (etapa 2)
  webhook_segredo TEXT NOT NULL DEFAULT '',        -- assina os avisos (HMAC-SHA256)
  usada_em        TEXT NOT NULL DEFAULT '',
  revogada_em     TEXT NOT NULL DEFAULT '',        -- vazio = valendo
  criada_em       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX IF NOT EXISTS integracoes_parceiro ON integracoes (parceiro_id);

-- Envios de inscrição coletiva pela API (POST /api/v1/envios, etapa 2).
-- Mesma Idempotency-Key + mesmo corpo = mesma resposta por 7 dias.
CREATE TABLE IF NOT EXISTS envios_api (
  id                 TEXT PRIMARY KEY,             -- env_<uuid>
  integracao_id      TEXT NOT NULL REFERENCES integracoes(id) ON DELETE CASCADE,
  prova_id           TEXT NOT NULL,
  referencia_externa TEXT NOT NULL DEFAULT '',
  idempotency_key    TEXT NOT NULL,
  corpo_hash         TEXT NOT NULL,
  resposta           TEXT NOT NULL DEFAULT '',
  inscricao_id       TEXT,                         -- inscricoes.id gerada por este envio
  criado_em          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE (integracao_id, idempotency_key)
);

-- Limite de uso: chamadas por chave por minuto
CREATE TABLE IF NOT EXISTS api_uso (
  integracao_id TEXT NOT NULL,
  minuto        INTEGER NOT NULL,                  -- epoch / 60
  n             INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (integracao_id, minuto)
);

-- Avisos às plataformas que falharam (novas tentativas); em banco já criado: npm run db:migracoes:producao
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
