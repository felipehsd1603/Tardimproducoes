// Especificação OpenAPI 3.1 das APIs internas (painel, área do parceiro e rotas do site).
// Servida só com login no painel: /api/admin/openapi.json e /api/admin/docs (Swagger UI).
// A API pública para parceiros tem a própria: /api/v1/docs (functions/_api-v1/openapi.ts).

/** Pedaço de esquema OpenAPI (objeto JSON livre). */
type Esquema = Record<string, unknown>;

const ref = (n: string): Esquema => ({ $ref: "#/components/schemas/" + n });
const j = (schema: Esquema): Esquema => ({ content: { "application/json": { schema } } });
const res = (descricao: string, schema?: Esquema): Esquema => Object.assign({ description: descricao }, schema ? j(schema) : {});
const id = (n = "id") => ({ name: n, in: "path", required: true, schema: { type: "string" } });
const PADRAO = { 401: res("Sem login", ref("ErroPainel")), 403: res("Escrita de outra origem", ref("ErroPainel")) };
const TABELAS = ["provas", "parceiros", "convites", "propostas", "minutario", "depoimentos"];
const OBJ = { type: "object", additionalProperties: true };

export const OPENAPI_ADMIN = {
  openapi: "3.1.0",
  info: {
    title: "Tardim Produções · APIs internas",
    version: "1.0.0",
    description: [
      "APIs usadas pelas páginas do próprio site. Nenhuma é para terceiros (para parceiros: /api/v1/docs).",
      "",
      "- **/api/admin**: painel (admin.html). Login com a senha do painel e cookie `tardim_painel` (HttpOnly, 14 dias). Erros `{ erro: <status>, mensagem }`.",
      "- **/api/parceiro**: área do parceiro (parceiro.html). Cookie `tardim_parceiro` (30 dias). Erros `{ erro: <status>, mensagem }`.",
      "- **Rotas do site** (/api/orcamento, /api/inscricao, /api/aviso, /api/evento): erros `{ erro: \"<campo>\" }`.",
      "",
      "Toda escrita exige o cabeçalho `Origin` do próprio site. Sem CORS.",
    ].join("\n"),
  },
  servers: [{ url: "/" }],
  tags: [{ name: "Painel: sessão" }, { name: "Painel: cadastros" }, { name: "Painel: integração" }, { name: "Painel: o que chega" }, { name: "Painel: arquivos e configurações" }, { name: "Área do parceiro" }, { name: "Site" }],
  paths: {
    "/api/admin/login": { post: { tags: ["Painel: sessão"], summary: "Entrar (senha do painel)", requestBody: j({ type: "object", properties: { senha: { type: "string" } } }),
      responses: { 200: res("Entrou (define o cookie)"), 401: res("Senha incorreta", ref("ErroPainel")), 429: res("5 erros em 15 minutos", ref("ErroPainel")) } } },
    "/api/admin/sair": { post: { tags: ["Painel: sessão"], summary: "Sair", responses: { 200: res("Saiu") } } },
    "/api/admin/sessao": { get: { tags: ["Painel: sessão"], summary: "Confere o login", responses: { 200: res("Com login"), ...PADRAO } } },
    "/api/admin/dados": { get: { tags: ["Painel: cadastros"], summary: "Provas, parceiros, convites e depoimentos de uma vez", responses: { 200: res("Dados", { type: "object", properties: { provas: { type: "array", items: OBJ }, parceiros: { type: "array", items: OBJ }, convites: { type: "array", items: OBJ }, depoimentos: { type: ["array", "null"], items: OBJ } } }), ...PADRAO } } },
    "/api/admin/{tabela}": {
      parameters: [{ name: "tabela", in: "path", required: true, schema: { enum: TABELAS } }],
      get: { tags: ["Painel: cadastros"], summary: "Listar", responses: { 200: res("Lista", { type: "array", items: OBJ }), ...PADRAO } },
      post: { tags: ["Painel: cadastros"], summary: "Criar (só os campos permitidos de cada tabela; provas exigem id)", requestBody: j(OBJ),
        responses: { 201: res("Criado", OBJ), 400: res("Campo inválido", ref("ErroPainel")), 409: res("Identificador ou cupom repetido", ref("ErroPainel")), ...PADRAO } },
    },
    "/api/admin/{tabela}/{id}": {
      parameters: [{ name: "tabela", in: "path", required: true, schema: { enum: TABELAS } }, id()],
      put: { tags: ["Painel: cadastros"], summary: "Alterar só os campos enviados (convite e prova avisam as plataformas conectadas)", requestBody: j(OBJ),
        responses: { 200: res("Salvo", OBJ), 400: res("Campo inválido", ref("ErroPainel")), 404: res("Não existe", ref("ErroPainel")), ...PADRAO } },
      delete: { tags: ["Painel: cadastros"], summary: "Excluir (parceiro leva convites, login e conexões; convite manda convite.cancelado)", responses: { 200: res("Excluído"), ...PADRAO } },
    },
    "/api/admin/parceiros/{id}/instagram": { post: { tags: ["Painel: cadastros"], summary: "Conferir seguidores na API da Meta", parameters: [id()], responses: { 200: res("Resultado e parceiro"), 404: res("Não existe", ref("ErroPainel")), ...PADRAO } } },
    "/api/admin/cref6": { get: { tags: ["Painel: cadastros"], summary: "Consultar registro no CREF6", parameters: [{ name: "numero", in: "query", schema: { type: "string", examples: ["012345-G/MG"] } }], responses: { 200: res("Resultado"), ...PADRAO } } },
    "/api/admin/parceiros/{id}/integracoes": { get: { tags: ["Painel: integração"], summary: "Convites de conexão e conexões da assessoria (nunca a chave)", parameters: [id()], responses: { 200: res("Conexões", { type: "object", properties: { conexoes: { type: "array", items: OBJ }, integracoes: { type: "array", items: OBJ }, assinatura: { type: "boolean" } } }), ...PADRAO } } },
    "/api/admin/parceiros/{id}/conexao": { post: { tags: ["Painel: integração"], summary: "Convidar o sistema da assessoria (convite assinado)", parameters: [id()],
      requestBody: j({ type: "object", required: ["plataforma_url"], properties: { plataforma_url: { type: "string", format: "uri" }, ambiente: { enum: ["live", "test"] } } }),
      responses: { 201: res("Convite (situacao enviado ou falhou)", OBJ), 400: res("Assessoria inválida ou endereço", ref("ErroPainel")), 503: res("Falta TARDIM_ASSINATURA_JWK", ref("ErroPainel")), ...PADRAO } } },
    "/api/admin/conexoes/{id}/{acao}": { post: { tags: ["Painel: integração"], summary: "Reenviar ou cancelar um convite de conexão", parameters: [id(), { name: "acao", in: "path", required: true, schema: { enum: ["reenviar", "cancelar"] } }], responses: { 200: res("Convite", OBJ), ...PADRAO } } },
    "/api/admin/integracoes/{id}/desconectar": { post: { tags: ["Painel: integração"], summary: "Desconectar (avisa a plataforma e revoga a chave)", parameters: [id()], responses: { 200: res("Desconectada"), ...PADRAO } } },
    "/api/admin/convites/{id}/avisar": { post: { tags: ["Painel: integração"], summary: "Reenviar o aviso do convite de prova", parameters: [id()], responses: { 200: res("Resultado do aviso"), 400: res("Nada a avisar", ref("ErroPainel")), ...PADRAO } } },
    "/api/admin/inscricoes": { get: { tags: ["Painel: o que chega"], summary: "Envios de inscrição coletiva (planilha e sistemas)", responses: { 200: res("Envios", { type: "array", items: OBJ }), ...PADRAO } } },
    "/api/admin/inscricoes/{id}/atletas": { get: { tags: ["Painel: o que chega"], summary: "Atletas de um envio (dados pessoais)", parameters: [id()], responses: { 200: res("Atletas", { type: "array", items: OBJ }), ...PADRAO } } },
    "/api/admin/inscricoes/{id}/confirmar": { post: { tags: ["Painel: o que chega"], summary: "Confirmar os recebidos de um envio (avisa a plataforma)", parameters: [id()], responses: { 200: res("Confirmados e avisos"), ...PADRAO } } },
    "/api/admin/atletas/{id}": { put: { tags: ["Painel: o que chega"], summary: "Situação, número de peito ou recusa de um atleta (avisa a plataforma)", parameters: [id()],
      requestBody: j({ type: "object", properties: { situacao: { enum: ["recebido", "aguardando_pagamento", "inscrito", "recusado", "cancelado"] }, numero_peito: { type: "string" }, motivo: { type: "string" } } }),
      responses: { 200: res("Atleta e aviso"), 404: res("Não existe", ref("ErroPainel")), ...PADRAO } } },
    "/api/admin/orcamentos": { get: { tags: ["Painel: o que chega"], summary: "Pedidos de orçamento", responses: { 200: res("Pedidos", { type: "array", items: OBJ }), ...PADRAO } } },
    "/api/admin/medicao": { get: { tags: ["Painel: o que chega"], summary: "Medição do site", parameters: [{ name: "dias", in: "query", schema: { type: "integer", default: 30, maximum: 365 } }], responses: { 200: res("Totais", { type: "array", items: OBJ }), ...PADRAO } } },
    "/api/admin/avisos": { get: { tags: ["Painel: o que chega"], summary: "Pedidos de \"Me avise\" por prova", responses: { 200: res("Resumo", { type: "array", items: OBJ }), ...PADRAO } } },
    "/api/admin/avisos/{prova}/enviar": { post: { tags: ["Painel: o que chega"], summary: "E-mail de inscrições abertas (Resend)", parameters: [id("prova")], requestBody: j({ type: "object", properties: { nome: { type: "string" }, data: { type: "string" }, local: { type: "string" }, link: { type: "string" }, pagina_id: { type: "string" } } }), responses: { 200: res("Enviados e falhas"), 503: res("Falta RESEND_API_KEY", ref("ErroPainel")), ...PADRAO } } },
    "/api/admin/arquivos": { post: { tags: ["Painel: arquivos e configurações"], summary: "Enviar imagem (até 1,9 MB)", parameters: [{ name: "caminho", in: "query", required: true, schema: { type: "string", examples: ["provas/volta-1732.jpg"] } }],
      requestBody: { required: true, content: { "image/jpeg": {}, "image/png": {}, "image/webp": {} } }, responses: { 201: res("Gravada"), 400: res("Tipo ou caminho inválido", ref("ErroPainel")), 413: res("Grande demais", ref("ErroPainel")), ...PADRAO } } },
    "/api/admin/config/{chave}": { parameters: [{ name: "chave", in: "path", required: true, schema: { enum: ["contrato"] } }],
      get: { tags: ["Painel: arquivos e configurações"], summary: "Ler configuração", responses: { 200: res("Configuração", OBJ), ...PADRAO } },
      put: { tags: ["Painel: arquivos e configurações"], summary: "Gravar configuração", requestBody: j(OBJ), responses: { 200: res("Gravada", OBJ), ...PADRAO } } },
    "/api/admin/propostas/{id}/assinado": { parameters: [id()],
      get: { tags: ["Painel: arquivos e configurações"], summary: "Baixar o contrato assinado (PDF)", responses: { 200: { description: "PDF", content: { "application/pdf": {} } }, 404: res("Sem contrato", ref("ErroPainel")), ...PADRAO } },
      put: { tags: ["Painel: arquivos e configurações"], summary: "Enviar o contrato assinado (PDF até 1,9 MB)", parameters: [{ name: "nome", in: "query", schema: { type: "string" } }], requestBody: { required: true, content: { "application/pdf": {} } }, responses: { 200: res("Gravado"), ...PADRAO } },
      delete: { tags: ["Painel: arquivos e configurações"], summary: "Apagar o contrato assinado", responses: { 200: res("Apagado"), ...PADRAO } } },

    "/api/parceiro/config": { get: { tags: ["Área do parceiro"], summary: "Client id do login com Google", responses: { 200: res("Config") } } },
    "/api/parceiro/cidades": { get: { tags: ["Área do parceiro"], summary: "Municípios do IBGE", parameters: [{ name: "uf", in: "query", required: true, schema: { type: "string" } }], responses: { 200: res("Cidades") } } },
    "/api/parceiro/cadastro": { post: { tags: ["Área do parceiro"], summary: "Cadastro (fica pendente até a Tardim aprovar)", requestBody: j(OBJ), responses: { 200: res("Com Google: cadastrado e logado. Com e-mail e senha: { confirmar: true }, link enviado por e-mail (mesma resposta se o e-mail já tem conta)"), 400: res("Dado inválido", ref("ErroPainel")), 429: res("Muitos cadastros", ref("ErroPainel")) } } },
    "/api/parceiro/confirmar": { post: { tags: ["Área do parceiro"], summary: "Confirmar o cadastro pelo link do e-mail (24 horas)", requestBody: j({ type: "object", properties: { token: { type: "string" } } }), responses: { 200: res("Cadastrado e logado"), 400: res("Link expirado ou inválido", ref("ErroPainel")), 409: res("Já confirmado", ref("ErroPainel")) } } },
    "/api/parceiro/login": { post: { tags: ["Área do parceiro"], summary: "Entrar com e-mail e senha", requestBody: j({ type: "object", properties: { email: { type: "string" }, senha: { type: "string" } } }), responses: { 200: res("Entrou"), 401: res("Dados errados", ref("ErroPainel")) } } },
    "/api/parceiro/google": { post: { tags: ["Área do parceiro"], summary: "Entrar com Google", requestBody: j({ type: "object", properties: { credential: { type: "string" } } }), responses: { 200: res("Entrou ou { novo: true }") } } },
    "/api/parceiro/esqueci": { post: { tags: ["Área do parceiro"], summary: "Link para criar senha nova (1 hora)", requestBody: j({ type: "object", properties: { email: { type: "string" } } }), responses: { 200: res("Enviado (mesma resposta se o e-mail não existe)") } } },
    "/api/parceiro/nova-senha": { post: { tags: ["Área do parceiro"], summary: "Trocar a senha pelo link", requestBody: j({ type: "object", properties: { token: { type: "string" }, senha: { type: "string" } } }), responses: { 200: res("Trocada e logado") } } },
    "/api/parceiro/sair": { post: { tags: ["Área do parceiro"], summary: "Sair", responses: { 200: res("Saiu") } } },
    "/api/parceiro/eu": { get: { tags: ["Área do parceiro"], summary: "Perfis e convites (convites só depois de aprovado)", responses: { 200: res("Perfis"), 401: res("Sem login", ref("ErroPainel")) } } },

    "/api/orcamento": { post: { tags: ["Site"], summary: "Pedido de orçamento (cópia do que vai por WhatsApp/e-mail)", requestBody: j(OBJ), responses: { 200: res("Gravado"), 403: res("Outra origem", ref("ErroSite")), 429: res("10 por hora por IP", ref("ErroSite")) } } },
    "/api/inscricao": { post: { tags: ["Site"], summary: "Inscrição coletiva pela planilha (até 1.000 atletas)", requestBody: j(OBJ), responses: { 200: res("Gravada"), 400: res("Atleta inválido: { erro: \"atleta\", linha }", ref("ErroSite")), 403: res("Outra origem", ref("ErroSite")) } } },
    "/api/aviso": {
      post: { tags: ["Site"], summary: "\"Me avise quando abrir\"", requestBody: j({ type: "object", properties: { prova_id: { type: "string" }, nome: { type: "string" }, email: { type: "string" } } }), responses: { 200: res("Gravado (repetido não duplica)") } },
      get: { tags: ["Site"], summary: "Cancelar o aviso (link do e-mail)", parameters: [{ name: "cancelar", in: "query", schema: { type: "string" } }], responses: { 200: { description: "Página HTML" } } } },
    "/api/evento": { post: { tags: ["Site"], summary: "Medição: soma 1 no total do dia (sem identificar ninguém)", requestBody: j({ type: "object", properties: { evento: { type: "string" }, ref: { type: "string" } } }), responses: { 200: res("Contado") } } },
    "/api/ticketsports": { post: { tags: ["Site"], summary: "\"Url do post\" da Ticket Sports (guarda crua)", parameters: [{ name: "token", in: "query", required: true, schema: { type: "string" } }], responses: { 200: { description: "Chave de validação da Ticket Sports (texto)" }, 403: { description: "Token errado" } } } },
  },
  components: {
    schemas: {
      ErroPainel: { type: "object", properties: { erro: { type: ["integer", "string"] }, mensagem: { type: "string" } } },
      ErroSite: { type: "object", properties: { erro: { type: "string" } } },
    },
  },
};
