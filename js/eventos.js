/*
 * ============================================================
 *  CONTEÚDO DO SITE — edite somente este arquivo
 * ============================================================
 *
 *  PROXIMAS: corridas com data marcada. Cada prova ganha uma
 *  página própria (prova-<id>.html, gerada por scripts/gerar-paginas.js). Quando a data passar, a
 *  prova some sozinha do calendário.
 *
 *  Campos principais:
 *    id          Identificador curto, sem espaços (vai no link)
 *    nome        Nome da prova
 *    data        "AAAA-MM-DD"
 *    hora        Largada, ex.: "08h00"
 *    local       Local da largada
 *    percursos   Lista, ex.: ["Caminhada 3 km", "5 km", "10 km"]
 *    resumo      Uma ou duas frases sobre a prova
 *    poster      Arte da prova (pasta assets/corridas)
 *    inscricao   Link de inscrição (se vazio, usa o Linktree)
 *
 *  Campos da página da prova (todos opcionais; vazio = não aparece):
 *    valores     [{ nome, valor, detalhe, esgotado }]
 *    kit         { itens: [...], retirada: "local, datas e horários" }
 *    programacao [["06h30", "Concentração"], ["08h00", "Largada"]]
 *    premiacao   Texto
 *    percursoMapa Link do mapa do percurso (Google Maps, Strava, PDF...)
 *    regulamento Link do regulamento (PDF)
 *    resultados  Link de resultados
 *    fotos       Link das fotos
 *    realizacao  Quem realiza/contrata a prova
 *
 *  REALIZADAS: portfólio de trabalhos realizados (eventos e serviços).
 *  Cada trabalho ganha uma página própria (trabalho-<id>.html). Campos
 *  vazios não aparecem.
 *    area         "Eventos esportivos" (padrão) ou "Prevenção contra incêndio"
 *                 (com icone: "incendio" a área já vira prevenção)
 *    id           Identificador curto, sem espaços (vai no link)
 *    nome, ano    Nome do evento e ano
 *    data         "AAAA-MM-DD" (opcional)
 *    logo         Logo do evento (imagem quadrada em assets/corridas)
 *    icone        Sem logo: "corrida" ou "incendio" (ícone no lugar da logo)
 *    capa         Foto principal (assets/fotos)
 *    tipo         "Conselho profissional", "Órgão público", "Empresa",
 *                 "Federação esportiva", "Associação", "Evento de marca",
 *                 "Evento próprio" ou "Outros"
 *    cliente      Quem contratou / realizou
 *    local        Onde aconteceu
 *    percursos    Lista de percursos
 *    participantes Número de participantes (ex.: 2000)
 *    servicos     O que a Tardim Produções fez (lista)
 *    descricao    Texto curto sobre o evento
 *    destaques    Lista de pontos fortes do evento
 *    fotos        [{ foto, legenda }]
 *    depoimento   { texto, autor, cargo }
 */

const SITE = {
  // Endereço do site. Ao trocar para domínio próprio, mude aqui
  // (ex.: "https://tardimproducoes.com.br/").
  urlBase: "https://felipehsd1603.github.io/TesteFelipe/",
  email: "tardimproducoes.corridas@gmail.com",
  instagram: "https://www.instagram.com/tardimproducoes/",
  linktree: "https://linktr.ee/Tardim",
  // WhatsApp com DDI + DDD, só números. Ex.: "5531999999999"
  whatsapp: "5531984289667",
  // Dados institucionais. Campos vazios não aparecem no site.
  razaoSocial: "Tardim Produções e Eventos Ltda",
  cnpj: "33.787.309/0001-22",
  fundacao: "2019",
  endereco: "",
  cidade: "Belo Horizonte, MG",
  // Carrossel com as artes das provas no calendário: aparece a partir
  // desta quantidade de provas abertas.
  carrosselMinimo: 3,
};

