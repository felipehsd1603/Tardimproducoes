# Tardim Produções — site

Site estático (HTML + CSS + JS puro) da **Tardim Produções LTDA**, produtora de corridas de rua e eventos esportivos em Minas Gerais.

Hospedado no **Cloudflare Pages** (plano gratuito), com funções em `functions/` e banco de dados **Cloudflare D1**. Repositório: `felipehsd1603/tardimproducoes`. Domínio: `tardimproducoes.com.br` (registrado no Registro.br). Veja [Publicar](#publicar-cloudflare-pages), [Banco de dados](#banco-de-dados-cloudflare-d1) e [Domínio](#domínio).

## Estrutura

```
index.html          página inicial (para quem corre)
empresas.html       página de quem contrata: serviços, "Sua corrida do começo ao fim", simulador e orçamento
prova.html          página de cada prova (prova.html?id=...)
portfolio.html      portfólio de trabalhos (eventos e serviços)
evento.html         página de cada trabalho do portfólio (evento.html?id=...)
institucional.html  página para órgãos públicos e conselhos (credenciais e instituições atendidas)
privacidade.html    política de privacidade (LGPD)
css/style.css       estilos (cores da logo: vermelho #d6505b e azul #24325a)
js/eventos.js       ← CONTATOS, CALENDÁRIO E GALERIA (edite aqui)
js/realizadas.js    ← PORTFÓLIO: trabalhos realizados (edite aqui)
js/main.js          monta a página inicial (calendário, próxima prova, menu)
js/prova.js         monta a página de cada prova (com breadcrumb)
js/portfolio.js     monta o portfólio e a página de cada trabalho
js/orcamento.js     pedido de orçamento: monta a mensagem, abre o WhatsApp ou o e-mail e guarda uma cópia no banco
js/monte.js         simulador "Monte sua corrida" (leva a configuração para o orçamento)
js/extras.js        previsão do tempo, card "Eu vou correr!" e calculadora de ritmo
js/assessorias.js   inscrição coletiva: modelo de planilha, conferência e envio (assessorias.html)
js/convite.js       gera e lê o código do link de convite de cada assessoria
js/gerar-convite.js gerador antigo de links (link-assessoria.html); não é mais usado, o link sai do painel
js/equipe.js        página pública da equipe, para os atletas (equipe.html)
js/vendor/          SheetJS (lê e gera planilhas na página de assessorias) e ExcelJS (gera o modelo com cores, logos e listas)
js/mapa.js          mapa de Minas "Onde já corremos" (conta as corridas por cidade sozinho)
js/ui.js            animações, barra de percurso no topo e fotos em tela cheia
js/demo.js          modo demonstração (só com ?demo=1)
assets/fonts/       fontes Barlow e Barlow Condensed (hospedadas no próprio site)
assets/demo/        imagens fictícias do modo demonstração
assets/corridas/    logos e artes das provas
assets/fotos/       fotos dos eventos
functions/api/orcamento.js  função POST /api/orcamento: valida e grava o pedido de orçamento no D1
d1/migracoes/012-contratos.sql  do orçamento ao contrato assinado (aba "Propostas"): dados da empresa e modelo do contrato (tabela configuracoes) e o PDF assinado de cada proposta (tabela contratos_assinados, só sai pela API do painel). Banco já criado: rode esta migração
d1/migracoes/011-minutario.sql  minutário (botão na aba "Propostas"): itens padrão das propostas, com descrição, valor unitário e quantidade de referência; a proposta traz os itens de lá e mostra tudo em tabela. Banco já criado: rode esta migração
d1/migracoes/010-propostas.sql  aba "Propostas" do painel: monta o orçamento do cliente (itens, somas, valor por extenso), imprime em PDF e copia os dados para o contrato. Banco já criado: rode esta migração
_redirects          endereços curtos para divulgar (ex.: /copmbm leva à página da prova)
functions/api/evento.js     função POST /api/evento: medição do site (js/ui.js): soma totais por dia de visitas e cliques, sem identificar ninguém; o painel mostra na aba "Medição". Banco já criado: rode d1/migracoes/009-medicao-faq.sql (cria a medição e as perguntas frequentes das provas)
functions/api/inscricao.js  função POST /api/inscricao: valida e grava a inscrição coletiva (equipe + atletas) no D1
admin.html          painel da Tardim Produções (fora do menu e do Google): js/admin.js + css/painel.css
kit.html            kit de divulgação de cada parceiro: js/kit.js
programa-embaixadores.html  regras do programa de embaixadores
js/provas-db.js     provas e depoimentos do painel (no Cloudflare é respondido pelo banco; o arquivo é só reserva)
                    depoimentos: aba "Depoimentos" do painel; aparecem na página inicial e ao lado do orçamento em empresas.html (js/ui.js). Banco já criado: rode d1/migracoes/008-depoimentos.sql
functions/api/admin/[[rota]].js  API do painel: login, provas, parceiros, convites, imagens, orçamentos e inscrições
parceiro.html       área do parceiro: cadastro, login (e-mail/senha ou Google) e convites: js/parceiro.js
functions/api/parceiro/[[rota]].js  API da área do parceiro: cadastro, login, Google e "minha área"
functions/arquivos/[[caminho]].js  serve as imagens enviadas pelo painel (/arquivos/...)
functions/_middleware.js  serve js/provas-db.js e prova-<id>.html das provas do painel, na hora
d1/schema.sql       tabelas orcamentos, inscricoes e atletas
d1/painel.sql       tabelas do painel: provas, parceiros, convites, arquivos e login_erros
wrangler.toml       configuração do Cloudflare Pages e ligação com o banco D1 (binding DB)
_routes.json        quais endereços passam pelas funções (o resto é servido como arquivo estático)
```

## Ordem da página inicial

A página inicial é organizada por público:

1. **Abertura**, com dois caminhos: "Quero correr" e "Quero contratar uma corrida" (leva a `empresas.html`). O fundo é um mosaico com fotos das provas da Tardim (`assets/fotos/`, cerca de 400 px cada); com uma foto própria em alta resolução, dá para voltar a uma foto só. O card do lado destaca a próxima prova **com inscrição aberta**; esgotadas antes dela aparecem numa linha "Esgotada: ...".
2. **Para quem corre**: Calendário e galeria de fotos.
3. **Quem confia**: números e clientes, mapa "Onde já corremos" e Portfólio.
4. **Para quem contrata**: um resumo dos serviços com os botões "Conhecer os serviços" e "Pedir orçamento", que levam a `empresas.html`.

O contato fica no rodapé de todas as páginas (`id="contato"`, alvo do item "Contato" do menu) e no botão flutuante do WhatsApp.

`empresas.html` reúne o que é de quem contrata: Serviços (com as ofertas para empresas e a locação de estrutura), "Sua corrida do começo ao fim", "Monte sua corrida" (passo 1) e "Peça seu orçamento" (passo 2). Os links "Pedir orçamento" do site apontam para `empresas.html#orcamento`.

O conteúdo institucional (credenciais e instituições atendidas) fica em `institucional.html`, com link no rodapé e no Portfólio.

## Como atualizar as corridas

Abra `js/eventos.js` (calendário, contatos e galeria) ou `js/realizadas.js` (portfólio):

- `PROXIMAS`: provas com data. Cada prova tem um `id` e ganha uma página própria (`prova.html?id=...`) com informações, valores, kit, programação, percurso, regulamento e resultados. Campos vazios não aparecem, e a página avisa o que ainda vai ser publicado. Coloque a arte da prova em `assets/corridas/` e aponte no campo `poster`. Quando a data passa, a prova sai do calendário sozinha.
- O **calendário** da página inicial tem duas abas: *Próximas* (de `PROXIMAS`) e *Edições anteriores* (todas as edições/etapas das corridas em `REALIZADAS`, da mais recente para a mais antiga), com busca e filtros por ano, mês e distância.
- `REALIZADAS` (em `js/realizadas.js`): portfólio de trabalhos realizados, separados por área (eventos esportivos ou prevenção contra incêndio). Cada trabalho ganha uma página (`evento.html?id=...`) com ficha técnica (cliente, data, local, percursos, participantes), serviços prestados, destaques, fotos e depoimento. Campos vazios não aparecem. Os números do topo do portfólio (trabalhos, eventos, serviços de prevenção, instituições atendidas e participantes) são calculados sozinhos.
- `GALERIA`: fotos do carrossel "Na rua com a Tardim Produções" (foto, legenda e descrição). Coloque as fotos em `assets/fotos/`.
- `SITE.carrosselMinimo`: a partir de quantas provas abertas o carrossel com as artes aparece no calendário (hoje: 7). Com menos provas, a lista do calendário já mostra a arte de cada uma.

No `js/eventos.js`, o objeto `SITE` guarda o **WhatsApp** (DDI + DDD + número, só dígitos) e os **dados da empresa** (razão social, CNPJ, endereço). Campos vazios não aparecem no site.

## Pedido de orçamento

A seção "Peça seu orçamento" (`empresas.html#orcamento`) monta a mensagem no aparelho da pessoa e abre o WhatsApp (`SITE.whatsapp`) ou o e-mail (`SITE.email`) com o texto pronto. Botões com `data-orc="corrida"` (ou outro serviço) levam ao formulário com a opção já marcada.

Quando a pessoa toca em enviar, o site também manda uma cópia do pedido para `POST /api/orcamento`, que grava na tabela `orcamentos` do D1 (serviço, nome, contratante, empresa, cidade, data prevista, público, detalhes e o canal escolhido). Enquanto a pessoa só preenche, nada é enviado. Se a função falhar ou não existir (por exemplo, abrindo o `index.html` direto do computador), o WhatsApp e o e-mail abrem normalmente. O formulário não pede telefone nem e-mail, então o registro serve para contar e acompanhar pedidos, não para retornar o contato.

## Inscrição coletiva (assessorias)

A página `assessorias.html` só funciona pelo link de convite que a Tardim Produções gera no painel (`admin.html` > Convites): cadastra a assessoria em Parceiros, cria o convite dela na prova e, se quiser, define prazo, limite de atletas e as condições; o link aparece em "Links e mensagem" e vai pelo WhatsApp. A página antiga `link-assessoria.html` só redireciona para o painel. Sem link válido, a página mostra só um aviso. O convite é conferido só no navegador: evita acesso casual, mas não é uma proteção forte, e ainda não dá para cancelar um link já enviado.

Com o link, a assessoria baixa o modelo de planilha (Excel ou CSV), confere a planilha preenchida (CPF, data de nascimento, sexo, distância, camiseta, e-mail, telefone e repetidos) e envia o arquivo padronizado por WhatsApp ou e-mail. A conferência acontece no aparelho de quem usa. Ao tocar em enviar (com a confirmação de autorização dos atletas marcada), o site grava a inscrição no D1 por `POST /api/inscricao`: a equipe na tabela `inscricoes` e cada atleta na tabela `atletas` (nome, CPF, nascimento, sexo, distância, camiseta, e-mail e telefone). A função confere de novo o CPF e os campos obrigatórios e grava tudo ou nada. O botão "Baixar planilha conferida" não grava nada. As distâncias vêm dos `percursos` da prova e os tamanhos de camiseta do campo opcional `tamanhos` (padrão: PP, P, M, G, GG, XG, XGG).

## Painel (provas, parceiros, convites e apuração)

`admin.html` (fora do menu e do Google) é o painel da Tardim Produções. Funciona no site publicado no **Cloudflare Pages**: os dados ficam no mesmo banco **D1** do site (tabelas de `d1/painel.sql`) e a API está em `functions/api/admin/`. Entra quem tem a senha do painel.

**Primeira vez (uma vez só, por projeto do Cloudflare Pages):**

1. Crie as tabelas: `npx wrangler d1 execute tardim --remote --file d1/painel.sql`
2. Defina a senha do painel e o segredo da sessão (o segundo é um texto longo e aleatório, que ninguém precisa decorar):
   `npx wrangler pages secret put ADMIN_SENHA --project-name <projeto>` e
   `npx wrangler pages secret put SESSAO_SEGREDO --project-name <projeto>`
3. Publique o site de novo e abra `admin.html`.

**Segurança:** a senha nunca fica em arquivo do repositório (a pasta inteira é publicada). O login usa cookie HttpOnly, Secure e SameSite=Strict, válido por 14 dias; trocar `ADMIN_SENHA` derruba todas as sessões. Depois de 5 senhas erradas em 15 minutos, o mesmo endereço IP fica bloqueado por 15 minutos. As escritas só são aceitas a partir do próprio site.

**Abas do painel:**

- **Provas**: cadastro completo da prova (dados, arte, valores, kit, programação, links). A arte enviada é reduzida para JPG de até 1600 px e guardada no banco. Marcou como publicada e salvou, a prova já está no site (até 1 minuto de cache): o calendário, a página `prova-<id>.html` com a prévia certa e o kit de divulgação são servidos na hora pelo banco (`functions/_middleware.js`), sem publicar o site de novo. Desmarcou, ela sai. As provas do `js/eventos.js` aparecem como "No código" e podem ser trazidas para o painel; a versão do painel vale no site.
- **Parceiros**: embaixadores, influenciadores, assessorias e equipes (contato, CPF/CNPJ e Pix para a comissão). Embaixador e influenciador têm o tipo de profissional; para "Profissional de Educação Física (CREF6/MG)" o número do CREF6 é obrigatório e o botão "Validar no CREF6" consulta o registro na página pública do CREF6 (`functions/_lib/cref6.js`, pela rota `api/admin/cref6`, só para quem está no painel). O painel avisa, sem impedir o cadastro, quando o registro não existe, não está ativo ou está em nome de outra pessoa; se o CREF6 estiver fora do ar, salva como "não conferido". A lista mostra "CREF6 ativo", "CREF6 não conferido" ou a situação devolvida. Assessoria e equipe têm logo (PNG até 400 px) e cor, usadas na inscrição coletiva e na página da equipe. As imagens ficam na tabela `arquivos` e são servidas em `/arquivos/<caminho>`; cada envio ganha nome novo, e o antigo continua valendo para links já enviados.
- **Instagram dos parceiros** (`functions/_lib/instagram.js`): o painel confere os seguidores reais pela API oficial da Meta (Business Discovery), usando a conta do Instagram configurada em `IG_USER_ID` (hoje a do Felipe; para passar à @tardimproducoes, basta gerar token e id dela e trocar os dois segredos). O parceiro não faz nada. Todo cadastro novo com Instagram já é conferido na hora. Na aprovação e na lista aparece "Instagram: N seguidores", com alerta quando o número informado passa 30% do real, ou "Instagram não encontrado" (conta pessoal, privada ou @ errado: só conta Comercial ou Criador de conteúdo aparece). O botão "Conferir Instagram" atualiza (rota `api/admin/parceiros/<id>/instagram`). Trocar o @ apaga a conferência antiga. A API é gratuita. Sem os segredos abaixo, tudo segue como antes, só sem a conferência.
  Configuração, uma vez:
  1. A conta do Instagram que consulta precisa ser profissional (Comercial ou Criador de conteúdo) e estar ligado a uma Página do Facebook.
  2. Em developers.facebook.com, app **Tardim Parceiros** (id 1131643113075137, portfólio Felipe Helison), caso de uso "Gerenciar mensagens e conteúdo no Instagram", com as permissões `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`, `pages_show_list` e `business_management`. O app antigo "Tardimproducoes" não aceita esse caso de uso.
  3. Em business.facebook.com > Configurações > Usuários do sistema, crie um usuário do sistema (administrador), atribua a ele o app e a Página, e gere um token com validade **Nunca**, com as permissões `instagram_basic`, `instagram_manage_insights`, `pages_show_list`, `pages_read_engagement` e `business_management`.
  4. Descubra o id da conta do Instagram: abra `https://graph.facebook.com/v23.0/me/accounts?fields=name,instagram_business_account&access_token=<TOKEN>` e copie `instagram_business_account.id`.
  5. Grave os segredos: `npx wrangler pages secret put IG_USER_ID --project-name <projeto>` e `npx wrangler pages secret put IG_TOKEN --project-name <projeto>`.
  Como o app só usa uma conta própria, o acesso padrão costuma bastar. Se o botão responder erro de permissão, peça acesso avançado a `instagram_basic` e `pages_read_engagement` na Análise do app da Meta. Token inválido ou revogado aparece no painel com aviso.
- **Convites**: um parceiro numa prova, com o cupom criado na Ticket Sports (Promover > Cupons de desconto, tipo individual), desconto, comissão, cortesias e contrapartida. O convite gera o link para os atletas (`prova-<id>.html?cupom=CODIGO`), o link do kit de divulgação, o link de inscrição coletiva (assessoria/equipe) e a mensagem pronta para o WhatsApp.
- **Apuração**: solte o relatório de inscritos exportado da Ticket Sports (Excel ou CSV), escolha as colunas de cupom, valor e situação e marque quais situações contam como pagas. O painel soma por cupom, calcula a comissão de cada parceiro e baixa a planilha de pagamento. O arquivo é lido só no navegador.
- **Ticket Sports (post automático)**: em painel.ticketsports.com.br > Integração > Aplicativos, o campo "Url do post" aponta para `https://<site>/api/ticketsports?token=<TICKETSPORTS_TOKEN>` (`functions/api/ticketsports.js`). Cada post chega cru na tabela `ticketsports_posts` (banco antigo: `d1/migracoes/007-ticketsports.sql`). O token vai em `npx wrangler pages secret put TICKETSPORTS_TOKEN --project-name <projeto>`; sem ele, a rota recusa tudo. Para ver o que chegou: `npx wrangler d1 execute tardim --remote --command "SELECT id, recebido_em, tipo, substr(corpo,1,500) FROM ticketsports_posts ORDER BY id DESC LIMIT 5"`.
- **Inscrições coletivas**: os envios das assessorias (tabelas `inscricoes` e `atletas`), com filtro por prova e botão para baixar os atletas de cada envio em Excel.
- **Orçamentos**: a cópia de cada pedido do formulário "Peça seu orçamento" (tabela `orcamentos`), com download em Excel.
- **Propostas**: cada proposta vai do orçamento ao contrato assinado em cinco passos, numa tela só (`#proposta/<id>`): 1) montar a proposta com os itens do **Minutário** (itens padrão com descrição, valor e quantidade de referência); 2) baixar o PDF e registrar o envio; 3) registrar se o cliente aprovou ou recusou; 4) completar os dados do contratante e gerar o contrato (valor em algarismos e por extenso sempre iguais, cláusulas numeradas sozinhas, Anexo I com os itens e, se marcado, Anexo II com o valor por número de participantes); 5) assinar (gratuito no gov.br, assinador.iti.br) e registrar o PDF assinado (até 1,9 MB) ou o link dele. Os dados das empresas que assinam e o texto do contrato ficam em "Empresa e modelo do contrato"; o modelo padrão deve ser revisado pelo advogado antes do uso. Com o contrato assinado, a proposta trava; mudanças viram uma proposta de aditivo (Duplicar). Preços, custos e o simulador ficam só no painel.

