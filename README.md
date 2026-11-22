# Tardim Produções — site

Site estático (HTML + CSS + JS puro) da **Tardim Produções LTDA**, produtora de corridas de rua e eventos esportivos em Minas Gerais.

## Estrutura

```
index.html          página inicial
prova.html          página de cada prova (prova.html?id=...)
portfolio.html      portfólio de eventos realizados
evento.html         estudo de caso de cada evento (evento.html?id=...)
css/style.css       estilos (cores da logo: vermelho #d6505b e azul #24325a)
js/eventos.js       ← CALENDÁRIO, PROVAS REALIZADAS E CONTATOS (edite aqui)
js/main.js          monta a página inicial (calendário, próxima prova, menu)
js/prova.js         monta a página de cada prova (com breadcrumb)
js/portfolio.js     monta o portfólio e o estudo de caso
js/demo.js          modo demonstração (só com ?demo=1)
assets/demo/        imagens fictícias do modo demonstração
assets/corridas/    logos e artes das provas
assets/fotos/       fotos dos eventos
```

## Como atualizar as corridas

Abra `js/eventos.js`:

- `PROXIMAS`: provas com data. Cada prova tem um `id` e ganha uma página própria (`prova.html?id=...`) com informações, valores, kit, programação, percurso, regulamento e resultados. Campos vazios não aparecem, e a página avisa o que ainda vai ser publicado. Coloque a arte da prova em `assets/corridas/` e aponte no campo `poster`. Quando a data passa, a prova sai do calendário sozinha.
- `REALIZADAS`: portfólio de eventos já realizados. Cada evento ganha uma página de estudo de caso (`evento.html?id=...`) com ficha técnica (cliente, data, local, percursos, participantes), serviços prestados, destaques, fotos e depoimento. Campos vazios não aparecem. Os números do topo do portfólio (eventos, instituições atendidas e participantes) são calculados sozinhos.
- `GALERIA`: fotos do carrossel "Na rua com a Tardim Produções" (foto, legenda e descrição). Coloque as fotos em `assets/fotos/`.
- `SITE.carrosselMinimo`: a partir de quantas provas abertas o carrossel com as artes aparece no calendário (padrão: 3).

No mesmo arquivo, o objeto `SITE` guarda o **WhatsApp** (DDI + DDD + número, só dígitos) e os **dados da empresa** (razão social, CNPJ, endereço). Campos vazios não aparecem no site.

## Modo demonstração

Abra `index.html?demo=1` para ver o site com provas e imagens **fictícias** (Corrida Kids de Natal, Corrida da Lagoa, Desafio 10K, Corrida Noturna e Meia Maratona da Serra). Serve para mostrar como o calendário por mês, o filtro de distância, o carrossel das artes e a página completa da prova ficam com várias provas. Há um aviso no topo e o selo "Exemplo" em cada prova fictícia, e a demonstração não é indexada pelo Google. O site normal, sem `?demo=1`, mostra só as provas reais.

## Depois de editar CSS ou JS

No `index.html`, troque o número `?v=...` dos arquivos `css/style.css`, `js/eventos.js` e `js/main.js` (por exemplo, `?v=20261122-1` para `?v=20261122-2`). Assim o navegador dos visitantes baixa a versão nova em vez de usar a cópia antiga em cache.

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
- Portfólio: cliente, número de participantes, serviços, fotos e depoimento de cada evento.