const PROXIMAS = [
  {
    id: "corrida-crea-mg-2026",
    nome: "3ª Corrida do Crea-MG",
    data: "2026-12-13",
    hora: "08h00",
    local: "Praça da Assembleia (Praça Carlos Chagas), Santo Agostinho, BH",
    percursos: ["Corrida de rua"],
    resumo: "A corrida do Conselho Regional de Engenharia e Agronomia de Minas Gerais volta às ruas de BH com kit completo e brindes dos patrocinadores.",
    poster: "assets/corridas/poster-crea-mg.webp",
    inscricao: "",
    valores: [
      { nome: "Inscrição", valor: "R$ 50,00" },
      { nome: "Profissionais do Sistema Crea-MG, empregados do Crea-MG, 60+ e PcD", valor: "50% de desconto" },
    ],
    kit: {
      itens: ["Camiseta da prova", "Brindes dos patrocinadores"],
      retirada: "",
    },
    programacao: [
      ["06h30", "Concentração"],
      ["08h00", "Largada"],
    ],
    premiacao: "",
    percursoMapa: "",
    regulamento: "",
    resultados: "",
    fotos: "",
    realizacao: "Crea-MG",
  },
  {
    id: "circuito-do-fogo-2027",
    nome: "Circuito do Fogo · 15ª edição",
    data: "2027-02-21",
    hora: "",
    local: "Belo Horizonte, MG",
    percursos: ["Caminhada 3 km", "Corrida 5 km", "Corrida 10 km"],
    resumo: "A 15ª edição do Circuito do Fogo, em Belo Horizonte. Novidade desta edição: o Road Runner Challenge.",
    poster: "assets/corridas/poster-circuito-do-fogo.webp",
    inscricao: "",
    valores: [],
    kit: { itens: [], retirada: "" },
    programacao: [],
    premiacao: "",
    percursoMapa: "",
    regulamento: "",
    resultados: "",
    fotos: "",
    realizacao: "Tardim Produções",
  },
];

