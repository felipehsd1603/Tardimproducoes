/*
 * MODO DEMONSTRAÇÃO
 * Só funciona quando o endereço tem ?demo=1 (ex.: index.html?demo=1).
 * Acrescenta provas e fotos FICTÍCIAS para mostrar como o site fica com
 * várias provas no calendário. O site normal não é afetado.
 */
(function () {
  "use strict";
  if (!/[?&]demo=1(&|$)/.test(location.search)) return;
  window.DEMO = true;

  // Não indexar a demonstração no Google
  var robots = document.createElement("meta");
  robots.name = "robots";
  robots.content = "noindex";
  document.head.appendChild(robots);

  var exemplos = [
    {
      id: "demo-corrida-kids",
      nome: "Corrida Kids de Natal",
      data: "2026-12-20",
      hora: "08h00",
      local: "Parque Municipal, Centro, BH",
      percursos: ["Kids 1 km", "Kids 2 km", "Kids 3 km"],
      resumo: "Prova fictícia de demonstração: corrida para crianças de 4 a 14 anos, com medalha para todos os participantes.",
      poster: "assets/demo/poster-kids.jpg",
      valores: [
        { nome: "1º lote", valor: "R$ 49,90", detalhe: "até 30/11", esgotado: true },
        { nome: "2º lote", valor: "R$ 59,90", detalhe: "até 15/12" },
      ],
      kit: { itens: ["Camiseta infantil", "Número de peito", "Medalha de participação"], retirada: "18 e 19/12, das 10h às 18h, em loja parceira (exemplo)." },
      programacao: [["07h00", "Abertura da arena"], ["07h45", "Aquecimento com recreadores"], ["08h00", "Largada 1 km"], ["08h20", "Largada 2 km"], ["08h40", "Largada 3 km"], ["09h30", "Entrega de medalhas"]],
      premiacao: "Medalha de participação para todas as crianças que completarem o percurso.",
      percursoMapa: "#", regulamento: "#",
      realizacao: "Tardim Produções",
    },
    {
      id: "demo-corrida-lagoa",
      nome: "Corrida da Lagoa",
      data: "2027-01-17",
      hora: "07h00",
      local: "Orla da Lagoa da Pampulha, BH",
      percursos: ["Caminhada 3 km", "Corrida 5 km", "Corrida 10 km"],
      resumo: "Prova fictícia de demonstração na orla da Pampulha, com arena, show e premiação por faixa etária.",
      poster: "assets/demo/poster-lagoa.jpg",
      valores: [
        { nome: "1º lote", valor: "R$ 89,90", detalhe: "até 15/12", esgotado: true },
        { nome: "2º lote", valor: "R$ 99,90", detalhe: "até 05/01" },
        { nome: "60+ e PcD", valor: "50% de desconto" },
      ],
      kit: { itens: ["Camiseta técnica", "Número de peito com chip", "Sacochila", "Medalha de finisher"], retirada: "15 e 16/01, das 10h às 20h (exemplo)." },
      programacao: [["05h30", "Abertura da arena"], ["06h40", "Aquecimento"], ["07h00", "Largada 10 km"], ["07h15", "Largada 5 km"], ["07h30", "Largada caminhada"], ["09h00", "Premiação"]],
      premiacao: "Troféu para os 5 primeiros colocados geral (masculino e feminino) e para os 3 primeiros de cada faixa etária.",
      percursoMapa: "#", regulamento: "#", resultados: "#", fotos: "#",
      realizacao: "Tardim Produções",
    },
    {
      id: "demo-desafio-10k",
      nome: "Desafio 10K",
      data: "2027-02-07",
      hora: "06h30",
      local: "Praça da Liberdade, Funcionários, BH",
      percursos: ["Corrida 10 km"],
      resumo: "Prova fictícia de demonstração: 10 km pelas ruas da região central, com percurso homologado.",
      poster: "assets/demo/poster-10k.jpg",
      valores: [{ nome: "Lote único", valor: "R$ 119,90" }],
      kit: { itens: ["Camiseta técnica", "Número de peito com chip", "Medalha"], retirada: "" },
      programacao: [["05h30", "Abertura da arena"], ["06h30", "Largada"], ["08h30", "Premiação"]],
      realizacao: "Empresa parceira (exemplo)",
    },
    {
      id: "demo-corrida-noturna",
      nome: "Corrida Noturna",
      data: "2027-03-06",
      hora: "19h30",
      local: "Mineirão, Pampulha, BH",
      percursos: ["Corrida 5 km", "Corrida 10 km"],
      resumo: "Prova fictícia de demonstração à noite, com kit iluminado e show na chegada.",
      poster: "assets/demo/poster-noturna.jpg",
      valores: [{ nome: "1º lote", valor: "R$ 109,90" }],
      kit: { itens: ["Camiseta", "Pulseira de LED", "Medalha"], retirada: "" },
      programacao: [],
      realizacao: "Tardim Produções",
    },
    {
      id: "demo-meia-serra",
      nome: "Meia Maratona da Serra",
      data: "2027-04-18",
      hora: "06h00",
      local: "Praça do Papa, Mangabeiras, BH",
      percursos: ["Corrida 10 km", "Meia maratona 21 km"],
      resumo: "Prova fictícia de demonstração com subidas e vista da cidade.",
      poster: "assets/demo/poster-serra.jpg",
      valores: [],
      kit: { itens: [], retirada: "" },
      programacao: [],
      realizacao: "Tardim Produções",
    },
  ];
  exemplos.forEach(function (e) { e.demo = true; PROXIMAS.push(e); });

  // Casos fictícios no portfólio, com todos os campos preenchidos
  if (typeof REALIZADAS !== "undefined") {
    [
      {
        id: "demo-run-corporativa",
        nome: "Run Corporativa 2026",
        ano: "2026",
        data: "2026-08-23",
        logo: "assets/demo/logo-corporativa.jpg",
        capa: "assets/demo/foto-largada.jpg",
        tipo: "Empresa",
        cliente: "Empresa Exemplo S.A. (fictícia)",
        local: "Lagoa da Pampulha, Belo Horizonte",
        percursos: ["Caminhada 3 km", "Corrida 5 km", "Corrida 10 km"],
        participantes: 2400,
        servicos: ["Planejamento e conceito da prova", "Regularização e licenciamento", "Percurso, arena e cronometragem", "Kits e medalhas personalizados", "Divulgação para colaboradores", "Shows e ativações dos patrocinadores"],
        descricao: "Caso fictício de demonstração: corrida aberta ao público com a marca da empresa, para celebrar seus 30 anos.",
        destaques: ["2.400 inscritos em 18 dias", "Arena com ativações de 6 marcas parceiras", "Ação social com doação de alimentos", "98% dos participantes avaliaram o evento como ótimo ou bom"],
        fotos: [
          { foto: "assets/demo/foto-largada.jpg", legenda: "Largada (ilustrativa)" },
          { foto: "assets/demo/foto-pelotao.jpg", legenda: "Pelotão (ilustrativa)" },
          { foto: "assets/demo/foto-orla.jpg", legenda: "Percurso na orla (ilustrativa)" },
          { foto: "assets/demo/foto-chegada.jpg", legenda: "Chegada (ilustrativa)" },
        ],
        depoimento: { texto: "A Tardim Produções cuidou de tudo, das licenças à premiação. Nossos colaboradores pedem a próxima edição.", autor: "Nome Fictício", cargo: "Gerente de Marketing, Empresa Exemplo S.A." },
      },
      {
        id: "demo-10k-conselho",
        nome: "10K do Conselho 2025",
        ano: "2025",
        logo: "assets/demo/logo-conselho.jpg",
        capa: "assets/demo/foto-amanhecer.jpg",
        tipo: "Conselho profissional",
        cliente: "Conselho Regional Exemplo (fictício)",
        local: "Praça da Liberdade, Belo Horizonte",
        percursos: ["Corrida 5 km", "Corrida 10 km"],
        participantes: 1200,
        servicos: ["Produção da prova", "Regularização e licenciamento", "Inscrições com desconto para profissionais", "Retirada de kit"],
        descricao: "Caso fictício de demonstração: corrida anual do conselho, contratada por licitação.",
        destaques: ["Contratação por processo licitatório", "Inscrição com 50% de desconto para profissionais registrados", "Percurso homologado"],
        fotos: [
          { foto: "assets/demo/foto-amanhecer.jpg", legenda: "Largada ao amanhecer (ilustrativa)" },
          { foto: "assets/demo/foto-kids.jpg", legenda: "Arena (ilustrativa)" },
        ],
        depoimento: { texto: "Equipe organizada e documentação impecável, o que fez toda a diferença no processo de contratação.", autor: "Nome Fictício", cargo: "Assessoria de Comunicação, Conselho Regional Exemplo" },
      },
    ].forEach(function (e) { e.demo = true; REALIZADAS.unshift(e); });
  }

  if (typeof GALERIA !== "undefined") {
    [["foto-largada.jpg", "Largada (foto ilustrativa)"], ["foto-pelotao.jpg", "Pelotão (foto ilustrativa)"],
      ["foto-chegada.jpg", "Chegada (foto ilustrativa)"], ["foto-orla.jpg", "Orla (foto ilustrativa)"],
      ["foto-kids.jpg", "Corrida kids (foto ilustrativa)"], ["foto-amanhecer.jpg", "Amanhecer (foto ilustrativa)"]]
      .forEach(function (f) { GALERIA.push({ foto: "assets/demo/" + f[0], legenda: f[1], alt: f[1] }); });
  }

  // Aviso no topo da página
  document.addEventListener("DOMContentLoaded", function () {
    var aviso = document.createElement("div");
    aviso.className = "demo-bar";
    aviso.innerHTML = "<strong>Demonstração:</strong> provas e imagens marcadas como exemplo são fictícias. " +
      '<a href="' + location.pathname.replace(/[^/]*$/, "") + 'index.html">Ver o site real</a>';
    document.body.insertBefore(aviso, document.body.firstChild);
  });
})();
