# API v1 para parceiros · Tardim Produções

Contrato da integração nativa entre a Tardim Produções (organizadora de provas) e plataformas de assessoria, começando pelo IM3 (`im3-eventos`). Este arquivo é igual nos dois repositórios: `TardimApp/docs/api-v1-parceiros.md` e `im3-eventos/docs/integracao-tardim-api-v1.md`. Mudou um, muda o outro no mesmo dia.

## Princípios

1. **Cada sistema tem o seu banco.** A Tardim nunca lê o Supabase do IM3, e o IM3 nunca lê o D1 da Tardim. Os dois conversam só por esta API e pelos webhooks.
2. **A API é da Tardim e não conhece o IM3.** Qualquer plataforma de assessoria pode usar o mesmo contrato. Do lado do IM3, a Tardim é um conector de organizadora, e outras organizadoras podem entrar depois.
3. **A chave é da assessoria, não da plataforma.** Cada assessoria cliente do IM3 tem a sua chave, e a Tardim pode cancelá-la sem afetar as outras.
4. **Dados pessoais só passam uma vez, no envio, do IM3 para a Tardim.** Nada volta com CPF. Resultados e situações voltam pelo `id_externo`, que é o código do atleta no IM3.
5. **A v1 só cresce.** Campos novos podem aparecer, e quem consome deve ignorar o que não conhece. Remover ou mudar um campo exige `/v2`, com 90 dias de convivência.

## Convenções

| Item | Regra |
|---|---|
| Base | `https://tardimproducoes.com.br/api/v1` |
| Formato | JSON UTF-8 (`content-type: application/json`) |
| Datas | ISO 8601 com fuso: horários de prova em `-03:00` (`2027-03-14T06:30:00-03:00`), registros (criada, atualizada) em UTC (`2026-11-25T13:58:11Z`); datas sem hora em `AAAA-MM-DD` |
| Dinheiro | inteiro em centavos (`valor_centavos`) |
| Distância | inteiro em metros (`distancia_m`) |
| Tempos | segundos inteiros (`tempo_liquido_s`) e texto pronto para mostrar (`tempo_liquido`: `"0:52:14"`) |
| Ids | texto; o de prova é o mesmo do site (`corrida-copmbm-2027`) |
| Paginação | `?limite=` (padrão 100, máximo 500) e `?cursor=`; a resposta traz `proximo_cursor` (`null` no fim) |
| Limite de uso | 120 chamadas por minuto por chave; acima disso, `429` com o cabeçalho `retry-after` |
| Repetição segura | todo `POST` aceita `Idempotency-Key`; a mesma chave com o mesmo corpo devolve a mesma resposta por 7 dias, e com outro corpo dá `409` |

### Erros

```json
{ "erro": { "codigo": "atleta_invalido", "mensagem": "CPF inválido", "campos": [{ "indice": 3, "campo": "cpf" }] } }
```

| HTTP | Códigos |
|---|---|
| 400 | `json_invalido`, `campo_obrigatorio`, `atleta_invalido`, `percurso_invalido`, `camiseta_invalida` |
| 401 | `chave_ausente`, `chave_invalida`, `chave_revogada` |
| 403 | `assessoria_inativa`, `sem_convite` (a assessoria não tem convite nesta prova), `modo_nao_permitido` |
| 404 | `nao_encontrado` (inclui prova sem convite para a assessoria, para não revelar provas de outros) |
| 405 | `metodo` |
| 409 | `idempotencia_conflito`, `prazo_encerrado`, `vagas_esgotadas` |
| 413 | `muitos_atletas` (mais de 1.000 por envio) |
| 429 | `limite_de_uso` |
| 501 | `nao_implementado` (rota prevista no contrato e ainda não entregue) |

## Autenticação

```
Authorization: Bearer tdm_live_3f9c...   (produção: só provas publicadas)
Authorization: Bearer tdm_test_8a21...   (teste: também provas ainda não publicadas, para testar antes do lançamento)
```

- Só servidor chama a API: ela não responde a CORS, então a chave nunca deve ir para o navegador.
- A assessoria precisa estar aprovada e ativa no painel; se for desativada, todas as chaves dela passam a responder `403 assessoria_inativa`.