## API v1 para parceiros (integração com plataformas de assessoria)

Contrato completo em `docs/api-v1-parceiros.md` (mesmo arquivo no repositório do IM3). Cada sistema fica com o seu banco; a plataforma da assessoria (ex.: IM3) conversa com a Tardim só por `https://<site>/api/v1/`. **Tudo pelo sistema, ninguém copia chave:**

1. **Conectar**: no painel, Parceiros > editar uma assessoria aprovada > **Integração** > informe o endereço do sistema dela (ex.: `https://im3-eventos.vercel.app`) > **Convidar para conectar**. A Tardim manda um convite assinado (ES256); o admin da assessoria recebe a notificação no sistema dele e aceita ou recusa. Aceitando, o sistema dela recebe a chave direto do servidor da Tardim e o painel mostra "Conectada". "Desconectar" avisa o sistema e corta o acesso na hora.
2. **Convites de prova**: com a assessoria conectada, cada convite criado ou alterado no painel (e cada prova publicada ou alterada) vira aviso no sistema dela, que aceita (escolhendo PIX na assessoria ou pagamento na Ticket Sports) ou recusa. A lista de Convites mostra a resposta; "Aviso não entregue" tem o botão **Reenviar aviso**.

Configuração, uma vez (a chave privada que assina os convites):

