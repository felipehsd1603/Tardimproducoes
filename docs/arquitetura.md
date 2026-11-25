# Arquitetura do site e das APIs

Guia para quem mantém o código. O README explica o que cada página faz e como operar o painel; este documento explica como o backend está organizado e as regras para mexer nele.

## Visão geral

Site estático (HTML, CSS e JS na raiz) servido pelo **Cloudflare Pages**, com o backend em **Pages Functions** (`functions/`) e o banco no **Cloudflare D1** (binding `DB`, banco `tardim`).

| Área | Endereço | Quem usa | Login | Formato de erro | Documentação |
| --- | --- | --- | --- | --- | --- |
| Painel | `/api/admin/*` | `admin.html` (equipe Tardim) | Senha única + cookie `tardim_painel` | `{ erro: <status>, mensagem }` | `/api/admin/docs` (com login) |
| Área do parceiro | `/api/parceiro/*` | `parceiro.html` | E-mail/senha ou Google + cookie `tardim_parceiro` | `{ erro: <status>, mensagem }` | `/api/admin/docs` |
| Site | `/api/orcamento`, `/api/inscricao`, `/api/aviso`, `/api/evento`, `/api/ticketsports` | Páginas do site; Ticket Sports | Nenhum (origem e limite por IP) | `{ erro: "<campo>" }` | `/api/admin/docs` |
| API v1 para parceiros | `/api/v1/*` | Sistemas das assessorias (ex.: IM3), servidor a servidor | `Authorization: Bearer tdm_live_...` | `{ erro: { codigo, mensagem } }` | `/api/v1/docs` (pública) e `docs/api-v1-parceiros.md` |
| Páginas dinâmicas | `/js/provas-db.js`, `/prova-<id>` | Calendário e páginas de prova | Nenhum | — | `functions/_middleware.js` |

Os formatos de erro das áreas antigas ficam como estão porque as páginas dependem deles; tudo que for **novo e para terceiros** segue o padrão da v1.

## Pastas de `functions/`

```
functions/
  _middleware.js          arquivos privados (404), provas do banco, cabeçalhos de segurança, fila de avisos
  _lib/                   utilitários sem regra de negócio
    http.js               json(), mesmaOrigem(), HMAC, SHA-256, iguais(), cpfValido()
    chaves.js             chaves e segredos da API v1 (geração, formato)
    assinatura.js         JWS ES256 dos convites de conexão (segredo TARDIM_ASSINATURA_JWK)
    limite.js             limite de envios por IP (tabela envios_tentativas)
    cref6.js · instagram.js · cidades.js   consultas externas e lista do IBGE
  _admin/                 lógica da API do painel
    comum.js              Erro, corpo(), regras compartilhadas
    sessao.js             login e cookie
    tabelas.js            campos permitidos, validação e CRUD das tabelas do painel
    arquivos.js           imagens, configurações e PDF do contrato assinado
    avisos-email.js       e-mail de "Me avise" (Resend)
    integracoes.js        convite de conexão, reenviar, cancelar, desconectar
    inscricoes.js         orçamentos, inscrições, conferência de atletas, medição
    openapi.js            especificação das APIs internas
  _api-v1/                lógica da API para parceiros
    comum.js              ErroApi, corpoJson(), limite de 120/min
    autenticacao.js       chave Bearer
    conexoes.js           aceitar/recusar convite de conexão, desconectar
    catalogo.js           eu, provas, convites de prova
    envios.js             inscrição coletiva pela API
    provas.js             formato de provas e convites
    avisos.js             convite assinado, webhooks (HMAC) e fila de novas tentativas
    openapi.js            especificação pública + página Swagger
  api/                    só roteamento (um arquivo por área)
    admin/[[rota]].js · parceiro/[[rota]].js · v1/[[rota]].js
    orcamento.js · inscricao.js · aviso.js · evento.js · ticketsports.js
  arquivos/[[caminho]].js imagens enviadas pelo painel
```

Regra: arquivo em `api/` só **mapeia rota para função**; regra de negócio fica em `_admin/`, `_api-v1/` ou `_lib/`. Pastas e arquivos com `_` não viram rota (não exportam `onRequest`).

## Como acrescentar uma rota

1. Escreva a função no módulo da área (ex.: `_admin/inscricoes.js`), recebendo `env` e o que precisar, e devolvendo `json(...)`.
2. Acrescente uma linha na tabela `ROTAS` do `[[rota]].js` da área: `["GET", "caminho/:id", ({ env, p }) => funcao(env, p.id)]`.
3. Descreva a rota no `openapi.js` da área.
4. Escreva o teste em `tests/api.test.mjs` e rode `npm test`.
5. Rota da API v1: atualize também `docs/api-v1-parceiros.md` (e a cópia no repositório do IM3). A v1 só cresce: mudar ou remover um campo exige `/api/v2`.

