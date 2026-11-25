-- 017-inscricoes-fechadas.sql
-- Botão "Inscreva-se" do site some quando as inscrições fecham.
--   inscricoes       painel: '' (automático) | aberta | esgotado | encerrado
--   ts_*             conferência na Ticket Sports (functions/_lib/ticketsports-situacao.js, Worker agendado)
-- Automático = vale o que a Ticket Sports mostrou; sem conferência, as datas dos lotes (js/eventos.js).

ALTER TABLE provas ADD COLUMN inscricoes TEXT NOT NULL DEFAULT '';
ALTER TABLE provas ADD COLUMN ts_situacao TEXT NOT NULL DEFAULT '';      -- aberta | esgotado | encerrado
ALTER TABLE provas ADD COLUMN ts_conferido_em TEXT NOT NULL DEFAULT '';  -- última conferência (UTC)
ALTER TABLE provas ADD COLUMN ts_mudou_em TEXT NOT NULL DEFAULT '';      -- quando a situação mudou
ALTER TABLE provas ADD COLUMN ts_erro TEXT NOT NULL DEFAULT '';          -- por que a última conferência não leu a situação
