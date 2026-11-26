# Mudanças

Formato: o mais recente primeiro. Datas em AAAA-MM-DD.

## 2026-11-26 · Inscrições fechadas seguem o painel e a Ticket Sports

### Mudou
- Prova com campo **Inscrições** no painel: automático (segue a Ticket Sports e as datas dos lotes), abertas, esgotadas ou encerradas. Esgotada ou encerrada, o botão "Inscreva-se" do site vira aviso ("Inscrições encerradas" ou "esgotadas").
- Conferência na Ticket Sports (`functions/_lib/ticketsports-situacao.ts`): lê o `availability` do schema.org da página da prova. Roda às 6h e às 18h no Worker `workers/conferencia-ticketsports` (gratuito) e na hora pelo botão "Conferir inscrições na Ticket Sports" do painel.
- Site: `FECHAR_INSCRICOES` (js/eventos.js) fecha a prova quando todos os lotes com data passaram.
- Trazido da branch `inscricoes-fechadas` (feita no código antigo) para o servidor em TypeScript e o painel em React; banco: `d1/migracoes/017-inscricoes-fechadas.sql`.

## 2026-11-25 · Painel em React + TypeScript

### Mudou
- O painel (`/admin`) foi refeito em **React + TypeScript** (`painel/`, build com Vite), com as mesmas abas, endereços (#provas, #prova/<id>, #convite/<id>/links, #proposta/<id>...), textos e regras. `npm run painel:build` gera `admin.html` + `assets/painel/` (fora do git); `npm test`, `npm run publicar` e o CI geram antes.
- Formulário da prova: valores, programação, perguntas frequentes, percursos e itens do kit agora são linhas editáveis com botões (antes, texto com "|").
- O painel antigo continua em `/admin-classico` (`admin-classico.html` + `js/admin.js`) até a conferência.
- Dependências de desenvolvimento novas, versões exatas e gratuitas: `vite` 8.3.8, `react`/`react-dom` 19.3.1, `@vitejs/plugin-react` 6.3.0, `@types/react`/`@types/react-dom` 19.3.0.

### Segurança
- O HTML do painel só carrega `<script src>` do próprio site (sem script inline nem polyfill de modulepreload): teste `tests/painel-csp.test.mjs`. A pasta `painel/` (código-fonte) não sai pelo site.

## 2026-11-25 · Site público em Astro

### Mudou
- As páginas públicas (início, empresas, prova, portfólio, evento, institucional, assessorias, equipe, parceiro, kit, privacidade, programa de embaixadores, link-assessoria e 404) agora são escritas em **Astro + TypeScript** em `site/`, com um layout comum (head, prévia, ícones, scripts) e componentes para o topo, o rodapé, os ícones e o botão do WhatsApp. O HTML gerado é o mesmo de antes para visitantes e para o Google: as 50 páginas (incluindo cada `prova-<id>` e `trabalho-<id>`), `sitemap.xml` e `robots.txt` foram comparadas com as da versão anterior (`npm run site:comparar`), sem diferença de título, descrição, prévia, canonical, JSON-LD, textos, links, scripts ou atributos.
- `prova-<id>.html`, `trabalho-<id>.html`, `sitemap.xml`, `robots.txt` e `404.html` saem do Astro (`getStaticPaths`), com os dados do `js/eventos.js` e do `js/realizadas.js`. Saíram o `scripts/gerar-paginas.js` e o `scripts/404-modelo.html`.
- `npm run site:build` gera `dist/` e monta `publico/`; `npm run dev`, `npm test` e `npm run publicar` usam `publico/`. O `?v=` dos CSS e JS muda a cada build (antes, só com `--versao`).
- Dependências novas, versões exatas e gratuitas (só desenvolvimento): `astro` 7.4.10, `@astrojs/check` 0.9.11, `@types/node` 22.20.5. Node.js 22.23.4 ou mais novo.

### Segurança
- Teste novo (`tests/paginas.test.mjs`): nenhuma página gerada tem script inline (fora JSON-LD) nem atributo `on*=`, e o `prova.html` mantém os pontos que o middleware troca.
- `site/`, `dist/`, `.astro/` e `astro.config.mjs` não saem pelo endereço do site (lista de arquivos privados do middleware).

## 2026-11-25 · Servidor em TypeScript + Hono

### Mudou
- `functions/` inteiro em **TypeScript** (`.ts`), com tipos do `Env` (ligações e segredos) e das linhas do D1 (`functions/_lib/tipos.ts`). Sem passo de build: o wrangler compila os `.ts`. `npm run tipos` confere os tipos (`tsconfig.json`).
- Os roteadores `api/admin`, `api/v1` e `api/parceiro` são apps **Hono** (`hono/cloudflare-pages`). Rotas, métodos (405 da v1), ordem das conferências (origem, login, sessão), formatos de erro, cabeçalhos e mensagens continuam iguais.
- Dependências novas, versões exatas e gratuitas: `hono` 4.13.18; para desenvolvimento, `typescript` 5.9.3 e `@cloudflare/workers-types` 5.20261123.1.

### Segurança
- `tsconfig.json` não sai pelo endereço do site (lista de arquivos privados do middleware).

## 2026-11-25 · Organização da API e integração com sistemas de assessorias

### Novo
- **API v1 para parceiros** (`/api/v1`): conexão por convite assinado (ES256) aceito no sistema da assessoria, convites de prova aceitos ou recusados lá, envio da lista final de atletas, situação de cada atleta e avisos assinados (HMAC). Contrato: `docs/api-v1-parceiros.md`.
- **Documentação OpenAPI 3.1 com Swagger UI**: `/api/v1/docs` (pública) e `/api/admin/docs` (interna, com login no painel).
- **Painel**: seção Integração na assessoria, resposta da assessoria na lista de Convites e conferência dos atletas em Inscrições coletivas.
- **Novas tentativas dos avisos** que falham (1 min, 5 min, 30 min, 2 h, 6 h, 24 h), com o mesmo id de entrega.
- **Testes de integração** (`npm test`, 41 testes) e CI no GitHub Actions.
- **Migrações controladas** pelo wrangler (`npm run db:migracoes:producao`).

### Mudou
- `functions/` organizado por responsabilidade: `_lib` (utilitários comuns), `_admin` (painel), `_api-v1` (API de parceiros); os arquivos de rota viraram tabelas de rotas. Comportamento das rotas existentes inalterado.
- `package.json` com o wrangler fixado e os comandos do dia a dia.

### Segurança
- `package.json`, `package-lock.json`, `tests/` e `CHANGELOG.md` não saem pelo endereço do site.