- **Quem pode ter chave:** um parceiro do tipo `assessoria`, com cadastro aprovado. A chave é criada no painel da Tardim, em Parceiros, na seção Integração.
- **O que a Tardim guarda:** só o SHA-256 da chave, mais os 8 primeiros caracteres para identificá-la. Ela é mostrada uma única vez, na criação.
- **Junto com a chave, a Tardim registra:**
  - `webhook_url`: o endereço que recebe os avisos, de preferência `https`;
  - `webhook_segredo`: gerado pela Tardim, mostrado uma vez e usado para assinar os avisos.
- **Cancelar a chave** bloqueia na hora todas as chamadas dela e os avisos para aquele endereço.
- **Próxima versão (OAuth 2.0):** o botão "Conectar com a Tardim" no IM3 leva à área do parceiro, onde a assessoria autoriza, e o IM3 recebe a chave sem ninguém copiar e colar. O formato da chave e as rotas não mudam.

## Recursos

### `GET /eu`

Quem é a chave.

```json
{
  "assessoria": { "id": "b1f0...", "nome": "IM3 Sports", "cidade": "Lagoa Santa", "uf": "MG", "logo_url": "https://tardimproducoes.com.br/arquivos/assessorias/b1f0-1732.png" },
  "chave": { "prefixo": "tdm_live_3f9c", "nome": "IM3", "ambiente": "live", "criada_em": "2026-11-25T13:58:11Z" }
}
```

### `GET /provas`

Provas cadastradas no painel em que **esta assessoria tem convite** e que ainda não aconteceram (publicadas; com chave de teste, também as não publicadas). Se a assessoria tiver mais de um convite na mesma prova, vale o mais recente. Filtros opcionais: `?desde=2026-12-01` e `?atualizadas_desde=<data>` (prova ou convite alterados a partir dessa data), para buscar só as mudanças.

```json
{
  "provas": [{
    "id": "volta-noturna-da-lagoa-2027",
    "nome": "Volta Noturna da Lagoa 2027",
    "publicada": true,
    "data": "2027-03-14",
    "largada": "2027-03-14T19:00:00-03:00",
    "hora": "19h",
    "local": "Lagoa da Pampulha, Belo Horizonte",
    "url": "https://tardimproducoes.com.br/prova-volta-noturna-da-lagoa-2027",
    "poster_url": "https://tardimproducoes.com.br/arquivos/provas/volta-noturna-1732.jpg",
    "resumo": "...",
    "regulamento_url": "https://...",
    "percurso_mapa_url": null,
    "percursos": [
      { "id": "5-km", "nome": "5 km", "distancia_m": 5000 },
      { "id": "10-km", "nome": "10 km", "distancia_m": 10000 },
      { "id": "caminhada-3-km", "nome": "Caminhada 3 km", "distancia_m": 3000 }
    ],
    "camisetas": ["PP", "P", "M", "G", "GG", "XG", "XGG"],
    "kit": { "itens": ["Camiseta", "Número de peito", "Medalha"], "retirada": "13/03, 10h às 18h, ..." },
    "programacao": [{ "hora": "18h", "atividade": "Concentração" }],
    "precos_publicos": [
      { "nome": "1º lote", "valor": "R$ 89,90", "valor_centavos": 8990, "detalhe": "até 31/12", "esgotado": false }
    ],
    "coletiva": {
      "aberta": true,
      "prazo": "2027-02-28T23:59:59-03:00",
      "prazo_interno_atletas": "2027-02-20",
      "limite_atletas": 50,
      "vagas_restantes": 50,
      "modos_pagamento": ["assessoria", "ticketsports"],
      "pagamento_combinado": "PIX à Tardim até o prazo",
      "valor_atleta_centavos": 7990,
      "faixas_desconto": [{ "minimo_atletas": 20, "desconto_pct": 5 }, { "minimo_atletas": 50, "desconto_pct": 10 }],
      "cortesias": 2,
      "beneficios": ["Tenda da equipe", "Kits retirados em lote"],
      "retirada_kits_equipe": "Sábado na loja",
      "ponto_encontro": null
    },
    "convite": {
      "cupom": "IM3VOLTA",
      "desconto": "15%",
      "comissao_pct": 10,
      "condicoes": null,
      "contrapartida": null,
      "link_atleta": "https://tardimproducoes.com.br/prova-volta-noturna-da-lagoa-2027.html?cupom=IM3VOLTA",
      "link_inscricao": "https://ticketsports.com.br/...",
      "link_kit_divulgacao": "https://tardimproducoes.com.br/kit.html?p=volta-noturna-da-lagoa-2027&c=IM3VOLTA&n=IM3%20Sports&d=15%25"
    },
    "atualizada_em": "2026-11-25T13:57:43Z"
  }],
  "proximo_cursor": null
}
```

