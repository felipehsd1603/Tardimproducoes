// Especificação OpenAPI 3.1 da API v1 (servida em /api/v1/openapi.json) e a página Swagger UI
// (/api/v1/docs). Texto de referência completo: docs/api-v1-parceiros.md. Mudou a API, muda aqui.

const ref = (n) => ({ $ref: "#/components/schemas/" + n });
const erro = (descricao, ...codigos) => ({ description: descricao + (codigos.length ? " (" + codigos.join(", ") + ")" : ""), content: { "application/json": { schema: ref("Erro") } } });
const ok = (descricao, schema, exemplo) => ({ description: descricao, content: { "application/json": Object.assign({ schema }, exemplo ? { example: exemplo } : {}) } });
const ERROS_CHAVE = { 401: erro("Sem chave, chave inválida ou conexão encerrada", "chave_ausente", "chave_invalida", "chave_revogada"), 403: erro("Assessoria inativa", "assessoria_inativa"), 429: erro("Limite de 120 chamadas por minuto (cabeçalho retry-after)", "limite_de_uso") };
const idPath = (nome, descricao) => ({ name: nome, in: "path", required: true, schema: { type: "string" }, description: descricao });
const corpo = (schema, exemplo) => ({ required: true, content: { "application/json": Object.assign({ schema }, exemplo ? { example: exemplo } : {}) } });

