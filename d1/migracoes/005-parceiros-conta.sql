-- Rodar UMA vez em banco criado antes de 23/11/2026 (rodar de novo dá erro de coluna duplicada, sem estragar nada):
--   npx wrangler d1 execute tardim --remote --file d1/migracoes/005-parceiros-conta.sql
-- Um login pode ter vários perfis (assessoria, influenciador, embaixador):
-- cada perfil é um parceiro com conta_id apontando para a conta. contas.parceiro_id
-- continua sendo o perfil principal.
ALTER TABLE parceiros ADD COLUMN conta_id TEXT;
UPDATE parceiros SET conta_id = (SELECT c.id FROM contas c WHERE c.parceiro_id = parceiros.id)
  WHERE conta_id IS NULL;
CREATE INDEX IF NOT EXISTS parceiros_conta ON parceiros (conta_id);