- `percursos[].id` sai do nome (`"5 km"` → `"5-km"`); use esse id em `percurso_id` no envio. `distancia_m` é `null` quando o nome não tem distância (ex.: "Kids").
- `camisetas`: a lista padrão da Tardim enquanto a prova não tiver tamanhos próprios.
- `coletiva.aberta` é `false` quando passou o prazo, a prova já aconteceu ou acabaram as vagas da equipe. `vagas_restantes` conta os atletas que a equipe já enviou (planilha ou API); `null` = sem limite.
- No modo `ticketsports`, o atleta usa `convite.link_atleta` (página da prova com o cupom, que leva à Ticket Sports). `link_inscricao` é o link direto da Ticket Sports, sem cupom.

### `GET /provas/{id}`

Uma prova, no mesmo formato. Devolve `404` se a prova não existe ou se a assessoria não tem convite nela.

### `POST /envios`

Envio de inscrição coletiva. Cada chamada é um envio, e uma assessoria pode fazer vários envios na mesma prova (novos atletas, alterações e cancelamentos).

Cabeçalho obrigatório: `Idempotency-Key: <id do lote no IM3>`.

```json
{
  "prova_id": "volta-noturna-da-lagoa-2027",
  "referencia_externa": "lote_7c1e...",
  "modo_pagamento": "assessoria",
  "responsavel": { "nome": "Igor ...", "telefone": "+5531999990000", "email": "contato@im3sports.com.br" },
  "atletas": [{
    "id_externo": "insc_5d2a...",
    "nome": "Maria Souza",
    "cpf": "12345678909",
    "nascimento": "1990-05-20",
    "sexo": "F",
    "percurso_id": "10-km",
    "camiseta": "M",
    "email": "maria@exemplo.com",
    "telefone": "+5531988880000",
    "equipe": "IM3 Sports",
    "consentimento_em": "2026-11-20T09:12:00-03:00"
  }],
  "cancelamentos": [{ "id_externo": "insc_91b0...", "motivo": "desistiu" }]
}
```

- `modo_pagamento`:
  - `assessoria`: o aluno já pagou à assessoria, e a assessoria acerta o total com a Tardim. A plataforma envia só atletas com pagamento confirmado.
  - `ticketsports`: o aluno paga na Ticket Sports com o cupom da assessoria. A plataforma envia quem confirmou presença, e a Tardim confere o pagamento pelo cupom e pelo CPF.
- `id_externo` é único por assessoria e prova. Reenviar o mesmo `id_externo` **atualiza** o atleta (camiseta, percurso etc.) enquanto o prazo da coletiva estiver aberto.
- `consentimento_em` é obrigatório: é a prova de que o atleta aceitou ter os dados enviados à organizadora.
- `cpf` vai só com dígitos, e `sexo` é `F` ou `M`. Os percursos e camisetas precisam ser os de `GET /provas/{id}`.

Resposta `202`:

```json
{
  "envio": { "id": "env_0b3d...", "referencia_externa": "lote_7c1e...", "recebido_em": "2026-11-25T15:02:11-03:00" },
  "atletas": [
    { "id_externo": "insc_5d2a...", "situacao": "recebido" }
  ],
  "cancelamentos": [{ "id_externo": "insc_91b0...", "situacao": "cancelado" }],
  "rejeitados": []
}
```

Atletas com erro vão em `rejeitados` (`{ "id_externo", "codigo", "campo", "mensagem" }`), e os outros seguem normalmente. O `400` só acontece quando o envio inteiro é inválido.

### `GET /envios/{id}`

Um envio e a situação atual de cada atleta dele.

### `GET /atletas?prova_id=...`

Situação de **todos** os atletas da assessoria naquela prova, para conciliar quando um webhook se perder. Filtro opcional: `?atualizados_desde=<data>`.

```json
{
  "atletas": [{
    "id_externo": "insc_5d2a...",
    "situacao": "inscrito",
    "motivo": "",
    "numero_peito": "1043",
    "percurso_id": "10-km",
    "atualizado_em": "2026-12-02T11:00:00-03:00"
  }],
  "proximo_cursor": null
}
```

