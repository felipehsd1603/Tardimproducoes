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
 *  REALIZADAS: logos das provas que já fizemos.
 *    nome, ano, logo
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
  { nome: "Hulk Run", ano: "2026", logo: "assets/corridas/hulk-run.png" },
  { nome: "Crefito-4 Run", ano: "2026", logo: "assets/corridas/crefito4-run.png" },
  { nome: "Corrida FHEMIG", ano: "2026", logo: "assets/corridas/corrida-fhemig.png" },
  { nome: "Meia Maratona Liberdade", ano: "2025", logo: "assets/corridas/meia-maratona-liberdade.png" },
  { nome: "Campeonato Mineiro de Corrida de Rua", ano: "2025", logo: "assets/corridas/campeonato-mineiro.png" },
  { nome: "Corrida da Administração", ano: "2025", logo: "assets/corridas/corrida-administracao.png" },
  { nome: "Corrida da Guarda Civil Municipal", ano: "", logo: "assets/corridas/guarda-civil-bh.png" },
];