```bash
node scripts/gerar-chave-assinatura.mjs | npx wrangler pages secret put TARDIM_ASSINATURA_JWK --project-name tardim-teste
```

Para o servidor local, coloque a saída em `.dev.vars` como `TARDIM_ASSINATURA_JWK='...'`. A parte pública sai em `GET /api/v1/chaves-publicas`.

- **Rotas sem chave**: `GET /api/v1/chaves-publicas`, `POST /api/v1/conexoes/<id>/aceitar` e `/recusar` (autenticadas pelo código de uso único do convite).
- **Rotas com chave**: `GET /eu`, `DELETE /conexao`, `GET /provas`, `GET /provas/<id>`, `GET /convites`, `POST /convites/<id>/aceitar` e `/recusar`. Envios, situação dos atletas e resultados respondem `501` até a próxima etapa.
- **Código**: `functions/api/v1/[[rota]].js` (tabela de rotas) e `functions/_api-v1/` (autenticação, conexões, catálogo, envios, formato das provas, avisos com HMAC e a fila de novas tentativas); JWS e chaves em `functions/_lib/`. O banco guarda só o SHA-256 da chave e do código do convite. Limite: 120 chamadas por minuto por chave; aceitar/recusar, 20 por minuto por IP. Sem CORS: só servidor chama.
- **Documentação navegável**: `/api/v1/docs` (Swagger) e `/api/v1/openapi.json`.
- **Avisos que falham** são tentados de novo em 1 min, 5 min, 30 min, 2 h, 6 h e 24 h (tabela `avisos_fila`).
- **Banco já criado**: rode `d1/migracoes/013-integracoes.sql`.
## Área do parceiro (cadastro e login)

