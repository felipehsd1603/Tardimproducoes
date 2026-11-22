/*
 * ============================================================
 *  CONTEÚDO DO SITE — edite somente este arquivo
 * ============================================================
 *
 *  PROXIMAS: corridas com data marcada. Quando a data passar,
 *  a prova some sozinha do calendário.
 *
 *    nome        Nome da prova
 *    data        "AAAA-MM-DD"
 *    hora        Largada, ex.: "08h00" (opcional)
 *    local       Local da largada
 *    percursos   Ex.: "Caminhada 3 km · 5 km · 10 km"
 *    info        Linha extra (preço, kit…) (opcional)
 *    poster      Imagem da arte da prova (pasta assets/corridas)
 *    inscricao   Link de inscrição (se vazio, usa o Linktree)
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
    nome: "3ª Corrida do Crea-MG",
    data: "2026-12-13",
    hora: "08h00",
    local: "Praça da Assembleia (Praça Carlos Chagas), Santo Agostinho, BH",
    percursos: "Corrida de rua",
    info: "Inscrição R$ 50. Concentração às 6h30. Profissionais do Sistema Crea-MG, 60+ e PcD têm 50% de desconto.",
    poster: "assets/corridas/poster-crea-mg.jpg",
    inscricao: "",
  },
  {
    nome: "Circuito do Fogo · 15ª edição",
    data: "2027-02-21",
    hora: "",
    local: "Belo Horizonte, MG",
    percursos: "Caminhada 3 km · 5 km · 10 km",
    info: "Inscrições abertas. Novidade desta edição: Road Runner Challenge.",
    poster: "assets/corridas/poster-circuito-do-fogo.jpg",
    inscricao: "",
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