export const OPENAPI_V1 = {
  openapi: "3.1.0",
  info: {
    title: "Tardim Produções · API v1 para parceiros",
    version: "1.0.0",
    description: [
      "API para plataformas de assessorias esportivas (ex.: IM3) receberem os convites de prova da Tardim Produções, enviarem a inscrição coletiva e acompanharem a situação de cada atleta.",
      "",
      "**Conexão sem chave manual:** a Tardim envia um convite assinado (JWS ES256) para `{plataforma}/api/integracoes/organizadoras/convites`; o admin da assessoria aceita na plataforma, que chama `POST /conexoes/{id}/aceitar` com o código do convite e recebe a chave (`tdm_live_...`) e o segredo dos avisos uma única vez.",
      "",
      "**Regras:** só servidor chama (sem CORS); JSON UTF-8; dinheiro em centavos; distância em metros; datas ISO 8601; a v1 só cresce (campos novos podem aparecer).",
      "",
      "Contrato completo com exemplos: `docs/api-v1-parceiros.md` (no repositório).",
    ].join("\n"),
    contact: { name: "Tardim Produções", url: "https://tardimproducoes.com.br" },
  },
  servers: [{ url: "https://tardimproducoes.com.br/api/v1" }],
  security: [{ chave: [] }],
  tags: [
    { name: "Conexão", description: "Convite assinado, aceite e desconexão" },
    { name: "Provas e convites", description: "O que a assessoria pode oferecer aos alunos" },
    { name: "Inscrições", description: "Lista final de atletas e a situação de cada um" },
  ],
  paths: {
    "/chaves-publicas": {
      get: { tags: ["Conexão"], summary: "Chave pública que confere o convite de conexão (JWKS)", security: [],
        responses: { 200: ok("JWKS (cache de 1 hora)", ref("Jwks"), { keys: [{ kty: "EC", crv: "P-256", x: "…", y: "…", kid: "tdm-2026-11", alg: "ES256", use: "sig" }] }) } },
    },
    "/conexoes/{id}/aceitar": {
      post: { tags: ["Conexão"], summary: "Aceitar o convite de conexão (devolve a chave uma única vez)", security: [],
        description: "Autentica pelo `codigo` de uso único do convite. `webhook_url` precisa ter a mesma origem do endereço convidado. Limite: 20 por minuto por IP.",
        parameters: [idPath("id", "convite_id do JWS (cnx_...)")],
        requestBody: corpo(ref("AceiteConexao"), { codigo: "<64 hex>", plataforma: { nome: "IM3", url: "https://im3-eventos.vercel.app" }, webhook_url: "https://im3-eventos.vercel.app/api/integracoes/tardim/webhook", aceito_por: "Igor" }),
        responses: { 201: ok("Conectada", ref("Credenciais")), 400: erro("Dados inválidos", "json_invalido", "campo_obrigatorio"), 401: erro("Código inválido", "codigo_invalido"), 403: erro("Assessoria inativa", "assessoria_inativa"), 404: erro("Convite não existe", "nao_encontrado"), 409: erro("Já respondido ou expirado", "convite_respondido", "convite_expirado"), 429: erro("Limite por IP", "limite_de_uso") } },
    },
    "/conexoes/{id}/recusar": {
      post: { tags: ["Conexão"], summary: "Recusar o convite de conexão", security: [], parameters: [idPath("id", "convite_id do JWS")],
        requestBody: corpo(ref("RecusaConexao")),
        responses: { 200: ok("Recusado", ref("Ok")), 401: erro("Código inválido", "codigo_invalido"), 404: erro("Convite não existe", "nao_encontrado"), 409: erro("Já respondido ou expirado", "convite_respondido", "convite_expirado") } },
    },
    "/eu": { get: { tags: ["Conexão"], summary: "Quem é a chave", responses: { 200: ok("Assessoria e chave", ref("Eu")), ...ERROS_CHAVE } } },
    "/conexao": { delete: { tags: ["Conexão"], summary: "A plataforma desconecta (a chave deixa de valer)", responses: { 200: ok("Desconectada", ref("Ok")), ...ERROS_CHAVE } } },
    "/provas": {
      get: { tags: ["Provas e convites"], summary: "Provas futuras em que a assessoria tem convite",
        description: "Publicadas (chave de teste: também as não publicadas). Um convite por prova (o mais recente).",
        parameters: [
          { name: "desde", in: "query", schema: { type: "string", format: "date" }, description: "Só provas a partir desta data" },
          { name: "atualizadas_desde", in: "query", schema: { type: "string", format: "date-time" }, description: "Prova ou convite alterados a partir de" },
          { name: "limite", in: "query", schema: { type: "integer", minimum: 1, maximum: 500, default: 100 } },
          { name: "cursor", in: "query", schema: { type: "string" }, description: "proximo_cursor da página anterior" },
        ],
        responses: { 200: ok("Provas", { type: "object", properties: { provas: { type: "array", items: ref("Prova") }, proximo_cursor: { type: ["string", "null"] } } }), 400: erro("Filtro inválido", "campo_obrigatorio"), ...ERROS_CHAVE } },
    },
    "/provas/{id}": { get: { tags: ["Provas e convites"], summary: "Uma prova", parameters: [idPath("id", "id da prova (ex.: volta-noturna-da-lagoa-2027)")],
      responses: { 200: ok("Prova", ref("Prova")), 404: erro("Prova não existe ou sem convite para a assessoria", "nao_encontrado"), ...ERROS_CHAVE } } },
    "/provas/{id}/resultados": { get: { tags: ["Inscrições"], summary: "Resultados dos atletas da assessoria (próxima etapa)", parameters: [idPath("id", "id da prova")],
      responses: { 501: erro("Ainda não disponível", "nao_implementado"), ...ERROS_CHAVE } } },
    "/convites": {
      get: { tags: ["Provas e convites"], summary: "Convites de prova (para conciliar avisos perdidos)",
        parameters: [{ name: "situacao", in: "query", schema: { type: "string", enum: ["pendente", "aceito", "recusado"] } }],
        responses: { 200: ok("Convites com a prova dentro", { type: "object", properties: { convites: { type: "array", items: ref("ConviteComProva") } } }), 400: erro("Filtro inválido", "campo_obrigatorio"), ...ERROS_CHAVE } },
    },
    "/convites/{id}/aceitar": { post: { tags: ["Provas e convites"], summary: "Aceitar o convite de prova", parameters: [idPath("id", "id do convite")],
      requestBody: corpo(ref("AceiteConvite"), { modo_pagamento: "assessoria", aceito_por: "Igor" }),
      responses: { 200: ok("Convite atualizado", { type: "object", properties: { convite: ref("Convite") } }), 400: erro("modo_pagamento inválido", "campo_obrigatorio"), 404: erro("Convite não existe", "nao_encontrado"), ...ERROS_CHAVE } } },
    "/convites/{id}/recusar": { post: { tags: ["Provas e convites"], summary: "Recusar o convite de prova", parameters: [idPath("id", "id do convite")],
      requestBody: corpo({ type: "object", properties: { motivo: { type: "string", maxLength: 300 }, recusado_por: { type: "string" } } }),
      responses: { 200: ok("Convite atualizado", { type: "object", properties: { convite: ref("Convite") } }), 404: erro("Convite não existe", "nao_encontrado"), ...ERROS_CHAVE } } },
    "/envios": {
      post: { tags: ["Inscrições"], summary: "Enviar a lista final (atletas novos ou alterados e cancelamentos)",
        description: "Reenviar o mesmo `id_externo` atualiza o atleta. Mesma `Idempotency-Key` com o mesmo corpo devolve a mesma resposta por 7 dias; com outro corpo, 409. Atletas com erro vão em `rejeitados` e os outros seguem.",
        parameters: [{ name: "Idempotency-Key", in: "header", required: true, schema: { type: "string", maxLength: 120 }, description: "Id do lote na plataforma" }],
        requestBody: corpo(ref("Envio")),
        responses: { 202: ok("Recebido", ref("EnvioResposta")), 400: erro("Envio inválido", "json_invalido", "campo_obrigatorio"), 403: erro("Sem convite aceito nesta prova", "sem_convite"), 409: erro("Conflito", "idempotencia_conflito", "prazo_encerrado"), 413: erro("Mais de 1.000 atletas", "muitos_atletas"), ...ERROS_CHAVE } },
    },
    "/envios/{id}": { get: { tags: ["Inscrições"], summary: "Um envio e a situação dos atletas dele", parameters: [idPath("id", "env_...")],
      responses: { 200: ok("Envio", { type: "object", properties: { envio: ref("EnvioInfo"), prova_id: { type: "string" }, atletas: { type: "array", items: ref("SituacaoAtleta") }, rejeitados: { type: "array", items: ref("Rejeitado") } } }), 404: erro("Envio não existe", "nao_encontrado"), ...ERROS_CHAVE } } },
    "/atletas": { get: { tags: ["Inscrições"], summary: "Situação de todos os atletas da assessoria numa prova",
      parameters: [{ name: "prova_id", in: "query", required: true, schema: { type: "string" } }, { name: "atualizados_desde", in: "query", schema: { type: "string", format: "date-time" } }],
      responses: { 200: ok("Atletas", { type: "object", properties: { atletas: { type: "array", items: ref("SituacaoAtleta") }, proximo_cursor: { type: ["string", "null"] } } }), 400: erro("Falta prova_id", "campo_obrigatorio"), ...ERROS_CHAVE } } },
  },
  webhooks: {
    "convite-de-conexao": { post: { summary: "Tardim → plataforma: convite de conexão assinado", description: "POST {plataforma}/api/integracoes/organizadoras/convites com `{ jws }`. Conferir com /chaves-publicas do emissor conhecido; responder 202.",
      requestBody: corpo({ type: "object", required: ["jws"], properties: { jws: { type: "string", description: "JWS compacto ES256, typ tardim-convite+jws; conteúdo = ConviteConexao" } } }), responses: { 202: { description: "Recebido" } } } },
    aviso: { post: { summary: "Tardim → plataforma: avisos (webhook_url)",
      description: "Cabeçalhos x-tardim-evento, x-tardim-entrega (único) e x-tardim-assinatura: t=<unix>,v1=hex(HMAC-SHA256(webhook_segredo, t + \".\" + corpo)). Recusar se t estiver a mais de 5 minutos. Responder 2xx em até 10 s; falhas são tentadas de novo (1 min, 5 min, 30 min, 2 h, 6 h, 24 h).",
      parameters: [{ name: "x-tardim-evento", in: "header", required: true, schema: { type: "string", enum: ["convite.criado", "convite.alterado", "convite.cancelado", "atleta.situacao", "conexao.encerrada"] } }, { name: "x-tardim-assinatura", in: "header", required: true, schema: { type: "string" } }, { name: "x-tardim-entrega", in: "header", required: true, schema: { type: "string" } }],
      requestBody: corpo(ref("Aviso")), responses: { 200: { description: "Processado" } } } },
  },
  components: {
    securitySchemes: { chave: { type: "http", scheme: "bearer", description: "tdm_live_<48 hex> (produção) ou tdm_test_<48 hex> (vê também provas não publicadas). Recebida no aceite da conexão." } },
    schemas: {
      Erro: { type: "object", required: ["erro"], properties: { erro: { type: "object", required: ["codigo", "mensagem"], properties: { codigo: { type: "string" }, mensagem: { type: "string" } } } } },
      Ok: { type: "object", properties: { ok: { type: "boolean", const: true } } },
      Jwks: { type: "object", properties: { keys: { type: "array", items: { type: "object", properties: { kty: { const: "EC" }, crv: { const: "P-256" }, x: { type: "string" }, y: { type: "string" }, kid: { type: "string" }, alg: { const: "ES256" }, use: { const: "sig" } } } } } },
      ConviteConexao: { type: "object", description: "Conteúdo do JWS do convite de conexão", properties: { iss: { type: "string" }, aud: { type: "string" }, tipo: { const: "conexao" }, convite_id: { type: "string" }, codigo: { type: "string", description: "uso único" }, ambiente: { enum: ["live", "test"] }, iat: { type: "integer" }, exp: { type: "integer" }, organizadora: { type: "object" }, assessoria: { type: "object" }, compartilha: { type: "array", items: { type: "string" } }, aceitar_url: { type: "string" }, recusar_url: { type: "string" } } },
      AceiteConexao: { type: "object", required: ["codigo"], properties: { codigo: { type: "string", pattern: "^[0-9a-f]{64}$" }, plataforma: { type: "object", properties: { nome: { type: "string" }, url: { type: "string" } } }, webhook_url: { type: "string", format: "uri" }, aceito_por: { type: "string" } } },
      RecusaConexao: { type: "object", required: ["codigo"], properties: { codigo: { type: "string" }, motivo: { type: "string" }, recusado_por: { type: "string" } } },
      Credenciais: { type: "object", properties: { chave: { type: "string" }, webhook_segredo: { type: "string" }, assessoria: { type: "object", properties: { id: { type: "string" }, nome: { type: "string" } } }, ambiente: { enum: ["live", "test"] } } },
      Eu: { type: "object", properties: { assessoria: { type: "object", properties: { id: { type: "string" }, nome: { type: "string" }, cidade: { type: ["string", "null"] }, uf: { type: ["string", "null"] }, logo_url: { type: ["string", "null"] } } }, chave: { type: "object", properties: { prefixo: { type: "string" }, nome: { type: ["string", "null"] }, ambiente: { type: "string" }, criada_em: { type: "string", format: "date-time" } } } } },
      Percurso: { type: "object", properties: { id: { type: "string", examples: ["10-km"] }, nome: { type: "string" }, distancia_m: { type: ["integer", "null"] } } },
      Coletiva: { type: "object", properties: { aberta: { type: "boolean" }, prazo: { type: ["string", "null"], format: "date-time" }, prazo_interno_atletas: { type: ["string", "null"], format: "date" }, limite_atletas: { type: ["integer", "null"] }, vagas_restantes: { type: ["integer", "null"] }, modos_pagamento: { type: "array", items: { enum: ["assessoria", "ticketsports"] } }, pagamento_combinado: { type: ["string", "null"] }, valor_atleta_centavos: { type: ["integer", "null"] }, faixas_desconto: { type: "array", items: { type: "object", properties: { minimo_atletas: { type: "integer" }, desconto_pct: { type: "number" } } } }, cortesias: { type: "integer" }, beneficios: { type: "array", items: { type: "string" } }, retirada_kits_equipe: { type: ["string", "null"] }, ponto_encontro: { type: ["string", "null"] } } },
      Convite: { type: "object", properties: { id: { type: "string" }, prova_id: { type: "string" }, situacao: { enum: ["pendente", "aceito", "recusado"] }, modo_pagamento: { type: ["string", "null"], enum: ["assessoria", "ticketsports", null] }, motivo: { type: ["string", "null"] }, respondido_em: { type: ["string", "null"], format: "date-time" }, cupom: { type: "string" }, desconto: { type: ["string", "null"] }, comissao_pct: { type: "number" }, cortesias: { type: "integer" }, condicoes: { type: ["string", "null"] }, contrapartida: { type: ["string", "null"] } } },
      ConviteComProva: { allOf: [ref("Convite"), { type: "object", properties: { prova: ref("Prova") } }] },
      Prova: { type: "object", properties: { id: { type: "string" }, nome: { type: "string" }, publicada: { type: "boolean" }, data: { type: "string", format: "date" }, largada: { type: ["string", "null"], format: "date-time" }, hora: { type: ["string", "null"] }, local: { type: ["string", "null"] }, url: { type: "string" }, poster_url: { type: ["string", "null"] }, resumo: { type: ["string", "null"] }, regulamento_url: { type: ["string", "null"] }, percurso_mapa_url: { type: ["string", "null"] }, percursos: { type: "array", items: ref("Percurso") }, camisetas: { type: "array", items: { type: "string" } }, kit: { type: "object", properties: { itens: { type: "array", items: { type: "string" } }, retirada: { type: ["string", "null"] } } }, programacao: { type: "array", items: { type: "object", properties: { hora: { type: "string" }, atividade: { type: "string" } } } }, precos_publicos: { type: "array", items: { type: "object", properties: { nome: { type: "string" }, valor: { type: "string" }, valor_centavos: { type: ["integer", "null"] }, detalhe: { type: ["string", "null"] }, esgotado: { type: "boolean" } } } }, coletiva: ref("Coletiva"), convite: { allOf: [ref("Convite"), { type: "object", properties: { link_atleta: { type: "string" }, link_inscricao: { type: ["string", "null"] }, link_kit_divulgacao: { type: "string" } } }] }, atualizada_em: { type: ["string", "null"], format: "date-time" } } },
      AceiteConvite: { type: "object", required: ["modo_pagamento"], properties: { modo_pagamento: { enum: ["assessoria", "ticketsports"] }, aceito_por: { type: "string" } } },
      AtletaEnvio: { type: "object", required: ["id_externo", "nome", "cpf", "nascimento", "sexo", "percurso_id", "camiseta", "email", "telefone", "consentimento_em"], properties: { id_externo: { type: "string", maxLength: 80 }, nome: { type: "string" }, cpf: { type: "string", pattern: "^\\d{11}$" }, nascimento: { type: "string", format: "date" }, sexo: { enum: ["F", "M"] }, percurso_id: { type: "string" }, camiseta: { type: "string" }, email: { type: "string", format: "email" }, telefone: { type: "string", examples: ["+5531988880000"] }, equipe: { type: "string" }, consentimento_em: { type: "string", format: "date-time" } } },
      Envio: { type: "object", required: ["prova_id", "modo_pagamento"], properties: { prova_id: { type: "string" }, referencia_externa: { type: "string" }, modo_pagamento: { enum: ["assessoria", "ticketsports"] }, responsavel: { type: "object", properties: { nome: { type: "string" }, telefone: { type: "string" }, email: { type: "string" } } }, atletas: { type: "array", maxItems: 1000, items: ref("AtletaEnvio") }, cancelamentos: { type: "array", items: { type: "object", required: ["id_externo"], properties: { id_externo: { type: "string" }, motivo: { type: "string" } } } } } },
      EnvioInfo: { type: "object", properties: { id: { type: "string" }, referencia_externa: { type: ["string", "null"] }, recebido_em: { type: "string", format: "date-time" }, novos: { type: "integer" }, atualizados: { type: "integer" }, cancelados: { type: "integer" } } },
      Rejeitado: { type: "object", properties: { id_externo: { type: ["string", "null"] }, codigo: { enum: ["atleta_invalido", "campo_obrigatorio", "percurso_invalido", "camiseta_invalida", "vagas_esgotadas", "nao_encontrado"] }, campo: { type: ["string", "null"] }, mensagem: { type: "string" } } },
      EnvioResposta: { type: "object", properties: { envio: ref("EnvioInfo"), atletas: { type: "array", items: { type: "object", properties: { id_externo: { type: "string" }, situacao: { type: "string" } } } }, cancelamentos: { type: "array", items: { type: "object", properties: { id_externo: { type: "string" }, situacao: { const: "cancelado" } } } }, rejeitados: { type: "array", items: ref("Rejeitado") } } },
      SituacaoAtleta: { type: "object", properties: { id_externo: { type: "string" }, situacao: { enum: ["recebido", "aguardando_pagamento", "inscrito", "recusado", "cancelado"] }, motivo: { type: ["string", "null"] }, numero_peito: { type: ["string", "null"] }, percurso_id: { type: ["string", "null"] }, atualizado_em: { type: ["string", "null"], format: "date-time" } } },
      Aviso: { type: "object", required: ["id", "evento", "criado_em", "dados"], properties: { id: { type: "string" }, evento: { type: "string" }, criado_em: { type: "string", format: "date-time" }, dados: { type: "object", description: "convite.criado/alterado: { convite, prova } · convite.cancelado: { convite_id, prova_id } · atleta.situacao: { prova_id, atletas: SituacaoAtleta[] } · conexao.encerrada: { motivo }" } } },
    },
  },
};

const SWAGGER = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14";

/** Página Swagger UI que lê a especificação em `specUrl`. O CSP dela libera só o script de início pelo hash. */
export async function paginaSwagger(specUrl, titulo) {
  const inicio = `SwaggerUIBundle({ url: ${JSON.stringify(specUrl)}, dom_id: "#swagger", deepLinking: true, docExpansion: "list", defaultModelsExpandDepth: 0, tryItOutEnabled: false });`;
  const hash = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(inicio)))));
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${titulo}</title><link rel="stylesheet" href="${SWAGGER}/swagger-ui.css">
<style>body{margin:0;background:#fff}.topbar{display:none}</style></head><body><div id="swagger"></div>
<script src="${SWAGGER}/swagger-ui-bundle.js" crossorigin="anonymous"></script>
<script>${inicio}</script>
</body></html>`;
  const csp = [
    "default-src 'self'", `script-src https://cdn.jsdelivr.net 'sha256-${hash}'`, "style-src 'unsafe-inline' https://cdn.jsdelivr.net",
    "img-src 'self' data: https:", "connect-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'self'",
  ].join("; ");
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300", "content-security-policy": csp } });
}