const REALIZADAS = [
  {
    id: "hulk-run-2026",
    nome: "Hulk Run 2026",
    ano: "2026",
    data: "2026-09-27",
    logo: "assets/corridas/hulk-run.webp",
    capa: "assets/fotos/hulk-run-largada.webp",
    tipo: "Evento de marca",
    cliente: "",
    local: "Praça da Pampulha, Belo Horizonte",
    percursos: ["Caminhada 3 km", "Corrida 5 km", "Corrida 10 km", "Caminhada Kids 1 km"],
    participantes: "",
    servicos: ["Produção da prova", "Arena e programação do dia", "Divulgação nas redes", "Retirada de kit"],
    descricao: "Corrida com o jogador Hulk na Pampulha, com arena, largadas por distância, premiação e shows beneficentes.",
    destaques: [
      "Shows beneficentes com Bruno & Denner e Panda, com a arrecadação destinada a instituições sociais",
      "Patrocínio master da Gerdau",
      "Retirada de kit na Decathlon BH Sul",
      "Programação completa: abertura da arena às 6h, largadas, premiação e show até as 13h",
    ],
    fotos: [
      { foto: "assets/fotos/hulk-run-largada.webp", legenda: "Largada" },
      { foto: "assets/fotos/hulk-run-2.webp", legenda: "Percurso na Pampulha" },
      { foto: "assets/fotos/hulk-run-3.webp", legenda: "Orla da Pampulha" },
      { foto: "assets/fotos/hulk-run-1.webp", legenda: "Percurso" },
      { foto: "assets/fotos/hulk-run-medalha.webp", legenda: "Medalha" },
    ],
  },
  {
    id: "crefito4-run-2026",
    nome: "Crefito-4 Run 2026",
    ano: "2026",
    logo: "assets/corridas/crefito4-run.webp",
    capa: "assets/fotos/crefito4-run-bh.webp",
    tipo: "Conselho profissional",
    cliente: "Crefito-4 (Conselho Regional de Fisioterapia e Terapia Ocupacional de MG)",
    local: "Etapas em cidades de Minas Gerais",
    percursos: ["Corrida 3 km", "Corrida 5 km", "Corrida 10 km"],
    participantes: "",
    servicos: ["Produção das etapas", "Retirada de kit", "Divulgação"],
    descricao: "Circuito de corridas do Crefito-4 com etapas em diferentes cidades de Minas Gerais.",
    destaques: [
      "Etapas em cidades como Contagem (cerca de 2 mil atletas), Belo Horizonte e Governador Valadares",
      "Inscrição gratuita para fisioterapeutas e terapeutas ocupacionais inscritos no Crefito-4",
    ],
    fotos: [{ foto: "assets/fotos/crefito4-run-bh.webp", legenda: "Etapa Belo Horizonte" }],
  },
  {
    id: "corrida-fhemig-2026",
    nome: "Corrida FHEMIG 2026",
    ano: "2026",
    data: "2026-11-14",
    logo: "assets/corridas/corrida-fhemig.webp",
    tipo: "Órgão público",
    cliente: "FHEMIG (Fundação Hospitalar do Estado de Minas Gerais)",
    local: "Belo Horizonte",
    percursos: ["3,5 km", "10 km"],
    servicos: ["Produção da prova", "Retirada de kit", "Premiação"],
    descricao: "Corrida da Fundação Hospitalar do Estado de Minas Gerais, com premiação em dinheiro.",
    destaques: [
      "Premiação em dinheiro para os primeiros colocados da classificação geral",
      "Retirada de kit na Decathlon (13 e 14 de novembro)",
    ],
  },
  {
    id: "caminhada-trt3-2025",
    nome: "Caminhada do TRT-3",
    ano: "2025",
    data: "2025-12-14",
    icone: "corrida",
    tipo: "Órgão público",
    cliente: "TRT-3 (Tribunal Regional do Trabalho da 3ª Região)",
    local: "Funcionários e Savassi, Belo Horizonte",
    percursos: ["Caminhada 3 km"],
    servicos: ["Produção, organização e execução do evento", "Inscrições e kits", "Estrutura de largada e chegada"],
    descricao: "Caminhada de rua do Tribunal Regional do Trabalho da 3ª Região, contratada por pregão eletrônico.",
    destaques: [
      "Evento dimensionado para cerca de 1.500 participantes",
      "Inscrições esgotadas no dia seguinte à abertura, com ampliação de vagas por termo aditivo",
      "Contratação por pregão eletrônico (PE 24/2025)",
    ],
  },
  {
    id: "corrida-policia-penal-2025",
    nome: "1ª Corrida da Polícia Penal de MG",
    ano: "2025",
    data: "2025-10-19",
    icone: "corrida",
    tipo: "Órgão público",
    cliente: "Sindppen-MG, com a Polícia Penal de Minas Gerais",
    local: "Pampulha, Belo Horizonte",
    participantes: 3000,
    servicos: ["Organização da prova", "Homologação na Federação Mineira de Atletismo"],
    descricao: "Primeira corrida da Polícia Penal de Minas Gerais, aproximando a força de segurança da população.",
    destaques: ["Cerca de 3 mil inscritos na primeira edição", "Prova homologada pela Federação Mineira de Atletismo"],
  },
  {
    id: "campeonato-mineiro-2025",
    nome: "Campeonato Mineiro de Corrida de Rua · 3ª etapa",
    ano: "2025",
    data: "2025-09-28",
    logo: "assets/corridas/campeonato-mineiro.webp",
    tipo: "Federação esportiva",
    cliente: "FMA (Federação Mineira de Atletismo)",
    local: "Av. Juscelino Kubitschek, Coração Eucarístico, Belo Horizonte",
    percursos: ["Caminhada 3 km", "Corrida 5 km", "Corrida 10 km"],
    servicos: ["Organização da etapa"],
    destaques: ["Chancela da Federação Mineira de Atletismo", "Percurso aferido pela CBAT"],
  },
  {
    id: "corrida-guarda-civil-bh-2025",
    nome: "1ª Corrida da Guarda Civil Municipal de BH",
    ano: "2025",
    data: "2025-08-31",
    logo: "assets/corridas/guarda-civil-bh.webp",
    tipo: "Órgão público",
    cliente: "Grêmio Recreativo da Guarda Civil Municipal de BH, em parceria com a Prefeitura de Belo Horizonte",
    local: "Av. dos Andradas, Belo Horizonte",
    percursos: ["Caminhada 3 km", "Corrida 5 km", "Corrida 10 km"],
    servicos: ["Organização da prova"],
    descricao: "Corrida em celebração aos 22 anos da Guarda Civil Municipal de Belo Horizonte.",
    destaques: ["Comemoração dos 22 anos da corporação", "Chancela da Federação Mineira de Atletismo"],
  },
  {
    id: "maratona-revezamento-bh-2025",
    nome: "3ª Maratona de Revezamento de BH",
    ano: "2025",
    data: "2025-08-10",
    icone: "corrida",
    tipo: "Outros",
    local: "Lagoa da Pampulha, Belo Horizonte",
    percursos: ["Maratona em revezamento, circuito de 5.274 m"],
    servicos: ["Organização da prova"],
    destaques: ["Chancela da Federação Mineira de Atletismo"],
  },
  {
    id: "meia-maratona-liberdade-2025",
    nome: "2ª Meia Maratona da Liberdade",
    ano: "2025",
    logo: "assets/corridas/meia-maratona-liberdade.webp",
    tipo: "Empresa",
    cliente: "Rádio Liberdade FM 92,9",
    local: "Praça do Encontro, Betim",
    percursos: ["Caminhada 3 km", "Corrida 5 km", "Corrida 10 km", "Meia maratona 21 km"],
    servicos: ["Organização da prova"],
    destaques: ["Apoio da Prefeitura de Betim", "Chancela da Federação Mineira de Atletismo"],
  },
  {
    id: "corrida-administracao-2025",
    nome: "Corrida da Administração 2025",
    ano: "2025",
    logo: "assets/corridas/corrida-administracao.webp",
    tipo: "Conselho profissional",
    cliente: "CRA-MG (Conselho Regional de Administração de MG)",
  },
  {
    id: "circuito-do-fogo",
    nome: "Circuito do Fogo · 13ª e 14ª edições",
    ano: "2025 e 2026",
    icone: "corrida",
    capa: "assets/corridas/poster-circuito-do-fogo.webp",
    tipo: "Evento próprio",
    cliente: "",
    local: "Pampulha, Belo Horizonte",
    percursos: ["Caminhada 3,2 km", "Corrida 5 km", "Corrida 10 km"],
    servicos: ["Realização e organização da prova", "Licenciamento e operação de trânsito", "Divulgação"],
    descricao: "Corrida tradicional de Belo Horizonte, organizada pela Tardim Produções.",
    destaques: [
      "13ª edição em 12/01/2025 e 14ª edição em 11/01/2026, na Pampulha",
      "Chancela da Federação Mineira de Atletismo",
      "15ª edição marcada para 21/02/2027",
    ],
  },
  {
    id: "cro-run-bh-2024",
    nome: "CRO Run 2024 · Etapa BH",
    ano: "2024",
    data: "2024-08-25",
    icone: "corrida",
    tipo: "Conselho profissional",
    cliente: "CROMG (Conselho Regional de Odontologia de MG)",
    local: "Praça Lagoa Seca, Belvedere, Belo Horizonte",
    servicos: ["Organização da etapa"],
  },
  {
    id: "feira-hippie-brigada-2023",
    nome: "Brigada de incêndio na Feira Hippie",
    ano: "2023",
    icone: "incendio",
    tipo: "Órgão público",
    cliente: "Prefeitura de Belo Horizonte (Secretaria Municipal de Política Urbana)",
    local: "Feira de Artes e Artesanato da Afonso Pena (Feira Hippie), Belo Horizonte",
    servicos: [
      "Brigada de incêndio com bombeiros civis",
      "Prevenção e combate a incêndio",
      "Controle de pânico e primeiros socorros",
      "Fornecimento de equipamentos",
    ],
    descricao: "Serviço contínuo de brigada de incêndio na maior feira de artesanato de Belo Horizonte, contratado pela Prefeitura.",
    destaques: ["Contrato de serviço contínuo com a Prefeitura de Belo Horizonte", "Renovado por dois termos aditivos"],
  },
  {
    id: "prodemge-pcip-2021",
    nome: "Projeto de prevenção e combate a incêndio · Prodemge",
    ano: "2021",
    icone: "incendio",
    tipo: "Órgão público",
    cliente: "Prodemge (Companhia de Tecnologia da Informação do Estado de Minas Gerais)",
    local: "Belo Horizonte",
    servicos: [
      "Projeto executivo multidisciplinar de prevenção e combate a incêndio e pânico (PCIP)",
      "Coordenação de projetos",
      "Orçamento e cronograma físico-financeiro",
    ],
    descricao: "Projeto executivo de prevenção e combate a incêndio e pânico para a estatal de tecnologia do Governo de Minas Gerais.",
    destaques: ["Contrato de prestação de serviços PS 959/21, de setembro de 2021 a setembro de 2022"],
  },
  {
    id: "corrida-policia-civil-mg",
    nome: "3ª Corrida da Polícia Civil de MG",
    ano: "",
    icone: "corrida",
    tipo: "Associação",
    cliente: "CEAPOLC/MG",
    local: "Praça Nova da Pampulha, Belo Horizonte",
    servicos: ["Organização da prova"],
  },
  {
    id: "corrida-joao-cesar-de-oliveira",
    nome: "Corrida João César de Oliveira",
    ano: "",
    icone: "corrida",
    tipo: "Órgão público",
    cliente: "Prefeitura de Contagem",
    local: "Contagem, MG",
    servicos: ["Organização da prova"],
  },
];

