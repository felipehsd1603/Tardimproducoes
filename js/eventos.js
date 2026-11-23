/*
 * ============================================================
 *  CONTEÚDO DO SITE: contatos, calendário e galeria
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
 *
 *  O portfólio (REALIZADAS) fica em js/realizadas.js.
 */

const SITE = {
  // Endereço do site. Ao trocar para domínio próprio, mude aqui
  // (ex.: "https://tardimproducoes.com.br/").
  urlBase: "https://felipehsd1603.github.io/TesteFelipe/",
  email: "tardimproducoes.corridas@gmail.com",
  instagram: "https://www.instagram.com/tardimproducoes/",
  linktree: "https://linktr.ee/Tardim",
  // Link de embaixador (prova-<id>.html?cupom=CODIGO): se a Ticket Sports
  // aceitar o cupom pelo endereço, coloque aqui o nome do parâmetro e o
  // site passa a mandar o cupom junto no link de inscrição. Vazio = o site
  // só mostra e copia o cupom para a pessoa colar.
  cupomParam: "",
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
