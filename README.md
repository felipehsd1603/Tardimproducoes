# Tardim Produções — site

Site estático (HTML + CSS + JS puro) da **Tardim Produções LTDA**, produtora de corridas de rua e eventos esportivos em Minas Gerais.

## Estrutura

```
index.html          página inicial
prova.html          página de cada prova (prova.html?id=...)
portfolio.html      portfólio de trabalhos (eventos e serviços)
evento.html         página de cada trabalho do portfólio (evento.html?id=...)
privacidade.html    política de privacidade (LGPD)
css/style.css       estilos (cores da logo: vermelho #d6505b e azul #24325a)
js/eventos.js       ← CALENDÁRIO, PROVAS REALIZADAS E CONTATOS (edite aqui)
js/main.js          monta a página inicial (calendário, próxima prova, menu)
js/prova.js         monta a página de cada prova (com breadcrumb)
js/portfolio.js     monta o portfólio e a página de cada trabalho
js/orcamento.js     pedido de orçamento: monta a mensagem e abre o WhatsApp ou o e-mail
js/mapa.js          mapa de Minas "Onde já corremos" (conta as corridas por cidade sozinho)
js/ui.js            animações, barra de percurso no topo e fotos em tela cheia
js/demo.js          modo demonstração (só com ?demo=1)
assets/fonts/       fontes Barlow e Barlow Condensed (hospedadas no próprio site)
assets/demo/        imagens fictícias do modo demonstração
assets/corridas/    logos e artes das provas
assets/fotos/       fotos dos eventos
```

## Como atualizar as corridas

Abra `js/eventos.js`:

- `PROXIMAS`: provas com data. Cada prova tem um `id` e ganha uma página própria (`prova.html?id=...`) com informações, valores, kit, programação, percurso, regulamento e resultados. Campos vazios não aparecem, e a página avisa o que ainda vai ser publicado. Coloque a arte da prova em `assets/corridas/` e aponte no campo `poster`. Quando a data passa, a prova sai do calendário sozinha.
- O **calendário** da página inicial tem duas abas: *Próximas* (de `PROXIMAS`) e *Edições anteriores* (todas as edições/etapas das corridas em `REALIZADAS`, da mais recente para a mais antiga), com busca e filtros por ano, mês e distância.
- `REALIZADAS`: portfólio de trabalhos realizados, separados por área (eventos esportivos ou prevenção contra incêndio). Cada trabalho ganha uma página (`evento.html?id=...`) com ficha técnica (cliente, data, local, percursos, participantes), serviços prestados, destaques, fotos e depoimento. Campos vazios não aparecem. Os números do topo do portfólio (trabalhos, eventos, serviços de prevenção, instituições atendidas e participantes) são calculados sozinhos.
- `GALERIA`: fotos do carrossel "Na rua com a Tardim Produções" (foto, legenda e descrição). Coloque as fotos em `assets/fotos/`.
- `SITE.carrosselMinimo`: a partir de quantas provas abertas o carrossel com as artes aparece no calendário (padrão: 3).

No mesmo arquivo, o objeto `SITE` guarda o **WhatsApp** (DDI + DDD + número, só dígitos) e os **dados da empresa** (razão social, CNPJ, endereço). Campos vazios não aparecem no site.

## Pedido de orçamento

A seção "Peça seu orçamento" da página inicial não envia nada para servidor: ela monta a mensagem no aparelho da pessoa e abre o WhatsApp (`SITE.whatsapp`) ou o e-mail (`SITE.email`) com o texto pronto. Botões com `data-orc="corrida"` (ou outro serviço) levam ao formulário com a opção já marcada.

## Modo demonstração

Abra `index.html?demo=1` para ver o site com provas e imagens **fictícias** (Corrida Kids de Natal, Corrida da Lagoa, Desafio 10K, Corrida Noturna e Meia Maratona da Serra). Serve para mostrar como o calendário por mês, o filtro de distância, o carrossel das artes e a página completa da prova ficam com várias provas. Há um aviso no topo e o selo "Exemplo" em cada prova fictícia, e a demonstração não é indexada pelo Google. O site normal, sem `?demo=1`, mostra só as provas reais.

## Depois de editar CSS ou JS

Em todas as páginas (`index.html`, `prova.html`, `portfolio.html`, `evento.html` e `scripts/404-modelo.html`), troque o número `?v=...` dos arquivos CSS e JS (por exemplo, `?v=20261122-1` para `?v=20261122-2`). Assim o navegador dos visitantes baixa a versão nova em vez de usar a cópia antiga em cache.

## Páginas geradas automaticamente

O script `scripts/gerar-paginas.js` cria, a partir do `js/eventos.js`:

- `prova-<id>.html`: uma página por prova, com a prévia certa (arte e título) ao compartilhar no WhatsApp;
- `trabalho-<id>.html`: uma página por trabalho do portfólio, também com prévia própria;
- `sitemap.xml` e `robots.txt`, para o Google;
- `404.html`, a página de erro com a cara da Tardim Produções.

Ele roda sozinho a cada publicação (workflow do GitHub Pages). Para ver localmente depois de editar o `eventos.js`, rode `node scripts/gerar-paginas.js`.

Ao trocar para domínio próprio, mude `SITE.urlBase` no `js/eventos.js`.

## Mapa "Onde já corremos"

O mapa conta as corridas de cada cidade a partir das edições em `REALIZADAS`. Belo Horizonte, Contagem, Betim e Nova Lima aparecem juntas como "Grande BH". Para uma cidade nova aparecer no mapa, coloque a posição dela em `CIDADES_MAPA` no `js/mapa.js` (e, se o nome encostar em outro, o lado do nome em `LADO`).

## Ver localmente

É só abrir o `index.html` no navegador.

## Publicar (GitHub Pages)

O workflow `.github/workflows/pages.yml` publica o site. Rode-o em **Actions → Deploy static content to Pages → Run workflow**. O endereço fica em `https://felipehsd1603.github.io/TesteFelipe/`.

## Pendências de conteúdo

- Links de inscrição de cada prova (hoje todos apontam para o Linktree).
- Retirada de kit, mapa do percurso e regulamento de cada prova.
- Endereço (seção Institucional), se for para aparecer no site.
- Lista completa dos CNAEs pelo Comprovante de Inscrição do CNPJ na Receita Federal.
- Contratante e número de participantes de cada prova.
- Logos e fotos em alta resolução (as atuais foram recortadas de prints do Instagram).
- Conferir o ano da Corrida da Guarda Civil Municipal.
- Portfólio: número de participantes, fotos e depoimento de cada prova; data da 2ª Corrida da Administração (2024) e da Corrida do Cinquentenário do Batalhão de Trânsito.
