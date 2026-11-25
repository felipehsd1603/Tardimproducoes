# Inscrição pelo site com PIX

Quem chega pelo link de um embaixador ou influenciador (`prova-<id>.html?cupom=CUPOM`) se inscreve direto no site
da Tardim, com o desconto do cupom, e paga por PIX. O próprio parceiro também faz inscrições na área do parceiro:
primeiro com as cortesias do convite e, depois delas, por PIX com o desconto. O atleta comum, sem cupom, continua
na Ticket Sports.

## Como funciona

| Parte | Onde |
| --- | --- |
| Configuração por prova (abrir, modalidades, camisetas, lotes com valor, último dia e vagas) | Painel > Provas > Inscrição no site (`provas.inscricao_site`) |
| Regras (lote atual, desconto do cupom, vagas, CPF repetido, confirmação) | `functions/_lib/inscricoes-site.ts` |
| Cobrança PIX (API PIX padrão do Banco Central, formato do Banco Inter) | `functions/_lib/pix.ts` |
| Inscrição pública | `functions/api/inscricao-site/[[rota]].ts` + `inscricao.html` |
| Inscrição do parceiro | `POST /api/parceiro/inscricao`, `GET /api/parceiro/inscricoes` |
| Painel | aba Inscrições no site (`/api/admin/inscricoes-site`) |
| Tabela | `inscricoes_site` (`d1/migracoes/016-inscricoes-site.sql`) |

- **Lote atual:** o primeiro, na ordem, que não passou do último dia e ainda tem vaga. O PIX em aberto reserva a vaga por 1 hora.
- **Desconto:** vem do campo "Desconto do cupom" do convite: `10%` ou `R$ 15`.
- **Confirmação:** a Tardim consulta a cobrança no banco. Isso acontece na tela do QR Code (a cada 10 s), em parte das visitas
  ao site e no botão "Conferir no banco" do painel. Não depende de aviso do banco (webhook), que exigiria certificado também
  na entrada.
- **Pagamento parcial:** um PIX pago com valor menor não confirma. A inscrição fica aguardando e aparece no painel.
- **E-mail de confirmação:** é enviado pelo Resend, quando ele está configurado.

## Etapas

1. **Banco simulado (pronto).** `tests/apoio/banco-pix.mjs` responde como a API do Inter. Os testes ficam em
   `tests/inscricao-site.test.mjs` e rodam com `npm test`. Para usar no servidor local:

   ```
   node tests/apoio/banco-pix.mjs 8897
   npx wrangler pages dev . --port 8791 --binding PIX_API_URL=http://127.0.0.1:8897/pix/v2 \
     --binding PIX_CLIENT_ID=teste --binding PIX_CLIENT_SECRET=teste --binding PIX_CHAVE=pix@tardim.test
   # pagar: curl -X POST http://127.0.0.1:8897/simulador/pagar/tdm<id-da-inscrição-sem-hífens>
   ```

2. **Ambiente de testes do Inter (sandbox).**
   1. No Internet Banking PJ, vá em Soluções para sua empresa > Nova integração, com permissões de Pix (cob.write e cob.read).
   2. Baixe a chave e o certificado de testes.
   3. Envie o certificado à Cloudflare: `npx wrangler mtls-certificate upload --cert <cert.crt> --key <chave.key> --name inter-sandbox`.
      O Pages não usa certificado direto, então o envio passa por um Worker privado que guarda o certificado (binding
      `mtls_certificates`). Esse Worker fica ligado ao site por service binding com o nome `PIX_CERT`. O código já chama
      `env.PIX_CERT.fetch()` quando ele existe.
   4. Cadastre os segredos (quem tem as credenciais executa os comandos):

      ```
      npx wrangler pages secret put PIX_CLIENT_ID     --project-name tardim-teste
      npx wrangler pages secret put PIX_CLIENT_SECRET --project-name tardim-teste
      npx wrangler pages secret put PIX_CHAVE         --project-name tardim-teste
      npx wrangler pages secret put PIX_API_URL       --project-name tardim-teste   # https://cdpj-sandbox.partners.uatinter.co/pix/v2
      npx wrangler pages secret put PIX_TOKEN_URL     --project-name tardim-teste   # https://cdpj-sandbox.partners.uatinter.co/oauth/v2/token
      ```

3. **Produção.** Faça o mesmo com as credenciais de produção:
   - `PIX_API_URL`: `https://cdpj.partners.bancointer.com.br/pix/v2`
   - `PIX_TOKEN_URL`: `https://cdpj.partners.bancointer.com.br/oauth/v2/token`

   Depois, faça o teste com centavos: uma prova de teste com lote de R$ 0,01, paga com o seu próprio PIX.

Sem `PIX_API_URL`, `PIX_CLIENT_ID`, `PIX_CLIENT_SECRET` e `PIX_CHAVE`, o site responde "o pagamento por PIX ainda não
está ativo". As cortesias do parceiro funcionam mesmo assim.