`parceiro.html` (link "Área do parceiro" no rodapé) é onde assessorias, influenciadores e embaixadores se cadastram e entram. API em `functions/api/parceiro/`.

- **Cadastro**: tipo, nome (ou nome da assessoria e responsável), WhatsApp (obrigatório), estado e cidade, Instagram e aceite da política de privacidade e das regras do programa. Influenciador também precisa informar o Instagram e o número estimado de seguidores. A cidade é escolhida digitando, com sugestões da lista do IBGE do estado escolhido (`functions/_lib/cidades.js`, servida por `api/parceiro/cidades?uf=MG`); o servidor só aceita cidade da lista e grava o nome oficial, mesmo que a pessoa digite sem acento. Para atualizar a lista, baixe `https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado` e gere o arquivo de novo. Entra com e-mail e senha (mínimo de 8 caracteres, guardada só como hash PBKDF2) ou pelo botão **Entrar com Google**. Quem entra com Google e ainda não tem cadastro completa os dados na sequência. Se o e-mail do Google já tiver cadastro com senha, as duas formas passam a valer na mesma conta.
- **Aprovação**: o cadastro chega como parceiro com situação "pendente" e inativo. O painel abre na aba Parceiros, mostra "Parceiros (N novos)" e o bloco "Cadastros aguardando aprovação" com **Aprovar** e **Recusar** (o motivo da recusa aparece para o parceiro). Aprovado, o painel oferece a mensagem de aviso pelo WhatsApp.
- **Aviso por e-mail**: a cada cadastro novo a Tardim recebe um e-mail com os dados e o link do painel, se `RESEND_API_KEY` e `AVISO_EMAIL` estiverem definidos (veja abaixo). Sem eles, o aviso fica só no painel.
- **Minha área**: pendente vê "Em análise"; recusado vê o motivo; aprovado vê os convites que a Tardim criou para ele no painel (prova, cupom, condições, link para os atletas, kit de divulgação e, para assessoria, o link da inscrição coletiva).
- **Segurança**: cookie HttpOnly, Secure e SameSite=Lax (`tardim_parceiro`, 30 dias), assinado com `SESSAO_SEGREDO`. 5 senhas erradas em 15 minutos bloqueiam o IP por 15 minutos; no máximo 5 cadastros por IP por hora. O token do Google é conferido no servidor (assinatura, site, validade e e-mail confirmado). Excluir o parceiro no painel apaga a conta de acesso. Esqueceu a senha: o botão "Esqueci minha senha" manda por e-mail (Resend) um link para criar senha nova (`parceiro.html#redefinir=...`, rotas `esqueci` e `nova-senha`). O link vale 1 hora e uma vez só (é assinado com `SESSAO_SEGREDO` e amarrado à senha atual, sem tabela nova). Sem `RESEND_API_KEY`, a página manda falar com a Tardim pelo WhatsApp. **Atenção:** sem domínio verificado no Resend, o e-mail só chega ao dono da conta Resend; para os parceiros receberem, verifique o domínio e defina `AVISO_REMETENTE`.