## Segurança (vale para tudo)

- **Escrita só da própria origem**: o painel, a área do parceiro e as rotas do site recusam escrita sem o cabeçalho `Origin` do próprio site. A API v1 não tem CORS: só servidor chama.
- **Nenhum segredo no repositório.** Senhas, chaves e tokens são segredos do projeto Cloudflare (lista abaixo). Do que é gerado (chave da API, código de convite, senha de parceiro), o banco guarda só o hash.
- **Arquivos privados**: o site inteiro é publicado; `functions/_middleware.js` responde 404 para código, esquema, documentação, testes e configuração (`PRIVADO`), e essas rotas estão em `_routes.json`. Arquivo interno novo na raiz entra nas duas listas, e o teste "arquivos privados" confere.
- **Limites**: login do painel e do parceiro, 5 erros em 15 min por IP; orçamento e inscrição pelo site, 10 por hora por IP; API v1, 120 chamadas por minuto por chave e 20 aceites por minuto por IP.
- **Dados pessoais** (CPF, nascimento, e-mail, telefone dos atletas) só chegam pela inscrição coletiva e nunca saem por API pública.

## Avisos às plataformas (webhooks)

`_api-v1/avisos.js` assina cada aviso com HMAC-SHA256 do segredo da conexão. Se a entrega falhar, o aviso vai para a tabela `avisos_fila` com o mesmo `x-tardim-entrega` e é tentado de novo em 1 min, 5 min, 30 min, 2 h, 6 h e 24 h. Como o Pages não tem tarefa agendada, o middleware processa a fila em segundo plano: sempre nas chamadas de `/api/admin` e `/api/v1`, e em 10% das outras visitas. Cada linha é reservada antes do envio, para duas requisições simultâneas não mandarem o mesmo aviso.

## Testes

```
npm install
npm test
```

`tests/api.test.mjs` sobe o site inteiro (`wrangler pages dev`) num banco D1 descartável criado de `d1/schema.sql` + `d1/painel.sql`, com segredos de teste, e uma plataforma de assessoria falsa (`tests/apoio/plataforma.mjs`) que confere a assinatura dos convites e o HMAC dos avisos de verdade. Leva cerca de 2 minutos (um teste espera virar o minuto do limite de uso). O CI (`.github/workflows/ci.yml`) roda os mesmos testes a cada push e pull request.

## Banco de dados e migrações

- **Banco novo**: `d1/schema.sql` e `d1/painel.sql` têm o esquema completo. Depois de rodá-los, registre as migrações como aplicadas: `node scripts/db-registrar-migracoes.mjs --local --todas` (ou `--remote`).
- **Banco existente**: mudança de esquema = arquivo novo em `d1/migracoes/` (próximo número, ex.: `016-algo.sql`) **e** a mesma mudança em `schema.sql`/`painel.sql`. Para aplicar: `npm run db:migracoes:producao` (o wrangler aplica só as que faltam e registra na tabela `d1_migrations`). Para ver o que falta: `npm run db:migracoes:lista`.
- **Produção, uma vez só**: as migrações 001 a 012 foram aplicadas à mão. Antes do primeiro `db:migracoes:producao`, rode `node scripts/db-registrar-migracoes.mjs --remote --ate 012`.

## Publicar

```
npm run publicar
```

Gera as páginas com a versão nova dos arquivos (`scripts/gerar-paginas.js --versao`) e publica no projeto Cloudflare `tardim-teste` (domínio `tardimproducoes.com.br`). Rode as migrações antes, se houver. O deploy não sobe `node_modules`, `functions` (vai como Functions), `.wrangler` nem `.git`.

## Segredos do projeto Cloudflare

`npx wrangler pages secret put NOME --project-name tardim-teste`

| Segredo | Para quê |
| --- | --- |
| `ADMIN_SENHA` | Senha do painel |
| `SESSAO_SEGREDO` | Assina os cookies do painel e da área do parceiro |
| `TARDIM_ASSINATURA_JWK` | Chave privada ES256 dos convites de conexão (gerar com `node scripts/gerar-chave-assinatura.mjs`) |
| `GOOGLE_CLIENT_ID` | Login com Google na área do parceiro |
| `RESEND_API_KEY`, `AVISO_REMETENTE`, `AVISO_EMAIL` | E-mails (novo cadastro de parceiro, "Me avise", senha nova) |
| `IG_USER_ID`, `IG_TOKEN` | Conferência de seguidores no Instagram |
| `TICKETSPORTS_TOKEN`, `TICKETSPORTS_CHAVE` | "Url do post" da Ticket Sports |
