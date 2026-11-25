# Mudanças

Formato: o mais recente primeiro. Datas em AAAA-MM-DD.

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