**Configurar (uma vez por projeto):**

1. Atualize o banco com `d1/migracoes/002-contas-parceiros.sql`, `d1/migracoes/003-parceiros-uf-seguidores.sql` e `d1/migracoes/004-parceiros-instagram.sql` (`npx wrangler d1 execute tardim --remote --file <arquivo>`, uma vez cada; banco novo: basta o `d1/painel.sql`).
2. **Google**: no [Google Cloud Console](https://console.cloud.google.com/apis/credentials), crie uma credencial "ID do cliente OAuth" do tipo "Aplicativo da Web", com as origens JavaScript autorizadas `https://tardim-teste.pages.dev` (e depois o domínio definitivo). Configure a tela de consentimento (nome "Tardim Produções", e-mail de suporte). Copie o ID do cliente e grave: `npx wrangler pages secret put GOOGLE_CLIENT_ID --project-name <projeto>`. Sem ele, a página mostra só e-mail e senha.
3. **E-mail de aviso**: crie uma conta gratuita no [Resend](https://resend.com), gere uma chave de API e grave `RESEND_API_KEY` e `AVISO_EMAIL` (o e-mail que recebe os avisos; vários separados por vírgula) com `npx wrangler pages secret put`. Sem domínio verificado no Resend, o remetente é `onboarding@resend.dev` e o Resend só entrega para o e-mail da própria conta Resend; com o domínio verificado, defina `AVISO_REMETENTE` (ex.: `Tardim Produções <avisos@tardimproducoes.com.br>`).
4. Publique o site de novo.

**Kit de divulgação** (`kit.html?p=<prova>&c=<CUPOM>&n=<nome>&d=<desconto>`): página pública e fora do Google com o link e o cupom do parceiro, card para stories (1080x1920, gerado no navegador com a arte e o cupom), a arte da prova e textos prontos para Instagram, WhatsApp e stories. Sem cupom (`kit.html?p=<prova>`), vira o kit geral da prova. O texto usa o campo "Texto de divulgação" da prova ou, vazio, monta sozinho com os dados dela.

**Cupom na página da prova**: quem entra pelo link do parceiro vê o cupom em destaque, e o botão de inscrição copia o código antes de abrir a Ticket Sports, onde a pessoa cola no campo de cupom. A Ticket Sports não aceita cupom pelo endereço; se um dia aceitar, coloque o nome do parâmetro em `SITE.cupomParam` (`js/eventos.js`).

As regras do programa ficam em `programa-embaixadores.html` (no menu do topo como "Seja parceiro", fora do Google); o link também vai na mensagem de cada convite. Os botões "Quero ser parceiro" (programa e `assessorias.html`) levam a `parceiro.html#cadastro`, que abre direto no formulário.

### Personalização por assessoria

No formulário de convite do painel (bloco "Inscrição coletiva", que aparece para assessoria e equipe), além de prazo e limite, o convite aceita (tudo opcional, e o que ficar em branco não aparece):

- **Cara da equipe**: nome do treinador (a página cumprimenta pelo primeiro nome), cor da equipe e logo. A logo é um arquivo em `assets/assessorias/`; no gerador vai só o nome do arquivo (sem espaços nem acentos).
- **Condição comercial**: valor por atleta, até 3 faixas de desconto por volume, cortesias e forma de pagamento. A assessoria vê o combinado, a barra "faltam X atletas para a próxima faixa" e o total estimado conforme a planilha. O total também vai no resumo do WhatsApp/e-mail e na aba "Resumo" da planilha conferida.
- **Dia da prova**: espaço para tenda, retirada de kits em lote, foto oficial e ponto de encontro.

Tudo isso viaja dentro do próprio link (`js/convite.js` lista os campos). **O link não é proteção forte**: confira sempre o valor e o desconto ao receber a planilha. Links antigos continuam funcionando.

A página da assessoria também traz o modelo de planilha com a coluna "Equipe" preenchida, mensagens prontas para o grupo (convite, lembrete de prazo e retirada de kit) e o link da **página da equipe** (`equipe.html`), que o treinador manda aos atletas. Nela o atleta vê a prova, a contagem para o prazo interno, os ritmos por pelotão, preenche os dados e envia para o WhatsApp do treinador, já com a linha pronta para colar na planilha. Esse link público não leva valores, descontos nem limite, e não abre a inscrição coletiva. O card "Eu vou correr!" aberto a partir dela sai com o nome (e a logo) da equipe.

## Previsão do tempo

Até 15 dias antes de cada prova, o card da próxima prova e a página da prova mostram a previsão para a hora da largada (serviço gratuito Open-Meteo, sem chave). A localização vem da cidade citada no `local` da prova (Belo Horizonte se nenhuma for reconhecida). Para informar o ponto exato, use `coords: [latitude, longitude]` na prova em `PROXIMAS`.

## Modo demonstração

Abra `index.html?demo=1` para ver o site com provas e imagens **fictícias** (Corrida Kids de Natal, Corrida da Lagoa, Desafio 10K, Corrida Noturna e Meia Maratona da Serra). Serve para mostrar como o calendário por mês, o filtro de distância, o carrossel das artes e a página completa da prova ficam com várias provas. Há um aviso no topo e o selo "Exemplo" em cada prova fictícia, e a demonstração não é indexada pelo Google. O site normal, sem `?demo=1`, mostra só as provas reais.

## Depois de editar CSS ou JS

O `scripts/gerar-paginas.js` troca o `?v=...` dos arquivos CSS e JS de todas as páginas, para o navegador dos visitantes baixar a versão nova em vez de usar a cópia antiga em cache. Ele usa o código do commit quando roda no GitHub Actions ou no build do Cloudflare Pages ligado ao GitHub. Rodando no seu computador, só troca se você pedir com `node scripts/gerar-paginas.js --versao` (usa data e hora); sem `--versao`, o `?v=` não muda. Isso altera o `?v=` em todas as páginas do repositório; use na hora de publicar.

## Páginas geradas automaticamente

O script `scripts/gerar-paginas.js` cria, a partir do `js/eventos.js` e do `js/realizadas.js`:

- `prova-<id>.html`: uma página por prova, com a prévia certa (arte e título) ao compartilhar no WhatsApp;
- `trabalho-<id>.html`: uma página por trabalho do portfólio, também com prévia própria;
- `sitemap.xml` e `robots.txt`, para o Google;
- `404.html`, a página de erro com a cara da Tardim Produções.

Esses arquivos não ficam guardados no repositório (estão no `.gitignore`). Rode `node scripts/gerar-paginas.js` antes de cada publicação (veja [Publicar](#publicar-cloudflare-pages)).

Os endereços das prévias de compartilhamento vêm de `SITE.urlBase` (`js/eventos.js`) e das tags `canonical` e `og:` fixas no `<head>` de cada página. Hoje todos ainda apontam para o endereço antigo do GitHub Pages; quando o domínio entrar no ar, troque para `https://tardimproducoes.com.br/`.

## Mapa "Onde já corremos"

O mapa conta as corridas de cada cidade a partir das edições em `REALIZADAS`. Belo Horizonte, Contagem, Betim e Nova Lima aparecem juntas como "Grande BH". Para uma cidade nova aparecer no mapa, coloque a posição dela em `CIDADES_MAPA` no `js/mapa.js` (e, se o nome encostar em outro, o lado do nome em `LADO`).

## Ver localmente

Para ver só as páginas, abra o `index.html` no navegador. Assim os formulários funcionam, mas nada é gravado no banco.

Para testar com as funções e um banco local (precisa do Node.js 20 ou mais novo):

```
npm install
npx wrangler d1 execute tardim --local --file d1/schema.sql
npx wrangler d1 execute tardim --local --file d1/painel.sql
node scripts/db-registrar-migracoes.mjs --local --todas
npm run dev -- --binding ADMIN_SENHA=teste --binding SESSAO_SEGREDO=segredo-local
```

O site abre em `http://127.0.0.1:8791`. O banco local fica em `.wrangler/` (fora do repositório) e não tem relação com o banco real. Para a integração com as assessorias, ponha `TARDIM_ASSINATURA_JWK` em `.dev.vars` (veja [API v1 para parceiros](#api-v1-para-parceiros-integração-com-plataformas-de-assessoria)).

**Testes automáticos:** `npm test` sobe o site inteiro num banco descartável e roda os testes de `tests/` (cerca de 2 minutos). O GitHub roda os mesmos testes a cada push. Como o backend é organizado, como acrescentar uma rota e as regras de segurança: [docs/arquitetura.md](docs/arquitetura.md).

**Documentação das APIs (Swagger):** `/api/v1/docs` (API para parceiros, pública) e `/api/admin/docs` (APIs internas, com login no painel).

## Publicar (Cloudflare Pages)

A publicação é feita do computador, por upload direto, com o `wrangler` (na primeira vez, `npx wrangler login` abre o navegador para autorizar a conta da Cloudflare):

```
npm run db:migracoes:producao   # só se houver migração nova em d1/migracoes/
npm run publicar                # gera as páginas com a versão nova e publica
```

(`npm run publicar` = `node scripts/gerar-paginas.js --versao` + `wrangler pages deploy --project-name tardim-teste --branch main`.)

- Hoje existe só o projeto de teste `tardim-teste`, em `https://tardim-teste.pages.dev`. O projeto definitivo (`tardim-producoes`, o nome que está no `wrangler.toml`) ainda não foi criado; crie com `npx wrangler pages project create tardim-producoes --production-branch main` e passe a publicar com esse nome.
- A pasta inteira do repositório é publicada. Para o código do servidor e a configuração não ficarem legíveis pelo endereço do site, `functions/_middleware.js` responde 404 para `functions/`, `d1/`, `docs/`, `scripts/`, `tests/`, `.github/`, `node_modules/`, `wrangler.toml`, `README.md`, `CHANGELOG.md`, `package.json`, `package-lock.json`, `.gitignore`, `.editorconfig` e `_routes.json` (essas rotas estão em `_routes.json`). Arquivo novo de uso interno na raiz precisa entrar nas duas listas; o teste "arquivos privados" (`npm test`) confere. Mesmo assim, **nunca coloque senha ou chave em arquivo do repositório**: segredos vão em `npx wrangler pages secret put NOME --project-name <projeto>`.
- As funções em `functions/` e a ligação com o banco (`wrangler.toml`) sobem junto, no mesmo comando.
- A Cloudflare serve as páginas sem o `.html` (`/assessorias.html` redireciona para `/assessorias`).
- Publicando do computador, o `--versao` carimba o `?v=` dos arquivos CSS e JS com data e hora, para os visitantes baixarem a versão nova (veja [Depois de editar CSS ou JS](#depois-de-editar-css-ou-js)).
- O painel precisa, em cada projeto, das tabelas de `d1/painel.sql` e dos segredos `ADMIN_SENHA` e `SESSAO_SEGREDO` (veja [Painel](#painel-provas-parceiros-convites-e-apuração)).

O workflow `.github/workflows/pages.yml` (GitHub Pages) continua no repositório, mas não é mais o caminho de publicação: o GitHub Pages não roda as funções nem acessa o banco.

## Banco de dados (Cloudflare D1)

O banco se chama `tardim` e está ligado às funções pelo nome `DB` (`wrangler.toml`). As tabelas de `d1/schema.sql`:

| Tabela | O que guarda |
| --- | --- |
| `orcamentos` | Um pedido de orçamento por linha |
| `inscricoes` | Uma inscrição coletiva por linha (prova, equipe, responsável, total de atletas) |
| `atletas` | Os atletas de cada inscrição (ligados por `inscricao_id`) |

E as do painel, em `d1/painel.sql`:

| Tabela | O que guarda |
| --- | --- |
| `provas` | Provas cadastradas no painel (as publicadas aparecem no site na hora) |
| `parceiros` | Embaixadores, influenciadores, assessorias e equipes, com contato, CPF/CNPJ, Pix, logo, cor e situação do cadastro (pendente, aprovado, recusado) |
| `contas` | Acesso dos parceiros à `parceiro.html`: e-mail, hash da senha e/ou conta Google |
| `convites` | Um parceiro numa prova: cupom da Ticket Sports, desconto, comissão, cortesias |
| `arquivos` | Imagens enviadas pelo painel (artes e logos, até 1,9 MB cada), servidas em `/arquivos/...` |
| `ticketsports_posts` | Posts automáticos da Ticket Sports ("Url do post"), guardados crus |
| `login_erros` | Senhas erradas no painel e na área do parceiro (bloqueio de 15 minutos) e limite de cadastros por IP |

**Banco novo:** `d1/schema.sql` e `d1/painel.sql` têm o esquema completo (podem rodar de novo sem perder dados); depois, registre as migrações como aplicadas:

```
npx wrangler d1 execute tardim --remote --file d1/schema.sql
npx wrangler d1 execute tardim --remote --file d1/painel.sql
node scripts/db-registrar-migracoes.mjs --remote --todas
```

**Banco existente (produção):** as mudanças ficam em `d1/migracoes/` e o wrangler aplica só as que faltam, registrando na tabela `d1_migrations`:

```
npm run db:migracoes:lista       # o que falta
npm run db:migracoes:producao    # aplica
```

Uma única vez, antes do primeiro `db:migracoes:producao`: as migrações 001 a 012 foram aplicadas à mão, então registre-as com `node scripts/db-registrar-migracoes.mjs --remote --ate 012`. Detalhes em [docs/arquitetura.md](docs/arquitetura.md#banco-de-dados-e-migrações).

Para consultar:

```
npx wrangler d1 execute tardim --remote --command "SELECT * FROM orcamentos ORDER BY id DESC LIMIT 20"
npx wrangler d1 execute tardim --remote --command "SELECT criado_em, prova_nome, equipe, total FROM inscricoes ORDER BY criado_em DESC"
```

Também dá para ver os dados no painel da Cloudflare, em **Storage & Databases > D1**.

A tabela `atletas` tem dados pessoais (CPF, e-mail, telefone). O acesso é só pela conta da Cloudflare e pelo painel do site. O que o site diz aos visitantes sobre isso está em `privacidade.html`; se mudar o que é guardado, mude o texto de lá também.

As funções só aceitam pedidos vindos do próprio site (conferem o cabeçalho `Origin`) e limitam o tamanho de cada campo. `/api/orcamento` e `/api/inscricao` aceitam até 10 envios por IP por hora cada uma (`functions/_lib/limite.js`, tabela `envios_tentativas`); acima disso respondem 429 e o site segue abrindo o WhatsApp ou o e-mail normalmente.

## Domínio

`tardimproducoes.com.br` está registrado no Registro.br, no nome da empresa, e já foi adicionado à conta da Cloudflare (plano Free). Para o site abrir nesse endereço:

1. No Registro.br, trocar os servidores DNS do domínio para `ali.ns.cloudflare.com` e `jermaine.ns.cloudflare.com`, deixando os campos de DNSSEC/DS em branco (o domínio tinha DNSSEC ativo com os servidores antigos).
2. Esperar a Cloudflare ativar o domínio (ela avisa por e-mail; pode levar até 24 horas).
3. No painel da Cloudflare, em **Workers & Pages**, abrir o projeto do site e adicionar `tardimproducoes.com.br` e `www.tardimproducoes.com.br` em **Custom domains**.
4. Trocar os endereços do site para o domínio (veja o fim de [Páginas geradas automaticamente](#páginas-geradas-automaticamente)) e publicar de novo.

Em 22/11/2026 o passo 1 ainda estava pendente.

## Pendências de conteúdo

- Links de inscrição de cada prova (hoje todos apontam para o Linktree).
- Retirada de kit, mapa do percurso e regulamento de cada prova.
- Endereço (seção Institucional), se for para aparecer no site.
- Lista completa dos CNAEs pelo Comprovante de Inscrição do CNPJ na Receita Federal.
- Contratante e número de participantes de cada prova.
- Logos e fotos em alta resolução (as atuais foram recortadas de prints do Instagram).
- Conferir o ano da Corrida da Guarda Civil Municipal.
- Portfólio: número de participantes, fotos e depoimento de cada prova; data da 2ª Corrida da Administração (2024) e da Corrida do Cinquentenário do Batalhão de Trânsito.