### `GET /provas/{id}/resultados`

Os resultados dos atletas **desta assessoria** na prova, no formato descrito em [Resultado](#resultado). Antes da publicação, devolve `{ "publicado": false, "resultados": [] }`.

## Situação do atleta

```
recebido ──► aguardando_pagamento ──► inscrito
   │                │                    │
   └──► recusado ◄──┘                    └──► cancelado
```

| Situação | Quando |
|---|---|
| `recebido` | A Tardim recebeu o atleta e ainda não conferiu |
| `aguardando_pagamento` | Só no modo `ticketsports`: conferido, à espera do pagamento com o cupom |
| `inscrito` | Inscrição oficial feita. O `numero_peito` chega quando for definido |
| `recusado` | Com `motivo` (ex.: "CPF já inscrito por outra equipe", "percurso esgotado") |
| `cancelado` | Pela assessoria (em `cancelamentos`) ou pela Tardim, com `motivo` |

## Resultado

```json
{
  "id_externo": "insc_5d2a...",
  "numero_peito": "1043",
  "percurso_id": "10-km",
  "situacao": "concluiu",
  "tempo_bruto": "0:52:40", "tempo_bruto_s": 3160,
  "tempo_liquido": "0:52:14", "tempo_liquido_s": 3134,
  "pace": "5:13/km", "pace_s_km": 313,
  "classificacao": {
    "geral": 412, "geral_total": 1830,
    "sexo": 38, "sexo_total": 702,
    "faixa": 6, "faixa_total": 95, "faixa_nome": "F 35-39"
  },
  "parciais": [{ "nome": "5 km", "tempo": "0:26:01", "tempo_s": 1561 }],
  "certificado_url": "https://tardimproducoes.com.br/resultado/volta-noturna-da-lagoa-2027/1043"
}
```

- `situacao`: `concluiu`, `nao_largou`, `nao_concluiu` ou `desclassificado`. Fora `concluiu`, os tempos e as classificações vêm `null`.
- O cruzamento com a assessoria é feito na Tardim pelo `numero_peito` do atleta inscrito via API. O resultado volta com `id_externo` e sem CPF.

## Webhooks (Tardim → plataforma)

A Tardim chama `POST <webhook_url>` com:

```
content-type: application/json
x-tardim-evento: atleta.situacao
x-tardim-entrega: ent_4f2c...          (único; use para não processar duas vezes)
x-tardim-assinatura: t=1764090000,v1=5d41402abc4b2a76b9719d911017c592...
```

**Assinatura:** `v1 = hex(HMAC-SHA256(webhook_segredo, t + "." + corpo_bruto))`.
- Quem recebe recalcula sobre o corpo exatamente como chegou e compara em tempo constante.
- Recusa o aviso se `t` estiver a mais de 5 minutos do relógio.

**Resposta esperada:** qualquer `2xx` em até 10 segundos.
- Se der erro ou não responder, a Tardim tenta de novo em 1 min, 5 min, 30 min, 2 h, 6 h e 24 h.
- Depois disso, a entrega fica como falhada no painel. A plataforma concilia pelas rotas `GET` acima.

| Evento | `dados` |
|---|---|
| `prova.publicada` | a prova, no formato de `GET /provas/{id}` (só para quem tem convite) |
| `prova.alterada` | a prova inteira, já atualizada, e `campos_alterados: ["largada", "percursos"]` |
| `prova.cancelada` | `{ "prova_id", "motivo" }` |
| `atleta.situacao` | `{ "prova_id", "atletas": [ { id_externo, situacao, motivo, numero_peito, percurso_id } ] }` (agrupado por envio de conferência) |
| `resultados.publicados` | `{ "prova_id", "publicado_em", "resultados": [ Resultado... ] }`: só os atletas desta assessoria |
| `resultados.corrigidos` | mesmo formato, com a lista completa já corrigida (substitui a anterior) |

Corpo:

```json
{ "id": "ent_4f2c...", "evento": "resultados.publicados", "criado_em": "2027-03-15T08:00:00-03:00", "dados": { } }
```

## LGPD

- A Tardim é controladora dos dados da inscrição oficial. A assessoria é controladora dos dados dos seus alunos na plataforma dela.
- A plataforma colhe o consentimento do atleta para o envio à organizadora (`consentimento_em`) e mostra isso na tela de inscrição da prova parceira.
- A Tardim não devolve CPF, e-mail nem telefone por nenhuma rota ou webhook.
- Os resultados enviados à assessoria são só os dos atletas que ela inscreveu.
- O cancelamento da inscrição por LGPD (o aluno exclui a conta no IM3) vai como `cancelamentos` com `motivo: "lgpd"`. A Tardim apaga os dados pessoais do atleta depois da prova, mantendo só o resultado anonimizado.

## Como cada lado implementa

### Tardim (`TardimApp`)

| Peça | Onde |
|---|---|
| Rotas da v1 | `functions/api/v1/[[rota]].js` (separada de `/api/inscricao`, que continua para a planilha) |
| Chaves | tabela `integracoes` (parceiro_id, prefixo, hash, webhook_url, webhook_segredo, ambiente, criada_em, revogada_em) |
| Envios | tabela `envios_api` (id, integracao_id, prova_id, referencia_externa, idempotency_key, hash do corpo, resposta, criado_em) |
| Atletas | `atletas` ganha `origem` (`planilha` / `api`), `id_externo`, `situacao`, `motivo`, `numero_peito`, `modo_pagamento` |
| Resultados | tabela `resultados` (prova_id, numero_peito, percurso, tempos, classificações, parciais); aba **Resultados** no painel importa o arquivo da cronometragem |
| Webhooks | tabela `webhook_entregas` (fila com tentativas); envio pelo próprio Pages Function e reenvio por Cron Trigger |
| Painel | Parceiros → Integração: criar e cancelar a chave e ver as entregas. Inscrições: atletas por origem, conferir, recusar e definir o número de peito |

### IM3 (`im3-eventos`)

| Peça | Onde |
|---|---|
| Conector | `src/modules/integracoes/organizadoras/` com a interface `Organizadora` (`listarProvas`, `obterProva`, `enviar`, `situacaoAtletas`, `resultados`, `tratarWebhook`) e a implementação `tardim/` |
| Configuração | tabela `integracoes_organizadora` (organizacao_id, organizadora, chave cifrada, webhook_segredo cifrado, modo_pagamento_padrao); tela **Admin → Ajustes → Integrações** (só o Dono) |
| Prova parceira | `eventos` ganha `origem` (`propria` / `tardim`), `origem_id` e `modo_pagamento`; percursos viram `categorias`; camiseta vira campo extra obrigatório |
| Aluno | `pessoas` ganha `nascimento` e `sexo`, exigidos só na inscrição de prova parceira |
| Situação | `inscricoes` ganha `situacao_organizadora`, `motivo_organizadora` e `numero_peito`; a tela de inscritos mostra uma coluna "Tardim" |
| Envio | botão **Enviar à Tardim** nos inscritos (modo A: confirmados; modo B: quem confirmou presença); cada clique gera um lote com `Idempotency-Key` |
| Webhook | `src/app/api/integracoes/tardim/webhook/route.ts` (confere a assinatura, grava a entrega e atualiza situação ou resultado) |
| Resultados | tabela `resultados_prova` (inscricao_id, tempos, pace, classificações, parciais); o aluno vê na área dele e no evento, e a assessoria vê o ranking da equipe |

## Ordem de entrega

1. **Tardim** (feito em 25/11/2026):
   - tabelas novas e a aba Integração do painel;
   - `GET /eu`, `GET /provas` e `GET /provas/{id}`.
2. **Tardim:**
   - `POST /envios`, `GET /envios/{id}` e `GET /atletas`;
   - a conferência no painel;
   - o webhook `atleta.situacao`.
3. **IM3:**
   - o conector e a tela de Integrações;
   - importar a prova parceira, com nascimento, sexo e o modo de pagamento;
   - o botão "Enviar à Tardim" e o webhook.
4. **Os dois lados:**
   - a aba Resultados na Tardim, com `resultados.publicados`;
   - a tela de resultado do aluno no IM3.
5. **Teste de ponta a ponta:**
   - uma prova de teste com chave `tdm_test_`, uma assessoria de teste no IM3, os dois modos de pagamento, uma correção de resultado e um webhook perdido conciliado pelo `GET`;
   - só depois, produção.
