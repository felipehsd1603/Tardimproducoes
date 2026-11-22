/*
 * ============================================================
 *  CONTEÚDO DO SITE — edite somente este arquivo
 * ============================================================
 *
 *  PROXIMAS: corridas com data marcada. Cada prova ganha uma
 *  página própria (prova.html?id=...). Quando a data passar, a
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
 *  REALIZADAS: portfólio de eventos já realizados. Cada evento ganha
 *  uma página de estudo de caso (evento.html?id=...). Campos vazios
 *  não aparecem.
 *    id           Identificador curto, sem espaços (vai no link)
 *    nome, ano    Nome do evento e ano
 *    data         "AAAA-MM-DD" (opcional)
 *    logo         Logo do evento (imagem quadrada em assets/corridas)
 *    capa         Foto principal (assets/fotos)
 *    tipo         "Conselho profissional", "Órgão público", "Empresa",
 *                 "Federação esportiva" ou "Evento próprio"
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
  email: "tardimproducoes.corridas@gmail.com",
  instagram: "https://www.instagram.com/tardimproducoes/",
  linktree: "https://linktr.ee/Tardim",
  // WhatsApp com DDI + DDD, só números. Ex.: "5531999999999"
  whatsapp: "5531984289667",
  // Dados institucionais. Campos vazios não aparecem no site.
  razaoSocial: "Tardim Produções LTDA",
  cnpj: "",
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
    poster: "assets/corridas/poster-crea-mg.jpg",
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
    poster: "assets/corridas/poster-circuito-do-fogo.jpg",
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
    logo: "assets/corridas/hulk-run.png",
    capa: "assets/fotos/hulk-run-largada.jpg",
    tipo: "Evento de marca",
    cliente: "",
    local: "Lagoa da Pampulha, Belo Horizonte",
    percursos: ["Caminhada 3 km", "Corrida 5 km", "Corrida 10 km", "Caminhada Kids 1.000 m"],
    participantes: "",
    servicos: ["Produção da prova", "Arena e programação do dia", "Divulgação nas redes", "Retirada de kit"],
    descricao: "Corrida com o jogador Hulk na orla da Pampulha, com arena, largadas por distância, premiação e shows beneficentes.",
    destaques: [
      "Shows beneficentes com Bruno & Denner e Panda, com doação de todo o valor arrecadado",
      "Patrocínio master da Gerdau",
      "Retirada de kit na Decathlon BH Sul",
      "Programação completa: abertura da arena às 6h, largadas, premiação e show até as 13h",
    ],
    fotos: [
      { foto: "assets/fotos/hulk-run-largada.jpg", legenda: "Largada" },
      { foto: "assets/fotos/hulk-run-2.jpg", legenda: "Percurso na Pampulha" },
      { foto: "assets/fotos/hulk-run-3.jpg", legenda: "Orla da Pampulha" },
      { foto: "assets/fotos/hulk-run-1.jpg", legenda: "Percurso" },
      { foto: "assets/fotos/hulk-run-medalha.jpg", legenda: "Medalha" },
    ],
  },
  {
    id: "crefito4-run-2026",
    nome: "Crefito-4 Run 2026",
    ano: "2026",
    logo: "assets/corridas/crefito4-run.png",
    capa: "assets/fotos/crefito4-run-bh.jpg",
    tipo: "Conselho profissional",
    cliente: "Crefito-4 (Conselho Regional de Fisioterapia e Terapia Ocupacional de MG)",
    local: "Belo Horizonte e Governador Valadares",
    percursos: [],
    participantes: "",
    servicos: ["Produção das etapas", "Retirada de kit", "Divulgação"],
    descricao: "Circuito de corridas do Crefito-4 com etapas em diferentes cidades de Minas Gerais.",
    destaques: [
      "Etapas em Belo Horizonte e em Governador Valadares (Praça Caparaó, Ilha dos Araújos)",
      "Inscrição gratuita para fisioterapeutas e terapeutas ocupacionais inscritos no Crefito-4",
    ],
    fotos: [{ foto: "assets/fotos/crefito4-run-bh.jpg", legenda: "Etapa Belo Horizonte" }],
  },
  {
    id: "corrida-fhemig-2026",
    nome: "Corrida FHEMIG 2026",
    ano: "2026",
    data: "2026-11-14",
    logo: "assets/corridas/corrida-fhemig.png",
    tipo: "Órgão público",
    cliente: "FHEMIG (Fundação Hospitalar do Estado de Minas Gerais)",
    local: "Belo Horizonte",
    percursos: ["3,5 km", "10 km"],
    participantes: "",
    servicos: ["Produção da prova", "Retirada de kit", "Premiação"],
    descricao: "Corrida da Fundação Hospitalar do Estado de Minas Gerais, com premiação em dinheiro.",
    destaques: [
      "Premiação em dinheiro para os primeiros colocados da classificação geral",
      "Retirada de kit na Decathlon (13 e 14 de novembro)",
    ],
    fotos: [],
  },
  {
    id: "meia-maratona-liberdade-2025",
    nome: "Meia Maratona Liberdade 2025",
    ano: "2025",
    logo: "assets/corridas/meia-maratona-liberdade.png",
    tipo: "Evento próprio",
    percursos: ["21 km"],
  },
  {
    id: "campeonato-mineiro-2025",
    nome: "Campeonato Mineiro de Corrida de Rua · 3ª etapa",
    ano: "2025",
    logo: "assets/corridas/campeonato-mineiro.png",
    tipo: "Federação esportiva",
    cliente: "FMA (Federação Mineira de Atletismo)",
  },
  {
    id: "corrida-administracao-2025",
    nome: "Corrida da Administração 2025",
    ano: "2025",
    logo: "assets/corridas/corrida-administracao.png",
    tipo: "Conselho profissional",
    cliente: "CRA-MG (Conselho Regional de Administração de MG)",
  },
  {
    id: "corrida-guarda-civil-bh",
    nome: "Corrida da Guarda Civil Municipal",
    ano: "",
    logo: "assets/corridas/guarda-civil-bh.png",
    tipo: "Órgão público",
    cliente: "Guarda Civil Municipal de Belo Horizonte",
    local: "Belo Horizonte",
  },
];

/*
 *  GALERIA: fotos do carrossel "Na rua com a Tardim Produções".
 *    foto     Imagem (pasta assets/fotos)
 *    legenda  Texto que aparece embaixo da foto
 *    alt      Descrição da foto para leitores de tela
 */
const GALERIA = [
  { foto: "assets/fotos/hulk-run-largada.jpg", legenda: "Largada da Hulk Run 2026 · Pampulha", alt: "Corredores passando pelo pórtico de largada da Hulk Run" },
  { foto: "assets/fotos/hulk-run-2.jpg", legenda: "Hulk Run 2026", alt: "Corredor fazendo joinha durante a Hulk Run" },
  { foto: "assets/fotos/crefito4-run-bh.jpg", legenda: "Crefito-4 Run 2026 · Etapa Belo Horizonte", alt: "Corredora sorrindo na arena da Crefito-4 Run" },
  { foto: "assets/fotos/hulk-run-medalha.jpg", legenda: "Medalha da Hulk Run 2026", alt: "Medalha da Hulk Run 2026 com dados de corrida" },
  { foto: "assets/fotos/hulk-run-3.jpg", legenda: "Hulk Run 2026 · Orla da Pampulha", alt: "Corredor sorrindo na orla da Pampulha" },
  { foto: "assets/fotos/hulk-run-1.jpg", legenda: "Hulk Run 2026", alt: "Corredor durante a Hulk Run" },
];
