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
 *    esgotado    true = inscrições esgotadas (o botão vira "Inscrições esgotadas")
 *
 *  Campos da página da prova (todos opcionais; vazio = não aparece):
 *    valores     [{ nome, valor, detalhe, esgotado, ate }]  ("ate": "AAAA-MM-DD" = último dia do lote; o site troca de lote sozinho)
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
  urlBase: "https://tardimproducoes.com.br/",
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
  // desta quantidade de provas abertas. Com poucas provas a lista abaixo já
  // mostra a arte de cada uma, e o carrossel só repetiria as mesmas provas.
  carrosselMinimo: 7,
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
    inscricao: "https://www.ticketsports.com.br/e/3-CORRIDA-DO-CREAMG-88666",
    esgotado: true, // Ticket Sports mostrou ESGOTADO em 23/11/2026
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
    hora: "08h00",
    local: "Praça Nova (Praça Geralda Damata Pimentel), Pampulha, BH",
    percursos: ["Caminhada 3 km", "Corrida 5 km", "Corrida 10 km"],
    resumo: "A 15ª edição do Circuito do Fogo, em Belo Horizonte. Novidade desta edição: o Road Runner Challenge.",
    poster: "assets/corridas/poster-circuito-do-fogo.webp",
    inscricao: "https://www.ticketsports.com.br/e/CIRCUITO-DO-FOGO-15-EDI%C3%87%C3%83O-88793",
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
  {
    id: "corrida-das-mulheres-2027",
    nome: "Corrida das Mulheres 2027",
    data: "2027-03-07",
    hora: "08h00",
    local: "Praça Carlos Chagas (Praça da Assembleia Legislativa), Santo Agostinho, BH",
    percursos: ["Caminhada 3 km", "Corrida 6 km"],
    resumo: "",
    poster: "assets/corridas/poster-corrida-das-mulheres.webp",
    inscricao: "",
    valores: [],
    kit: { itens: [], retirada: "" },
    programacao: [],
    premiacao: "",
    percursoMapa: "",
    regulamento: "",
    resultados: "",
    fotos: "",
    realizacao: "",
  },
  {
    id: "volta-noturna-da-lagoa-2027",
    nome: "6ª Volta Noturna da Lagoa",
    data: "2027-03-27",
    hora: "19h30",
    local: "Praça Dalvo Simão (Praça Iemanjá), Pampulha, BH",
    percursos: ["Corrida 5 km", "Corrida 18 km"],
    resumo: "",
    poster: "assets/corridas/poster-volta-noturna-da-lagoa.webp",
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
  { foto: "assets/fotos/hulk-run-percurso-0.webp", legenda: "Hulk Run 2026 · Foto: @fotosgabii_", alt: "Corredor fazendo joinha durante a Hulk Run" },
  { foto: "assets/fotos/hulk-run-percurso-1.webp", legenda: "Hulk Run 2026 · Foto: @fotosgabii_", alt: "Corredor comemorando com os braços erguidos no percurso da Hulk Run" },
  { foto: "assets/fotos/hulk-run-percurso-10.webp", legenda: "Hulk Run 2026 · Foto: @fotosgabii_", alt: "Corredora fazendo sinal de paz com as duas mãos na Hulk Run" },
  { foto: "assets/fotos/crefito4-run-bh.webp", legenda: "Crefito-4 Run 2026 · Etapa Belo Horizonte", alt: "Corredora sorrindo na arena da Crefito-4 Run" },
  { foto: "assets/fotos/policia-civil-2026-1.webp", legenda: "Corrida da Polícia Civil 2026 · Foto: @josycastro_fotop", alt: "Corredora acenando no meio do pelotão da Corrida da Polícia Civil" },
  { foto: "assets/fotos/policia-penal-2025-1.webp", legenda: "1ª Corrida da Polícia Penal · Foto: @josycastro_fotop", alt: "Corredora comemorando com os braços erguidos na Corrida da Polícia Penal" },
  { foto: "assets/fotos/policia-civil-2026-4.webp", legenda: "Corrida da Polícia Civil 2026 · Foto: @josycastro_fotop", alt: "Corredora erguendo o celular e sorrindo na Corrida da Polícia Civil" },
  { foto: "assets/fotos/volta-noturna-2026-1.webp", legenda: "5ª Volta Noturna da Lagoa · Foto: @paulopeninha", alt: "Cinco corredores com medalhas depois da Volta Noturna da Lagoa" },
  { foto: "assets/fotos/policia-penal-2025-3.webp", legenda: "1ª Corrida da Polícia Penal · Foto: @josycastro_fotop", alt: "Corredor mostrando os braços na Corrida da Polícia Penal" },
  { foto: "assets/fotos/policia-civil-2026-2.webp", legenda: "Corrida da Polícia Civil 2026 · Foto: @josycastro_fotop", alt: "Corredor mostrando o braço durante a Corrida da Polícia Civil" },
  { foto: "assets/fotos/policia-penal-2025-2.webp", legenda: "1ª Corrida da Polícia Penal · Foto: @josycastro_fotop", alt: "Corredor de óculos escuros à frente do pelotão na Corrida da Polícia Penal" },
  { foto: "assets/fotos/policia-civil-2026-3.webp", legenda: "Corrida da Polícia Civil 2026 · Foto: @josycastro_fotop", alt: "Corredora sorrindo no percurso da Corrida da Polícia Civil" },
  { foto: "assets/fotos/hulk-run-percurso-2.webp", legenda: "Hulk Run 2026 · Orla da Pampulha · Foto: @fotosgabii_", alt: "Corredora mostrando os braços na orla da Pampulha durante a Hulk Run" },
  { foto: "assets/fotos/hulk-run-percurso-4.webp", legenda: "Hulk Run 2026 · Foto: @fotosgabii_", alt: "Corredor sorrindo em plena passada na Hulk Run" },
  { foto: "assets/fotos/hulk-run-percurso-7.webp", legenda: "Hulk Run 2026 · Foto: @fotosgabii_", alt: "Corredor de óculos escuros correndo na Hulk Run" },
  { foto: "assets/fotos/hulk-run-medalha.webp", legenda: "Medalha da Hulk Run 2026", alt: "Medalha da Hulk Run 2026 com dados de corrida" },
  { foto: "assets/fotos/hulk-run-3.webp", legenda: "Hulk Run 2026 · Orla da Pampulha", alt: "Corredor sorrindo na orla da Pampulha" },
  { foto: "assets/fotos/hulk-run-1.webp", legenda: "Hulk Run 2026", alt: "Corredor durante a Hulk Run" },
];

