/*
 * ============================================================
 *  EVENTOS DA TARDIM PRODUÇÕES — edite somente este arquivo
 * ============================================================
 *
 *  Para adicionar uma corrida, copie um bloco { ... } e altere.
 *  O site separa sozinho, pela data, o que é "próxima corrida"
 *  e o que é "evento realizado".
 *
 *  Campos:
 *    nome        Nome da prova
 *    data        "AAAA-MM-DD"  (deixe "" se ainda não tiver data)
 *    hora        Horário da largada, ex.: "07h00" (opcional)
 *    local       Local / cidade
 *    distancias  Lista de percursos, ex.: ["5 km", "10 km"]
 *    destaque    Frase curta (opcional)
 *    inscricao   Link de inscrição (opcional — se vazio, usa o Linktree)
 *    tema        Cores do card: "fogo", "crea", "hulk", "crefito",
 *                "fhemig", "azul", "vermelho"
 */

const SITE = {
  email: "tardimproducoes.corridas@gmail.com",
  instagram: "https://www.instagram.com/tardimproducoes/",
  linktree: "https://linktr.ee/Tardim",
  // Coloque o WhatsApp com DDI + DDD, só números. Ex.: "5531999999999"
  // Enquanto estiver vazio, o botão de WhatsApp não aparece.
  whatsapp: "",
};

const EVENTOS = [
  {
    nome: "3ª Corrida do Crea-MG",
    data: "2026-12-13",
    hora: "08h00",
    local: "Praça da Assembleia · Santo Agostinho, BH",
    distancias: ["Corrida de rua"],
    destaque: "Kit com camiseta, viseira, pochete e brindes dos patrocinadores.",
    inscricao: "",
    tema: "crea",
  },
  {
    nome: "Circuito do Fogo — 15ª edição",
    data: "2027-02-21",
    hora: "",
    local: "Belo Horizonte · MG",
    distancias: ["Caminhada 3 km", "5 km", "10 km"],
    destaque: "Inscrições abertas! Novidade: Road Runner Challenge.",
    inscricao: "",
    tema: "fogo",
  },

  // ---------- Eventos já realizados ----------
  {
    nome: "Crefito-4 Run · Gov. Valadares",
    data: "2026-11-15",
    local: "Praça Caparaó · Ilha dos Araújos, Gov. Valadares",
    distancias: ["Corrida de rua"],
    tema: "crefito",
  },
  {
    nome: "Corrida FHEMIG",
    data: "2026-11-14",
    local: "Belo Horizonte · MG",
    distancias: ["3,5 km", "10 km"],
    tema: "fhemig",
  },
  {
    nome: "Hulk Run 2026",
    data: "2026-09-28",
    local: "Lagoa da Pampulha · BH",
    distancias: ["Caminhada 3 km", "5 km", "10 km", "Kids"],
    destaque: "Corrida com o Hulk + shows beneficentes.",
    tema: "hulk",
  },
  {
    nome: "Crefito-4 Run · Belo Horizonte",
    data: "2026-08-01",
    local: "Belo Horizonte · MG",
    distancias: ["Corrida de rua"],
    tema: "crefito",
  },
  {
    nome: "Meia Maratona Liberdade 2025",
    data: "2025-12-01",
    local: "Minas Gerais",
    distancias: ["21 km"],
    tema: "hulk",
  },
  {
    nome: "Campeonato Mineiro de Corrida de Rua · 3ª etapa",
    data: "2025-11-01",
    local: "Minas Gerais",
    distancias: ["Corrida de rua"],
    tema: "vermelho",
  },
  {
    nome: "Corrida da Administração · CRA 2025",
    data: "2025-10-01",
    local: "Belo Horizonte · MG",
    distancias: ["Corrida de rua"],
    tema: "azul",
  },
  {
    nome: "Corrida da Guarda Civil Municipal de BH",
    data: "2025-09-01",
    local: "Belo Horizonte · MG",
    distancias: ["Corrida de rua"],
    tema: "crea",
  },
];
