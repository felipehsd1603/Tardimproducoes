# Tardim Produções — site

Site estático (HTML + CSS + JS puro) da **Tardim Produções LTDA**, produtora de corridas de rua e eventos esportivos em Minas Gerais.

## Estrutura

```
index.html          página inicial
prova.html          página de cada prova (prova.html?id=...)
css/style.css       estilos (cores da logo: vermelho #d6505b e azul #24325a)
js/eventos.js       ← CALENDÁRIO, PROVAS REALIZADAS E CONTATOS (edite aqui)
js/main.js          monta a página inicial (calendário, próxima prova, menu)
js/prova.js         monta a página de cada prova
assets/corridas/    logos e artes das provas
assets/fotos/       fotos dos eventos
```

## Como atualizar as corridas

Abra `js/eventos.js`:

- `PROXIMAS`: provas com data. Cada prova tem um `id` e ganha uma página própria (`prova.html?id=...`) com informações, valores, kit, programação, percurso, regulamento e resultados. Campos vazios não aparecem, e a página avisa o que ainda vai ser publicado. Coloque a arte da prova em `assets/corridas/` e aponte no campo `poster`. Quando a data passa, a prova sai do calendário sozinha.
- `REALIZADAS`: logos das provas já feitas (imagem quadrada em `assets/corridas/`).

No mesmo arquivo, o objeto `SITE` guarda o **WhatsApp** (DDI + DDD + número, só dígitos) e os **dados da empresa** (razão social, CNPJ, endereço). Campos vazios não aparecem no site.

## Depois de editar CSS ou JS

No `index.html`, troque o número `?v=...` dos arquivos `css/style.css`, `js/eventos.js` e `js/main.js` (por exemplo, `?v=20261122-1` para `?v=20261122-2`). Assim o navegador dos visitantes baixa a versão nova em vez de usar a cópia antiga em cache.

## Ver localmente

É só abrir o `index.html` no navegador.

## Publicar (GitHub Pages)

O workflow `.github/workflows/pages.yml` publica o site. Rode-o em **Actions → Deploy static content to Pages → Run workflow**. O endereço fica em `https://felipehsd1603.github.io/TesteFelipe/`.

## Pendências de conteúdo

- Links de inscrição de cada prova (hoje todos apontam para o Linktree).
- Retirada de kit, mapa do percurso e regulamento de cada prova.
- CNPJ e endereço (seção Institucional).
- Contratante e número de participantes de cada prova.
- Logos e fotos em alta resolução (as atuais foram recortadas de prints do Instagram).
- Conferir o ano da Corrida da Guarda Civil Municipal.
