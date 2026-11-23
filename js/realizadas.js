/*
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
 *    edicoes      Edições/etapas realizadas: [{ rotulo, data, cidade, local, obs }]
 *                 (os números do site — corridas e cidades — vêm daqui)
 *    unidade      "etapas" para circuitos (padrão: "edições")
 */

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
    percursos: [
      "Caminhada 3 km",
      "Corrida 5 km",
      "Corrida 10 km",
      "Caminhada Kids 1 km"
    ],
    participantes: "",
    servicos: [
      "Produção da prova",
      "Arena e programação do dia",
      "Divulgação nas redes",
      "Retirada de kit"
    ],
    descricao: "Corrida com o jogador Hulk na Pampulha, com arena, largadas por distância, premiação e shows beneficentes.",
    destaques: [
      "Shows beneficentes com Bruno & Denner e Panda, com a arrecadação destinada a instituições sociais",
      "Patrocínio master da Gerdau",
      "Retirada de kit na Decathlon BH Sul",
      "Programação completa: abertura da arena às 6h, largadas, premiação e show até as 13h"
    ],
    fotos: [
      {
        foto: "assets/fotos/hulk-run-largada.webp",
        legenda: "Largada"
      },
      {
        foto: "assets/fotos/hulk-run-2.webp",
        legenda: "Percurso na Pampulha"
      },
      {
        foto: "assets/fotos/hulk-run-3.webp",
        legenda: "Orla da Pampulha"
      },
      {
        foto: "assets/fotos/hulk-run-1.webp",
        legenda: "Percurso"
      },
      {
        foto: "assets/fotos/hulk-run-medalha.webp",
        legenda: "Medalha"
      }
    ],
    edicoes: [
      {
        rotulo: "Hulk Run 2026",
        data: "2026-09-27",
        cidade: "Belo Horizonte",
        local: "Praça da Pampulha"
      }
    ]
  },
  {
    id: "crefito4-run-2026",
    nome: "Crefito-4 Run 2026",
    ano: "2026",
    logo: "assets/corridas/crefito4-run.webp",
    capa: "assets/fotos/crefito4-run-bh.webp",
    tipo: "Conselho profissional",
    cliente: "Crefito-4 (Conselho Regional de Fisioterapia e Terapia Ocupacional de MG)",
    local: "7 cidades de Minas Gerais",
    percursos: [
      "Corrida 3 km",
      "Corrida 5 km",
      "Corrida 10 km"
    ],
    participantes: "",
    servicos: [
      "Produção das etapas",
      "Retirada de kit",
      "Divulgação"
    ],
    descricao: "Circuito de corridas do Crefito-4 com etapas em diferentes cidades de Minas Gerais.",
    destaques: [
      "Circuito estadual com 7 etapas: Contagem, Uberlândia, Patos de Minas, Juiz de Fora, Belo Horizonte, Poços de Caldas e Governador Valadares",
      "Etapa de Contagem com cerca de 2 mil atletas",
      "Inscrição gratuita para fisioterapeutas e terapeutas ocupacionais inscritos no Crefito-4"
    ],
    fotos: [
      {
        foto: "assets/fotos/crefito4-run-bh.webp",
        legenda: "Etapa Belo Horizonte"
      }
    ],
    unidade: "etapas",
    edicoes: [
      {
        rotulo: "Etapa Contagem",
        data: "2026-07-26",
        cidade: "Contagem",
        local: "Parque Sarandi",
        obs: "cerca de 2 mil atletas"
      },
      {
        rotulo: "Etapa Uberlândia",
        data: "2026-08-16",
        cidade: "Uberlândia"
      },
      {
        rotulo: "Etapa Patos de Minas",
        data: "2026-09-06",
        cidade: "Patos de Minas"
      },
      {
        rotulo: "Etapa Juiz de Fora",
        data: "2026-09-13",
        cidade: "Juiz de Fora"
      },
      {
        rotulo: "Etapa Belo Horizonte",
        data: "2026-09-20",
        cidade: "Belo Horizonte",
        local: "Pampulha"
      },
      {
        rotulo: "Etapa Poços de Caldas",
        data: "2026-09-27",
        cidade: "Poços de Caldas"
      },
      {
        rotulo: "Etapa Governador Valadares",
        data: "2026-11-15",
        cidade: "Governador Valadares",
        local: "Praça Caparaó"
      }
    ]
  },
  {
    id: "campeonato-mineiro",
    nome: "Campeonato Mineiro de Corrida de Rua",
    ano: "2025",
    logo: "assets/corridas/campeonato-mineiro.webp",
    tipo: "Evento próprio",
    unidade: "etapas",
    local: "Belo Horizonte",
    percursos: [
      "Caminhada 3 km",
      "Corrida 5 km",
      "Corrida 10 km"
    ],
    servicos: [
      "Realização e organização de todas as etapas",
      "Chancela junto à Federação Mineira de Atletismo"
    ],
    descricao: "Campeonato estadual de corrida de rua em etapas ao longo do ano, organizado pela Tardim Produções com chancela da Federação Mineira de Atletismo.",
    destaques: [
      "8 etapas em duas temporadas",
      "Chancela da Federação Mineira de Atletismo e percurso aferido pela CBAT"
    ],
    edicoes: [
      {
        rotulo: "2º Campeonato · 1ª etapa",
        data: "2024-03-24",
        cidade: "Belo Horizonte",
        local: "Cidade Administrativa"
      },
      {
        rotulo: "2º Campeonato · 2ª etapa",
        data: "2024-06-09",
        cidade: "Belo Horizonte",
        local: "Cidade Administrativa"
      },
      {
        rotulo: "2º Campeonato · 3ª etapa",
        data: "2024-09-29",
        cidade: "Belo Horizonte",
        local: "Cidade Administrativa"
      },
      {
        rotulo: "2º Campeonato · 4ª etapa",
        data: "2024-11-24",
        cidade: "Belo Horizonte",
        local: "Cidade Administrativa"
      },
      {
        rotulo: "3º Campeonato · 1ª etapa",
        data: "2025-03-23",
        cidade: "Belo Horizonte",
        local: "Coração Eucarístico"
      },
      {
        rotulo: "3º Campeonato · 2ª etapa",
        data: "2025-07-13",
        cidade: "Belo Horizonte",
        local: "Coração Eucarístico"
      },
      {
        rotulo: "3º Campeonato · 3ª etapa",
        data: "2025-09-28",
        cidade: "Belo Horizonte",
        local: "Coração Eucarístico"
      },
      {
        rotulo: "3º Campeonato · 4ª etapa",
        data: "2025-11-23",
        cidade: "Belo Horizonte"
      }
    ]
  },
  {
    id: "corrida-policia-penal",
    nome: "Corrida da Polícia Penal de MG",
    ano: "2026",
    icone: "corrida",
    tipo: "Órgão público",
    cliente: "Sindppen-MG, com a Polícia Penal de Minas Gerais",
    local: "Pampulha, Belo Horizonte",
    participantes: 3000,
    servicos: [
      "Organização da prova",
      "Homologação na Federação Mineira de Atletismo"
    ],
    descricao: "Corrida da Polícia Penal de Minas Gerais, aproximando a força de segurança da população.",
    destaques: [
      "Mais de 3 mil inscritos na primeira edição",
      "Prova homologada pela Federação Mineira de Atletismo"
    ],
    percursos: [
      "Caminhada 3 km",
      "Corrida 5 km",
      "Corrida 10 km"
    ],
    edicoes: [
      {
        rotulo: "1ª Corrida da Polícia Penal de MG",
        data: "2025-10-19",
        cidade: "Belo Horizonte",
        local: "Pampulha",
        obs: "mais de 3 mil inscritos"
      },
      {
        rotulo: "2ª Corrida da Polícia Penal de MG",
        data: "2026-11-22",
        cidade: "Belo Horizonte",
        local: "Praça JK"
      }
    ]
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
    percursos: [
      "Caminhada 3 km",
      "Corrida 5 km",
      "Corrida 10 km"
    ],
    servicos: [
      "Organização da prova"
    ],
    descricao: "Corrida em celebração aos 22 anos da Guarda Civil Municipal de Belo Horizonte.",
    destaques: [
      "Mais de 3 mil participantes",
      "Comemoração dos 22 anos da corporação",
      "Homologada pela Federação Mineira de Atletismo"
    ],
    participantes: 3000,
    edicoes: [
      {
        rotulo: "1ª Corrida da Guarda Civil Municipal de BH",
        data: "2025-08-31",
        cidade: "Belo Horizonte",
        local: "Av. dos Andradas",
        obs: "mais de 3 mil participantes"
      }
    ]
  },
  {
    id: "caminhada-trt3",
    nome: "Caminhada pelo Trabalho Decente e Saúde · TRT-3",
    ano: "2026",
    icone: "corrida",
    tipo: "Órgão público",
    cliente: "TRT-3 (Tribunal Regional do Trabalho da 3ª Região)",
    local: "Funcionários e Savassi, Belo Horizonte",
    percursos: [
      "Caminhada 3 km"
    ],
    servicos: [
      "Produção, organização e execução do evento",
      "Inscrições e kits",
      "Estrutura de largada e chegada"
    ],
    descricao: "Caminhada de rua do Tribunal Regional do Trabalho da 3ª Região, contratada por pregão eletrônico.",
    destaques: [
      "3ª edição com 1.883 inscritos e vagas esgotadas no dia seguinte à abertura, com ampliação por termo aditivo",
      "Contratação por pregão eletrônico",
      "4ª edição realizada em setembro de 2026"
    ],
    participantes: 1883,
    edicoes: [
      {
        rotulo: "3ª Caminhada pelo Trabalho Decente e Saúde",
        data: "2025-12-14",
        cidade: "Belo Horizonte",
        local: "Funcionários e Savassi",
        obs: "1.883 inscritos"
      },
      {
        rotulo: "4ª Caminhada pelo Trabalho Decente e Saúde",
        data: "2026-09-20",
        cidade: "Belo Horizonte"
      }
    ]
  },
  {
    id: "camara-bh-2026",
    nome: "1ª Caminhada e Corrida da Câmara de BH",
    ano: "2026",
    icone: "corrida",
    tipo: "Órgão público",
    cliente: "Câmara Municipal de Belo Horizonte",
    local: "Belo Horizonte",
    servicos: [
      "Organização e realização do evento"
    ],
    descricao: "Primeira caminhada e corrida da Câmara Municipal de Belo Horizonte, contratada por pregão eletrônico.",
    destaques: [
      "Contratação por pregão eletrônico"
    ],
    edicoes: [
      {
        rotulo: "1ª Caminhada e Corrida da Câmara de BH",
        data: "2026-04-26",
        cidade: "Belo Horizonte"
      }
    ]
  },
  {
    id: "circuito-do-fogo",
    nome: "Circuito do Fogo",
    ano: "2026",
    icone: "corrida",
    capa: "assets/corridas/poster-circuito-do-fogo.webp",
    tipo: "Evento próprio",
    local: "Pampulha, Belo Horizonte",
    percursos: [
      "Caminhada 3,2 km",
      "Corrida 5 km",
      "Corrida 10 km"
    ],
    servicos: [
      "Realização e organização da prova",
      "Licenciamento e operação de trânsito",
      "Divulgação"
    ],
    descricao: "Corrida tradicional de Belo Horizonte, realizada pela Tardim Produções na Pampulha.",
    destaques: [
      "Chancela da Federação Mineira de Atletismo",
      "15ª edição marcada para 21 de fevereiro de 2027"
    ],
    edicoes: [
      {
        rotulo: "12ª edição",
        data: "2024-01-14",
        cidade: "Belo Horizonte",
        local: "Pampulha"
      },
      {
        rotulo: "13ª edição",
        data: "2025-01-12",
        cidade: "Belo Horizonte",
        local: "Pampulha"
      },
      {
        rotulo: "14ª edição",
        data: "2026-01-11",
        cidade: "Belo Horizonte",
        local: "Pampulha"
      }
    ]
  },
  {
    id: "corrida-policia-civil-mg",
    nome: "Corrida da Polícia Civil de MG",
    ano: "2026",
    icone: "corrida",
    tipo: "Associação",
    cliente: "CEAPOLC/MG (Caixa Escolar da Academia de Polícia Civil)",
    local: "Praça Nova da Pampulha, Belo Horizonte",
    percursos: [
      "Caminhada 3 km",
      "Corrida 5 km",
      "Corrida 10 km"
    ],
    servicos: [
      "Organização da prova",
      "Homologação na Federação Mineira de Atletismo"
    ],
    descricao: "Corrida anual da Polícia Civil de Minas Gerais, na Pampulha.",
    destaques: [
      "Três edições seguidas organizadas pela Tardim Produções",
      "Homologada pela Federação Mineira de Atletismo"
    ],
    edicoes: [
      {
        rotulo: "3ª edição",
        data: "2024-05-05",
        cidade: "Belo Horizonte",
        local: "Praça Nova da Pampulha"
      },
      {
        rotulo: "4ª edição",
        data: "2025-05-11",
        cidade: "Belo Horizonte",
        local: "Praça Nova da Pampulha"
      },
      {
        rotulo: "5ª edição",
        data: "2026-05-10",
        cidade: "Belo Horizonte",
        local: "Praça Nova da Pampulha"
      }
    ]
  },
  {
    id: "corrida-fhemig-2026",
    nome: "Corrida FHEMIG 2026",
    ano: "2026",
    data: "2026-11-14",
    logo: "assets/corridas/corrida-fhemig.webp",
    tipo: "Órgão público",
    cliente: "FHEMIG (Fundação Hospitalar do Estado de Minas Gerais)",
    local: "Av. Bernardo Monteiro, Belo Horizonte",
    percursos: [
      "3,5 km",
      "10 km"
    ],
    servicos: [
      "Produção da prova",
      "Retirada de kit",
      "Premiação"
    ],
    descricao: "Corrida da Fundação Hospitalar do Estado de Minas Gerais, com premiação em dinheiro.",
    destaques: [
      "Premiação em dinheiro para os primeiros colocados da classificação geral",
      "Retirada de kit na Decathlon (13 e 14 de novembro)"
    ],
    edicoes: [
      {
        rotulo: "Corrida FHEMIG 2026",
        data: "2026-11-14",
        cidade: "Belo Horizonte",
        local: "Av. Bernardo Monteiro",
        obs: "inscrições esgotadas"
      }
    ]
  },
  {
    id: "cro-run",
    nome: "CRO Run",
    ano: "2024",
    icone: "corrida",
    tipo: "Conselho profissional",
    cliente: "CRO-MG (Conselho Regional de Odontologia de MG)",
    unidade: "etapas",
    local: "Belo Horizonte, Governador Valadares e Poços de Caldas",
    percursos: [
      "Corrida 3 km",
      "Corrida 5 km",
      "Corrida 10 km",
      "Kids"
    ],
    servicos: [
      "Organização das etapas"
    ],
    descricao: "Circuito de corridas do Conselho Regional de Odontologia de Minas Gerais, pela saúde bucal.",
    destaques: [
      "Etapas em três cidades de Minas Gerais"
    ],
    edicoes: [
      {
        rotulo: "Etapa Governador Valadares",
        data: "2023-09-17",
        cidade: "Governador Valadares"
      },
      {
        rotulo: "Etapa Belo Horizonte",
        data: "2023-10-29",
        cidade: "Belo Horizonte",
        local: "Savassi"
      },
      {
        rotulo: "Etapa Poços de Caldas",
        data: "2024-04-28",
        cidade: "Poços de Caldas"
      },
      {
        rotulo: "Etapa Belo Horizonte",
        data: "2024-08-25",
        cidade: "Belo Horizonte",
        local: "Praça Lagoa Seca, Belvedere"
      }
    ]
  },
  {
    id: "corrida-crea-mg",
    nome: "Corrida do Crea-MG",
    ano: "2025",
    icone: "corrida",
    capa: "assets/corridas/poster-crea-mg.webp",
    tipo: "Conselho profissional",
    cliente: "Crea-MG (Conselho Regional de Engenharia e Agronomia de MG)",
    local: "Praça da Assembleia, Belo Horizonte",
    servicos: [
      "Organização da prova",
      "Kits e brindes dos patrocinadores"
    ],
    descricao: "Corrida anual do Crea-MG, na Praça da Assembleia.",
    destaques: [
      "3ª edição marcada para 13 de dezembro de 2026"
    ],
    edicoes: [
      {
        rotulo: "1ª Corrida do Crea-MG",
        data: "2024-12-01",
        cidade: "Belo Horizonte",
        local: "Praça da Assembleia"
      },
      {
        rotulo: "2ª Corrida do Crea-MG",
        data: "2025-11-02",
        cidade: "Belo Horizonte",
        local: "Praça da Assembleia"
      }
    ]
  },
  {
    id: "corrida-administracao",
    nome: "Corrida da Administração",
    ano: "2025",
    logo: "assets/corridas/corrida-administracao.webp",
    tipo: "Conselho profissional",
    cliente: "CRA-MG (Conselho Regional de Administração de MG)",
    local: "Belo Horizonte",
    servicos: [
      "Organização da prova"
    ],
    descricao: "Corrida anual do Conselho Regional de Administração de Minas Gerais.",
    edicoes: [
      {
        rotulo: "Corrida da Administração 2023",
        data: "2023-10-01",
        cidade: "Belo Horizonte"
      },
      {
        rotulo: "2ª Corrida da Administração",
        data: "2024",
        cidade: "Belo Horizonte"
      },
      {
        rotulo: "3ª Corrida da Administração",
        data: "2025-09-21",
        cidade: "Belo Horizonte",
        local: "Savassi"
      }
    ]
  },
  {
    id: "maratona-revezamento-bh",
    nome: "Maratona de Revezamento de BH",
    ano: "2025",
    icone: "corrida",
    tipo: "Evento próprio",
    local: "Lagoa da Pampulha, Belo Horizonte",
    percursos: [
      "Maratona em revezamento (42,195 km por equipes)"
    ],
    servicos: [
      "Realização e organização da prova"
    ],
    descricao: "Maratona disputada em equipes de revezamento na orla da Pampulha.",
    destaques: [
      "Chancela da Federação Mineira de Atletismo"
    ],
    edicoes: [
      {
        rotulo: "1ª edição",
        data: "2023-09-30",
        cidade: "Belo Horizonte"
      },
      {
        rotulo: "2ª edição",
        data: "2024-04-07",
        cidade: "Belo Horizonte"
      },
      {
        rotulo: "3ª edição",
        data: "2025-08-10",
        cidade: "Belo Horizonte",
        local: "Orla da Pampulha"
      }
    ]
  },
  {
    id: "corrida-joao-cesar-de-oliveira",
    nome: "Corrida João César de Oliveira",
    ano: "2025",
    icone: "corrida",
    tipo: "Órgão público",
    cliente: "Prefeitura de Contagem",
    local: "Contagem",
    percursos: [
      "Caminhada 3 km",
      "Corrida 5 km",
      "Corrida 10 km"
    ],
    servicos: [
      "Organização da prova"
    ],
    descricao: "Corrida tradicional de Contagem, realizada pela Prefeitura.",
    edicoes: [
      {
        rotulo: "16ª edição",
        data: "2024-05-26",
        cidade: "Contagem"
      },
      {
        rotulo: "17ª edição",
        data: "2025-05-18",
        cidade: "Contagem",
        local: "Av. João César de Oliveira"
      }
    ]
  },
  {
    id: "corrida-contagem-por-todas",
    nome: "Corrida Contagem por Todas",
    ano: "2025",
    icone: "corrida",
    tipo: "Órgão público",
    cliente: "Prefeitura de Contagem",
    local: "Contagem",
    percursos: [
      "Caminhada 3 km",
      "Corrida 5 km",
      "Corrida 10 km"
    ],
    servicos: [
      "Organização da prova"
    ],
    edicoes: [
      {
        rotulo: "4ª edição",
        data: "2025-03-30",
        cidade: "Contagem"
      }
    ]
  },
  {
    id: "corrida-guarda-civil-contagem",
    nome: "1ª Corrida da Guarda Civil de Contagem",
    ano: "2025",
    icone: "corrida",
    tipo: "Órgão público",
    cliente: "Guarda Civil de Contagem",
    local: "Contagem",
    servicos: [
      "Organização da prova"
    ],
    edicoes: [
      {
        rotulo: "1ª edição",
        data: "2025-10-05",
        cidade: "Contagem"
      }
    ]
  },
  {
    id: "volta-noturna-da-lagoa",
    nome: "Volta Noturna da Lagoa",
    ano: "2026",
    icone: "corrida",
    tipo: "Evento próprio",
    local: "Pampulha, Belo Horizonte",
    percursos: [
      "Caminhada 3 km",
      "Corrida 6 km",
      "Corrida 18 km"
    ],
    servicos: [
      "Realização e organização da prova"
    ],
    descricao: "Corrida noturna em volta da Lagoa da Pampulha.",
    destaques: [
      "Chancela da Federação Mineira de Atletismo"
    ],
    edicoes: [
      {
        rotulo: "4ª edição",
        data: "2024-06-01",
        cidade: "Belo Horizonte",
        local: "Praça Nova da Pampulha"
      },
      {
        rotulo: "5ª edição",
        data: "2026-04-04",
        cidade: "Belo Horizonte",
        local: "Praça Iemanjá"
      }
    ]
  },
  {
    id: "meia-maratona-liberdade",
    nome: "Meia Maratona da Liberdade",
    ano: "2025",
    logo: "assets/corridas/meia-maratona-liberdade.webp",
    tipo: "Empresa",
    cliente: "Rádio Liberdade FM 92,9",
    local: "Praça do Encontro, Betim",
    percursos: [
      "Caminhada 3 km",
      "Corrida 5 km",
      "Corrida 10 km",
      "Meia maratona 21 km"
    ],
    servicos: [
      "Organização da prova"
    ],
    destaques: [
      "Apoio da Prefeitura de Betim",
      "Chancela da Federação Mineira de Atletismo"
    ],
    edicoes: [
      {
        rotulo: "1ª edição",
        data: "2024-11-03",
        cidade: "Betim"
      },
      {
        rotulo: "2ª edição",
        data: "2025-10-12",
        cidade: "Betim"
      }
    ]
  },
  {
    id: "corrida-santa-maria-minas",
    nome: "Corrida Santa Maria Minas",
    ano: "2025",
    icone: "corrida",
    tipo: "Instituição de ensino",
    cliente: "Colégio Santa Maria Minas",
    local: "Belo Horizonte",
    percursos: [
      "Corrida 3 km",
      "Corrida 5 km",
      "Corrida 10 km"
    ],
    servicos: [
      "Organização da prova"
    ],
    descricao: "Corrida do Colégio Santa Maria Minas, criada nos 120 anos da escola.",
    edicoes: [
      {
        rotulo: "1ª edição · 120 anos",
        data: "2023-12-03",
        cidade: "Belo Horizonte",
        local: "Pampulha"
      },
      {
        rotulo: "2ª edição",
        data: "2024-12-01",
        cidade: "Belo Horizonte",
        local: "Pampulha"
      },
      {
        rotulo: "3ª edição",
        data: "2025-11-30",
        cidade: "Belo Horizonte",
        local: "Savassi"
      }
    ]
  },
  {
    id: "corrida-do-leao",
    nome: "Corrida do Leão",
    ano: "2026",
    icone: "corrida",
    tipo: "Clube esportivo",
    cliente: "Vila Nova Atlético Clube",
    local: "Nova Lima",
    percursos: [
      "Caminhada 3,2 km",
      "Corrida 5 km",
      "Corrida 10 km"
    ],
    servicos: [
      "Organização da prova"
    ],
    edicoes: [
      {
        rotulo: "1ª edição",
        data: "2025-06-22",
        cidade: "Nova Lima"
      },
      {
        rotulo: "2ª edição",
        data: "2026-06-21",
        cidade: "Nova Lima",
        local: "Praça Bernardino de Lima"
      }
    ]
  },
  {
    id: "corrida-sest-senat",
    nome: "Caminhada e Corrida SEST SENAT",
    ano: "2026",
    icone: "corrida",
    tipo: "Instituição",
    cliente: "SEST SENAT",
    local: "Contagem e Betim",
    servicos: [
      "Organização da prova"
    ],
    edicoes: [
      {
        rotulo: "Etapa Contagem",
        data: "2025-08-17",
        cidade: "Contagem"
      },
      {
        rotulo: "Etapa Betim",
        data: "2026-07-12",
        cidade: "Betim"
      }
    ]
  },
  {
    id: "corrida-servidor-cidade-ativa",
    nome: "Corrida do Servidor e Circuito Cidade Ativa",
    ano: "2024",
    icone: "corrida",
    tipo: "Outros",
    local: "Cidade Administrativa, Belo Horizonte",
    percursos: [
      "Caminhada",
      "Corrida 5 km",
      "Corrida 10 km"
    ],
    servicos: [
      "Organização das provas"
    ],
    descricao: "Corridas para servidores públicos do Estado de Minas Gerais, na Cidade Administrativa.",
    edicoes: [
      {
        rotulo: "Corrida do Servidor · 2ª etapa",
        data: "2023-08-18",
        cidade: "Belo Horizonte",
        local: "Cidade Administrativa"
      },
      {
        rotulo: "Circuito Cidade Ativa · 4ª etapa",
        data: "2023-12-16",
        cidade: "Belo Horizonte",
        local: "Cidade Administrativa"
      },
      {
        rotulo: "2ª Corrida do Servidor Público de MG",
        data: "2024-03-22",
        cidade: "Belo Horizonte",
        local: "Cidade Administrativa"
      },
      {
        rotulo: "Corrida e Caminhada Cidade Ativa",
        data: "2024-11-22",
        cidade: "Belo Horizonte",
        local: "Cidade Administrativa"
      }
    ]
  },
  {
    id: "smile-run-2025",
    nome: "Smile Run · A Corrida da Odonto",
    ano: "2025",
    icone: "corrida",
    tipo: "Associação",
    cliente: "ACAPO (associação de profissionais da odontologia)",
    local: "Praça Lagoa Seca, Belvedere, Belo Horizonte",
    percursos: [
      "Corrida 3 km",
      "Corrida 5 km",
      "Corrida 10 km",
      "Kids"
    ],
    servicos: [
      "Organização da prova, em parceria com a ACAPO"
    ],
    edicoes: [
      {
        rotulo: "Smile Run 2025",
        data: "2025-04-06",
        cidade: "Belo Horizonte",
        local: "Praça Lagoa Seca"
      }
    ]
  },
  {
    id: "circuito-copass-saude-2023",
    nome: "Circuito de Corrida de Rua Copass Saúde",
    ano: "2023",
    icone: "corrida",
    tipo: "Empresa",
    cliente: "Copass Saúde",
    local: "Savassi, Belo Horizonte",
    percursos: [
      "Corrida 3 km",
      "Corrida 5 km",
      "Corrida 10 km"
    ],
    servicos: [
      "Produção da prova"
    ],
    descricao: "Corrida dentro do programa \"A Rua é Nossa\", da Secretaria Municipal de Esportes e Lazer de Belo Horizonte.",
    edicoes: [
      {
        rotulo: "Circuito Copass Saúde 2023",
        data: "2023-05-28",
        cidade: "Belo Horizonte",
        local: "Savassi"
      }
    ]
  },
  {
    id: "corridas-tematicas-2026",
    nome: "Corridas temáticas",
    ano: "2026",
    icone: "corrida",
    tipo: "Evento próprio",
    local: "Belo Horizonte",
    servicos: [
      "Realização e organização das provas"
    ],
    edicoes: [
      {
        rotulo: "Corrida do Dia das Mulheres",
        data: "2026-03-08",
        cidade: "Belo Horizonte",
        local: "Pampulha"
      },
      {
        rotulo: "Corrida do Dia Mundial da Água",
        data: "2026-03-22",
        cidade: "Belo Horizonte",
        local: "Savassi"
      }
    ]
  },
  {
    id: "corrida-do-farmaceutico-2026",
    nome: "Corrida do Farmacêutico",
    ano: "2026",
    icone: "corrida",
    tipo: "Outros",
    local: "Parque Municipal, Belo Horizonte",
    servicos: [
      "Organização da prova"
    ],
    edicoes: [
      {
        rotulo: "Corrida do Farmacêutico 2026",
        data: "2026-05-31",
        cidade: "Belo Horizonte",
        local: "Parque Municipal"
      }
    ]
  },
  {
    id: "meia-maratona-montes-claros-2026",
    nome: "Meia Maratona de Montes Claros José Nardel",
    ano: "2026",
    icone: "corrida",
    tipo: "Outros",
    local: "Montes Claros",
    percursos: [
      "Meia maratona 21 km"
    ],
    servicos: [
      "Organização da prova"
    ],
    edicoes: [
      {
        rotulo: "Meia Maratona de Montes Claros 2026",
        data: "2026-06-28",
        cidade: "Montes Claros"
      }
    ]
  },
  {
    id: "corrida-batalhao-transito-pmmg",
    nome: "Corrida do Cinquentenário do Batalhão de Trânsito",
    ano: "",
    icone: "corrida",
    tipo: "Órgão público",
    cliente: "Batalhão de Trânsito da PMMG",
    local: "Belo Horizonte",
    servicos: [
      "Organização da prova"
    ],
    descricao: "Corrida comemorativa dos 50 anos do Batalhão de Trânsito da Polícia Militar de Minas Gerais.",
    edicoes: [
      {
        rotulo: "Corrida do Cinquentenário do Batalhão de Trânsito",
        data: "",
        cidade: "Belo Horizonte"
      }
    ]
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
      "Fornecimento de equipamentos"
    ],
    descricao: "Serviço contínuo de brigada de incêndio na maior feira de artesanato de Belo Horizonte, contratado pela Prefeitura.",
    destaques: [
      "Contrato de serviço contínuo com a Prefeitura de Belo Horizonte",
      "Renovado por dois termos aditivos"
    ]
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
      "Orçamento e cronograma físico-financeiro"
    ],
    descricao: "Projeto executivo de prevenção e combate a incêndio e pânico para a estatal de tecnologia do Governo de Minas Gerais.",
    destaques: [
      "Contrato de prestação de serviços PS 959/21, de setembro de 2021 a setembro de 2022"
    ]
  }
];
