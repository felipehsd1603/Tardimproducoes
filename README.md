# Tardim Produções — site

Site estático (HTML + CSS + JS puro) da **Tardim Produções LTDA**, produtora de corridas de rua e eventos esportivos em Minas Gerais.

## Estrutura

```
index.html          página única
css/style.css       estilos (cores da logo: vermelho #d9545e e azul #2f3f6b)
js/eventos.js       ← LISTA DE CORRIDAS E CONTATOS (edite aqui)
js/main.js          monta os cards, contagem regressiva e menu
assets/             logo, favicon
```

## Como atualizar as corridas

Abra `js/eventos.js` e edite a lista `EVENTOS`. O site separa sozinho, pela data, o que é **próxima corrida** e o que é **evento realizado**, e a contagem regressiva do topo aponta para a próxima prova.

Para ativar o botão de **WhatsApp** (inclusive o botão flutuante), preencha `SITE.whatsapp` com DDI + DDD + número, só dígitos (ex.: `5531999999999`).

## Ver localmente

É só abrir o `index.html` no navegador.

## Publicar (GitHub Pages)

O workflow `.github/workflows/pages.yml` publica o site. Rode-o em **Actions → Deploy static content to Pages → Run workflow**. O endereço fica em `https://felipehsd1603.github.io/TesteFelipe/`.

## Pendências de conteúdo

- Links de inscrição de cada prova (hoje todos apontam para o Linktree).
- Número de WhatsApp.
- Fotos reais dos eventos (os cards hoje usam as cores de cada prova).
- Datas exatas dos eventos já realizados (só o ano aparece no site).
- Revisar o texto da seção "Sobre nós".