/*
 *  LOTES: situação de cada valor da prova e o menor preço que vale hoje.
 *  Usado no calendário (js/main.js) e na página da prova (js/prova.js).
 *  Em "valores", o campo opcional "ate" (AAAA-MM-DD) é o último dia do lote; os
 *  lotes com data ficam na ordem em que acontecem. Estados de cada linha:
 *    esgotado | encerrado (a data passou) | atual (lote que vale hoje) |
 *    futuro (com "inicio" = dia seguinte ao lote anterior) | fixo (sem data)
 */
function LOTES(ev, agora) {
  var d = agora || new Date();
  var hoje = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  var temAtual = false, anterior = "", menor = null;
  var linhas = (ev.valores || []).map(function (v) {
    var l = { v: v, estado: "fixo", inicio: "" };
    if (v.ate) {
      if (v.esgotado) l.estado = "esgotado";
      else if (v.ate < hoje) l.estado = "encerrado";
      else if (!temAtual) { l.estado = "atual"; temAtual = true; }
      else {
        l.estado = "futuro";
        var p = anterior.split("-").map(Number), ini = new Date(p[0], p[1] - 1, p[2] + 1);
        if (anterior) l.inicio = ini.getFullYear() + "-" + String(ini.getMonth() + 1).padStart(2, "0") + "-" + String(ini.getDate()).padStart(2, "0");
      }
      anterior = v.ate;
    } else if (v.esgotado) l.estado = "esgotado";
    if (l.estado === "atual" || l.estado === "fixo") {
      var r = /R\$\s*([\d.]+(?:,\d{1,2})?)/.exec(v.valor || "");
      var n = r ? Number(r[1].replace(/\./g, "").replace(",", ".")) : 0;
      if (n > 0 && (!menor || n < menor.n)) menor = { n: n, txt: "R$ " + r[1], nome: v.nome || "", ate: l.estado === "atual" ? v.ate : "" };
    }
    return l;
  });
  return { linhas: linhas, menor: menor };
}