/*
 *  GALERIA: fotos do carrossel "Na rua com a Tardim Produções".
 *    foto     Imagem (pasta assets/fotos)
 *    legenda  Texto que aparece embaixo da foto
 *    alt      Descrição da foto para leitores de tela
 */
const GALERIA = [
  { foto: "assets/fotos/hulk-run-largada.webp", legenda: "Largada da Hulk Run 2026 · Pampulha", alt: "Corredores passando pelo pórtico de largada da Hulk Run" },
  { foto: "assets/fotos/hulk-run-2.webp", legenda: "Hulk Run 2026", alt: "Corredor fazendo joinha durante a Hulk Run" },
  { foto: "assets/fotos/crefito4-run-bh.webp", legenda: "Crefito-4 Run 2026 · Etapa Belo Horizonte", alt: "Corredora sorrindo na arena da Crefito-4 Run" },
  { foto: "assets/fotos/hulk-run-medalha.webp", legenda: "Medalha da Hulk Run 2026", alt: "Medalha da Hulk Run 2026 com dados de corrida" },
  { foto: "assets/fotos/hulk-run-3.webp", legenda: "Hulk Run 2026 · Orla da Pampulha", alt: "Corredor sorrindo na orla da Pampulha" },
  { foto: "assets/fotos/hulk-run-1.webp", legenda: "Hulk Run 2026", alt: "Corredor durante a Hulk Run" },
];
