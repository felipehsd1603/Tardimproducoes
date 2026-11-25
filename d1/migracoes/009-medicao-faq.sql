-- Rodar UMA vez em banco criado antes de 24/11/2026:
--   npx wrangler d1 execute tardim --remote --file d1/migracoes/009-medicao-faq.sql
-- (rodar de novo dá erro de "duplicate column" na última linha, sem estragar nada)

-- Medição (functions/api/evento.js): só totais por dia, sem nada que identifique o visitante
CREATE TABLE IF NOT EXISTS medicao (
  dia    TEXT NOT NULL,                    -- AAAA-MM-DD
  evento TEXT NOT NULL,                    -- visita | inscricao | whatsapp | orcamento | agenda | compartilhar
  ref    TEXT NOT NULL DEFAULT '',         -- id da prova ou nome da página
  n      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (dia, evento, ref)
);

-- Perguntas frequentes de cada prova: JSON [["pergunta", "resposta"]]
ALTER TABLE provas ADD COLUMN faq TEXT NOT NULL DEFAULT '[]';
