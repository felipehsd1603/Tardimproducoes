/*
 * Painel da Tardim Produções: provas, parceiros (embaixadores, influenciadores,
 * assessorias e equipes), convites com cupom e apuração das comissões.
 * Os dados ficam no banco D1 do Cloudflare (d1/painel.sql), pela API de
 * functions/api/admin; entra quem tem a senha do painel (segredo ADMIN_SENHA).
 * Também mostra as inscrições coletivas e os pedidos de orçamento recebidos.
 */
(function () {
  "use strict";
  var app = document.getElementById("painel");
  if (!app) return;

  var site = typeof SITE !== "undefined" ? SITE : {};
  var ESTATICAS = (typeof PROXIMAS !== "undefined" ? PROXIMAS : []).filter(function (p) { return p.id && !p.demo; });

  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
    "agosto", "setembro", "outubro", "novembro", "dezembro"];
  var TIPOS = { embaixador: "Embaixador", influenciador: "Influenciador", assessoria: "Assessoria", equipe: "Equipe" };
  // Mesma lista de functions/api/admin/[[rota]].js; o primeiro tem registro conferido no CREF6
  var PROFISSOES = [
    "Profissional de Educação Física (CREF6/MG)", "Profissional de Educação Física (outro CREF)",
    "Fisioterapeuta", "Nutricionista", "Médico", "Atleta/corredor", "Outro",
  ];

  // ---------- utilidades ----------
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function campo(rotulo, entrada, dica, cheio) {
    var l = el("label", "orc__field" + (cheio ? " assess-grid__full" : ""));
    l.append(el("span", null, rotulo), entrada);
    if (dica) l.append(el("small", "assess-dica", dica));
    return l;
  }
  function entrada(tipo, valor, extra) {
    var i = el(tipo === "textarea" ? "textarea" : "input");
    if (tipo !== "textarea") i.type = tipo;
    i.value = valor == null ? "" : valor;
    if (extra) Object.keys(extra).forEach(function (k) { i[k] = extra[k]; });
    return i;
  }
  function escolha(opcoes, valor) {
    var s = el("select");
    opcoes.forEach(function (o) { var op = el("option", null, o[1]); op.value = o[0]; s.append(op); });
    if (valor != null) s.value = valor;
    return s;
  }
  function marcador(texto, marcado) {
    var l = el("label", "assess-toggle");
    var c = entrada("checkbox");
    c.checked = !!marcado;
    l.append(c, el("span", null, texto));
    l.caixa = c;
    return l;
  }
  function botao(texto, cls, fn) {
    var b = el("button", cls || "orc__email", texto);
    b.type = "button";
    if (fn) b.addEventListener("click", fn);
    return b;
  }
  function linkExt(texto, href, cls) {
    var a = el("a", cls || "orc__email", texto);
    a.href = href; a.target = "_blank"; a.rel = "noopener";
    return a;
  }
  function dataDe(str) { var p = String(str).split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function quando(str) { if (!str) return ""; var d = dataDe(str); return d.getDate() + " de " + MESES[d.getMonth()] + " de " + d.getFullYear(); }
  function curta(str) { if (!str) return ""; var p = String(str).split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
  function hoje() { var h = new Date(); h.setHours(0, 0, 0, 0); return h; }
  function slug(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");
  }
  function linhas(txt) { return String(txt || "").split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean); }
  function reais(n) { return (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
  function base() {
    if (/^https?:$/.test(location.protocol)) return location.href.split("#")[0].split("?")[0].replace(/[^\/]*$/, "");
    return (site.urlBase || "").replace(/\/?$/, "/");
  }
  function copiar(texto, b) {
    var orig = b.textContent;
    var feito = function () { b.textContent = "Copiado!"; setTimeout(function () { b.textContent = orig; }, 1800); };
    if (navigator.clipboard) navigator.clipboard.writeText(texto).then(feito, function () {});
  }
  var avisoEl = null;
  function aviso(msg, erro, link) {
    if (avisoEl) avisoEl.remove();
    avisoEl = el("div", "painel-aviso" + (erro ? " is-erro" : ""));
    avisoEl.setAttribute("role", erro ? "alert" : "status");
    avisoEl.append(el("span", null, msg));
    if (link) avisoEl.append(botao(link[0], "painel-aviso__link", link[1]));
    var fechar = botao("Fechar", "painel-aviso__x", function () { avisoEl.remove(); avisoEl = null; });
    avisoEl.append(fechar);
    app.prepend(avisoEl);
    if (!erro && !link) setTimeout(function () { if (avisoEl) { avisoEl.remove(); avisoEl = null; } }, 5000);
  }
  function falha(e) {
    if (e && e.silencioso) return;
    aviso("Não deu certo: " + ((e && e.message) || String(e)), true);
  }
  function card(passo, titulo) {
    var c = el("section", "assess-card");
    if (passo) c.append(el("p", "assess-card__step", passo));
    if (titulo) c.append(el("h2", null, titulo));
    return c;
  }
  function tabela(cabecalho, linhasTab) {
    var w = el("div", "painel-tab");
    var t = el("table");
    var th = el("tr");
    cabecalho.forEach(function (h) { th.append(el("th", null, h)); });
    var thead = el("thead"); thead.append(th);
    var tb = el("tbody");
    linhasTab.forEach(function (cels) {
      var tr = el("tr");
      cels.forEach(function (c) {
        var td = el("td");
        if (c instanceof Node) td.append(c); else td.textContent = c == null ? "" : c;
        tr.append(td);
      });
      tb.append(tr);
    });
    t.append(thead, tb);
    w.append(t);
    return w;
  }
  function situacao(texto, cls) { return el("span", "painel-sit " + cls, texto); }
  function acoes() {
    var d = el("div", "painel-acoes-linha");
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) d.append(arguments[i]);
    return d;
  }

  // ---------- API do painel (functions/api/admin) ----------
  var S = { provas: [], parceiros: [], convites: [], orcamentos: null, inscricoes: null, aba: "provas" };
  function api(metodo, caminho, dados, tipo) {
    var op = { method: metodo, credentials: "same-origin", headers: {} };
    if (dados instanceof Blob) { op.body = dados; op.headers["content-type"] = tipo || dados.type; }
    else if (dados !== undefined) { op.body = JSON.stringify(dados); op.headers["content-type"] = "application/json"; }
    return fetch("api/admin/" + caminho, op).then(function (r) {
      return r.text().then(function (t) {
        var j = null;
        try { j = t ? JSON.parse(t) : {}; } catch (e) { j = null; }
        if (r.status === 401 && caminho !== "login") { telaLogin("Sua sessão terminou. Entre de novo."); throw { silencioso: true }; }
        if (!r.ok || j === null) {
          var err = new Error((j && j.mensagem) || (r.status === 404 && j === null ? "o painel precisa do Cloudflare Pages (as funções não responderam)" : "erro " + r.status));
          err.status = r.status; err.semApi = j === null;
          throw err;
        }
        return j;
      });
    });
  }
  function enviaImagem(pasta, nome, blob, tipo) {
    var ext = tipo === "image/png" ? "png" : "jpg";
    var caminho = pasta + "/" + nome + "-" + Date.now().toString(36) + "." + ext;
    return api("POST", "arquivos?caminho=" + encodeURIComponent(caminho), blob, tipo).then(function () { return caminho; });
  }
  var urlArquivo = function (caminho) { return !caminho ? "" : (/^(https?:|arquivos\/|assets\/)/.test(caminho) ? caminho : "arquivos/" + caminho); };

  // ---------- login ----------
  function telaLogin(msg) {
    app.innerHTML = "";
    var c = card("Área restrita", "Entrar no painel");
    var f = el("form", "assess-grid");
    f.noValidate = true;
    var senha = entrada("password", "", { autocomplete: "current-password", required: true });
    var ir = el("button", "btn btn--red btn--lg assess-grid__full", "Entrar");
    ir.type = "submit";
    f.append(campo("Senha do painel", senha, null, true), ir);
    var erro = el("p", "orc__erro");
    erro.hidden = !msg;
    erro.textContent = msg || "";
    c.append(f, erro);
    app.append(c);
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!senha.value) { erro.textContent = "Informe a senha."; erro.hidden = false; return; }
      ir.disabled = true; ir.textContent = "Entrando...";
      api("POST", "login", { senha: senha.value }).then(entrar).catch(function (err) {
        ir.disabled = false; ir.textContent = "Entrar";
        erro.textContent = err.message || "Não consegui entrar."; erro.hidden = false;
        senha.select();
      });
    });
    senha.focus();
  }

  function semApi(msg) {
    app.innerHTML = "";
    var c = card("Primeiro acesso", "Ligar o painel ao Cloudflare");
    if (msg) c.append(el("p", "assess-alerta", msg));
    var ol = el("ol", "painel-passos");
    [
      "O painel funciona no site publicado no Cloudflare Pages (com o banco D1 \"tardim\" ligado como DB), ou localmente com npx wrangler pages dev.",
      "Crie as tabelas do painel: npx wrangler d1 execute tardim --remote --file d1/painel.sql",
      "Defina a senha do painel e o segredo da sessão: npx wrangler pages secret put ADMIN_SENHA e npx wrangler pages secret put SESSAO_SEGREDO (um texto longo e aleatório).",
      "Publique o site de novo e abra esta página.",
    ].forEach(function (t) { ol.append(el("li", null, t)); });
    c.append(ol);
    app.append(c);
  }

  function entrar() { carregar().then(render).catch(falha); }
  function sair() { api("POST", "sair").then(function () { telaLogin(); }, function () { telaLogin(); }); }

  function carregar() {
    return api("GET", "dados").then(function (d) {
      S.provas = d.provas; S.parceiros = d.parceiros; S.convites = d.convites;
      S.orcamentos = null; S.inscricoes = null;
    });
  }

  // ---------- dados combinados ----------
  function todasProvas() {
    var lista = S.provas.map(function (r) { return { id: r.id, nome: r.nome, data: r.data, fonte: r.publicada ? "publicada" : "rascunho", linha: r }; });
    ESTATICAS.forEach(function (p) {
      if (!lista.some(function (x) { return x.id === p.id; })) lista.push({ id: p.id, nome: p.nome, data: p.data, fonte: "codigo", obj: p });
    });
    return lista.sort(function (a, b) { return String(a.data).localeCompare(String(b.data)); });
  }
  function provaPorId(id) { return todasProvas().filter(function (p) { return p.id === id; })[0]; }
  function parceiroPorId(id) { return S.parceiros.filter(function (p) { return p.id === id; })[0]; }
  function opcoesProvas(incluirTodas) {
    var o = todasProvas().map(function (p) { return [p.id, p.nome + " · " + curta(p.data)]; });
    return incluirTodas ? [["", "Todas as provas"]].concat(o) : o;
  }

  // ---------- estrutura ----------
  var corpo;
  function render() {
    app.innerHTML = "";
    var topo = el("div", "painel-top");
    var quem = el("p", "muted", "Painel conectado ao banco do site.");
    var lado = acoes(
      botao("Atualizar dados", null, function () { carregar().then(function () { mostra(S.aba); aviso("Dados atualizados."); }).catch(falha); }),
      botao("Sair", null, sair)
    );
    topo.append(quem, lado);
    var abas = el("div", "cal-tabs painel-abas");
    abas.setAttribute("role", "group");
    abas.setAttribute("aria-label", "Seções do painel");
    [["provas", "Provas"], ["parceiros", "Parceiros"], ["convites", "Convites"], ["apuracao", "Apuração"],
      ["inscricoes", "Inscrições coletivas"], ["orcamentos", "Orçamentos"]].forEach(function (a) {
      var b = botao(a[1], "cal-tab", function () { mostra(a[0]); });
      b.dataset.aba = a[0];
      abas.append(b);
    });
    corpo = el("div", "painel-corpo");
    app.append(topo, abas, corpo);
    mostra(S.aba);
  }
  function mostra(aba) {
    S.aba = aba;
    app.querySelectorAll(".painel-abas .cal-tab").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.aba === aba)); });
    corpo.innerHTML = "";
    ({ provas: abaProvas, parceiros: abaParceiros, convites: abaConvites, apuracao: abaApuracao,
      inscricoes: abaInscricoes, orcamentos: abaOrcamentos })[aba]();
  }

  // =====================================================================
  //  PROVAS
  // =====================================================================
  function abaProvas() {
    var c = card("Calendário", "Provas");
    c.append(el("p", "muted", "Cadastre a prova e marque como publicada: a página da prova, o kit de divulgação e o card para stories saem prontos na hora."));
    c.append(acoes(botao("Nova prova", "btn btn--red", function () { formProva(null); })));
    var lista = todasProvas();
    if (!lista.length) c.append(el("p", "muted", "Nenhuma prova cadastrada ainda."));
    else {
      var nomes = { publicada: ["Publicada", "is-pub"], rascunho: ["Rascunho", "is-rasc"], codigo: ["No código (eventos.js)", "is-off"] };
      c.append(tabela(["Prova", "Data", "Situação", "Divulgadores", ""], lista.map(function (p) {
        var n = S.convites.filter(function (x) { return x.prova_id === p.id; }).length;
        var passada = dataDe(p.data) < hoje();
        var nome = el("div");
        nome.append(el("strong", null, p.nome));
        if (passada) nome.append(el("small", "muted", " (realizada)"));
        return [
          nome, curta(p.data), situacao(nomes[p.fonte][0], nomes[p.fonte][1]), String(n),
          acoes(
            botao(p.fonte === "codigo" ? "Trazer para o painel" : "Editar", null, function () { formProva(p); }),
            linkExt("Kit", base() + "kit.html?p=" + encodeURIComponent(p.id)),
            p.fonte !== "rascunho" ? linkExt("Página", base() + "prova-" + p.id + ".html") : null
          ),
        ];
      })));
    }
    corpo.append(c);
  }

  function formProva(item) {
    var r = item ? (item.linha || deObjeto(item.obj)) : null;
    var existe = !!(item && item.linha);
    corpo.innerHTML = "";
    var c = card(existe ? "Editar prova" : (item ? "Trazer para o painel" : "Nova prova"), r ? r.nome : "Dados da prova");
    if (item && !existe) c.append(el("p", "muted", "Esta prova está no js/eventos.js. Ao salvar, ela passa a ser editada por aqui e a versão do painel vale no site."));
    var f = el("form", "assess-grid");
    f.noValidate = true;
    r = r || {};
    var nome = entrada("text", r.nome, { maxLength: 120, required: true });
    var id = entrada("text", r.id, { maxLength: 60, required: true });
    id.disabled = !!item;
    var idManual = !!item;
    var dt = entrada("date", r.data, { required: true });
    var hora = entrada("text", r.hora, { placeholder: "08h00", maxLength: 10 });
    var local = entrada("text", r.local, { maxLength: 200 });
    var percursos = entrada("textarea", (r.percursos || []).join("\n"), { placeholder: "Caminhada 3 km\nCorrida 5 km\nCorrida 10 km" });
    var resumo = entrada("textarea", r.resumo, { maxLength: 400 });
    var poster = entrada("text", r.poster, { placeholder: "Envie a arte ao lado ou cole um endereço" });
    var arquivo = entrada("file", "", { accept: "image/*" });
    var previa = el("div", "painel-poster");
    function mostraPrevia(src) { previa.innerHTML = ""; if (src) { var im = el("img"); im.src = src; im.alt = "Arte atual"; previa.append(im); } }
    mostraPrevia(r.poster);
    arquivo.addEventListener("change", function () { if (arquivo.files[0]) mostraPrevia(URL.createObjectURL(arquivo.files[0])); });
    var inscricao = entrada("url", r.inscricao, { placeholder: "https://www.ticketsports.com.br/e/..." });
    var valores = entrada("textarea", (r.valores || []).map(function (v) {
      var cols = [v.nome || "", v.valor || "", v.detalhe || "", v.esgotado ? "esgotado" : ""];
      while (cols.length > 2 && !cols[cols.length - 1]) cols.pop();
      return cols.join(" | ");
    }).join("\n"), { placeholder: "Inscrição | R$ 90,00\n60+ e PcD | 50% de desconto | conforme a lei\n1º lote | R$ 80,00 | | esgotado" });
    var kitItens = entrada("textarea", ((r.kit || {}).itens || []).join("\n"), { placeholder: "Camiseta\nMedalha de participação\nNúmero de peito com chip" });
    var retirada = entrada("text", (r.kit || {}).retirada, { maxLength: 300 });
    var programacao = entrada("textarea", (r.programacao || []).map(function (p) { return p[0] + " | " + p[1]; }).join("\n"), { placeholder: "06h30 | Concentração\n07h00 | Largada" });
    var premiacao = entrada("text", r.premiacao, { maxLength: 300 });
    var mapa = entrada("url", r.percurso_mapa);
    var regulamento = entrada("url", r.regulamento);
    var resultados = entrada("url", r.resultados);
    var fotos = entrada("url", r.fotos);
    var realizacao = entrada("text", r.realizacao, { maxLength: 120 });
    var texto = entrada("textarea", r.texto_divulgacao, { maxLength: 1500 });
    var hashtags = entrada("text", r.hashtags, { placeholder: "#corridaderua #bh", maxLength: 200 });
    var publicada = marcador("Publicada (aparece no site)", r.publicada == null ? true : r.publicada);

    nome.addEventListener("input", function () {
      if (idManual) return;
      var ano = (dt.value || "").slice(0, 4);
      id.value = slug(nome.value) + (ano && nome.value.indexOf(ano) < 0 ? "-" + ano : "");
    });
    dt.addEventListener("change", function () { if (!idManual) nome.dispatchEvent(new Event("input")); });
    id.addEventListener("input", function () { idManual = true; });

    var colArte = el("div", "orc__field");
    colArte.append(el("span", null, "Arte da prova"), previa, arquivo, poster, el("small", "assess-dica", "De preferência JPG em pé (como o pôster). O painel reduz para até 1600 px."));

    f.append(
      campo("Nome da prova", nome, null, true),
      campo("Identificador (vai no endereço)", id, item ? "Não muda depois de criado." : "Gerado pelo nome; só letras minúsculas, números e hífen."),
      campo("Data", dt),
      campo("Horário da largada", hora),
      campo("Local da largada", local),
      campo("Percursos (um por linha)", percursos),
      campo("Resumo", resumo, "Uma ou duas frases sobre a prova."),
      colArte,
      campo("Link de inscrição (Ticket Sports)", inscricao, "O link público da página do evento, não o da ficha.", true),
      campo("Valores (um por linha: nome | valor | detalhe | esgotado)", valores, null, true),
      campo("Itens do kit (um por linha)", kitItens),
      campo("Retirada do kit", retirada, "Local, datas e horários."),
      campo("Programação (um por linha: hora | atividade)", programacao),
      campo("Premiação", premiacao),
      campo("Mapa do percurso (link)", mapa),
      campo("Regulamento (link)", regulamento),
      campo("Resultados (link)", resultados),
      campo("Fotos (link)", fotos),
      campo("Realização", realizacao, "Quem realiza ou contrata a prova."),
      campo("Hashtags", hashtags, "Vão nos textos do kit de divulgação."),
      campo("Texto de divulgação", texto, "Opcional. Vazio = o kit monta o texto sozinho com os dados da prova.", true)
    );
    var pl = el("div", "assess-grid__full"); pl.append(publicada); f.append(pl);
    var salvar = el("button", "btn btn--red btn--lg", "Salvar prova"); salvar.type = "submit";
    f.append(acoes(salvar, botao("Cancelar", null, function () { mostra("provas"); }),
      existe ? botao("Excluir prova", "orc__email painel-perigo", function () { excluirProva(r.id); }) : null));
    c.append(f);
    corpo.append(c);
    nome.focus();

    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var ident = id.value.trim();
      if (!nome.value.trim()) return aviso("Informe o nome da prova.", true);
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(ident)) return aviso("O identificador só pode ter letras minúsculas, números e hífen.", true);
      if (!dt.value) return aviso("Informe a data da prova.", true);
      var linha = {
        id: ident, nome: nome.value.trim(), data: dt.value, hora: hora.value.trim(), local: local.value.trim(),
        percursos: linhas(percursos.value), resumo: resumo.value.trim(), poster: poster.value.trim(), inscricao: inscricao.value.trim(),
        valores: linhas(valores.value).map(function (l) {
          var p = l.split("|").map(function (x) { return x.trim(); });
          var v = { nome: p[0], valor: p[1] || "" };
          if (p[2]) v.detalhe = p[2];
          if (/esgotad/i.test(p[3] || "")) v.esgotado = true;
          return v;
        }),
        kit: { itens: linhas(kitItens.value), retirada: retirada.value.trim() },
        programacao: linhas(programacao.value).map(function (l) { var i = l.indexOf("|"); return i < 0 ? [l, ""] : [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
        premiacao: premiacao.value.trim(), percurso_mapa: mapa.value.trim(), regulamento: regulamento.value.trim(),
        resultados: resultados.value.trim(), fotos: fotos.value.trim(), realizacao: realizacao.value.trim(),
        texto_divulgacao: texto.value.trim(), hashtags: hashtags.value.trim(), publicada: publicada.caixa.checked,
      };
      salvar.disabled = true; salvar.textContent = "Salvando...";
      var enviaArte = arquivo.files[0] ? comprime(arquivo.files[0]).then(function (blob) {
        return enviaImagem("provas", ident, blob, "image/jpeg").then(function (caminho) { linha.poster = "arquivos/" + caminho; });
      }) : Promise.resolve();
      enviaArte.then(function () {
        return existe ? api("PUT", "provas/" + encodeURIComponent(ident), linha) : api("POST", "provas", linha);
      }).then(function (salva) {
        S.provas = S.provas.filter(function (x) { return x.id !== ident; }).concat([salva]);
        mostra("provas");
        aviso(linha.publicada ? "Prova salva e já no site (pode levar até 1 minuto para aparecer)." : "Prova salva como rascunho: ela não aparece no site.");
      }).catch(function (err) { salvar.disabled = false; salvar.textContent = "Salvar prova"; falha(err); });
    });
  }

  function deObjeto(p) {
    return {
      id: p.id, nome: p.nome, data: p.data, hora: p.hora || "", local: p.local || "",
      percursos: Array.isArray(p.percursos) ? p.percursos : (p.percursos ? [p.percursos] : []),
      resumo: p.resumo || "", poster: p.poster || "", inscricao: p.inscricao || "", valores: p.valores || [],
      kit: p.kit || { itens: [], retirada: "" }, programacao: p.programacao || [], premiacao: p.premiacao || "",
      percurso_mapa: p.percursoMapa || "", regulamento: p.regulamento || "", resultados: p.resultados || "",
      fotos: p.fotos || "", realizacao: p.realizacao || "", texto_divulgacao: p.textoDivulgacao || "",
      hashtags: p.hashtags || "", publicada: true,
    };
  }

  function excluirProva(id) {
    var n = S.convites.filter(function (x) { return x.prova_id === id; }).length;
    if (!window.confirm("Excluir esta prova do painel? Ela sai do site." + (n ? " Os " + n + " convites dela continuam guardados." : ""))) return;
    api("DELETE", "provas/" + encodeURIComponent(id)).then(function () {
      S.provas = S.provas.filter(function (x) { return x.id !== id; });
      mostra("provas");
      aviso("Prova excluída do painel.");
    }).catch(falha);
  }

  // Reduz a arte para JPG de até 1600 px (a prévia do WhatsApp lê melhor JPG)
  function comprime(file) {
    return new Promise(function (ok, erro) {
      if (!/^image\//.test(file.type)) return erro(new Error("o arquivo da arte não é uma imagem"));
      var img = new Image();
      img.onload = function () {
        var esc = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
        var cv = document.createElement("canvas");
        cv.width = Math.round(img.naturalWidth * esc); cv.height = Math.round(img.naturalHeight * esc);
        var cx = cv.getContext("2d");
        cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height);
        cx.drawImage(img, 0, 0, cv.width, cv.height);
        cv.toBlob(function (b) { b ? ok(b) : erro(new Error("não consegui converter a arte")); }, "image/jpeg", 0.88);
      };
      img.onerror = function () { erro(new Error("não consegui abrir a imagem")); };
      img.src = URL.createObjectURL(file);
    });
  }

  // =====================================================================
  //  PARCEIROS
  // =====================================================================
  var filtroTipo = "", busca = "";
  function abaParceiros() {
    var c = card("Cadastro", "Parceiros");
    c.append(el("p", "muted", "Embaixadores, influenciadores, assessorias e equipes. Cada parceiro pode ter convites em várias provas."));
    var tipo = escolha([["", "Todos os tipos"]].concat(Object.keys(TIPOS).map(function (k) { return [k, TIPOS[k]]; })), filtroTipo);
    var q = entrada("search", busca, { placeholder: "Buscar por nome, cidade ou Instagram" });
    var filtros = el("div", "painel-filtros");
    filtros.append(campo("Tipo", tipo), campo("Busca", q), botao("Novo parceiro", "btn btn--red", function () { formParceiro(null); }));
    c.append(filtros);
    var area = el("div");
    c.append(area);
    function desenha() {
      filtroTipo = tipo.value; busca = q.value;
      var termo = slug(busca).replace(/-/g, " ");
      var lista = S.parceiros.filter(function (p) {
        if (filtroTipo && p.tipo !== filtroTipo) return false;
        if (!termo) return true;
        return slug([p.nome, p.responsavel, p.cidade, p.instagram].join(" ")).replace(/-/g, " ").indexOf(termo) >= 0;
      });
      area.innerHTML = "";
      if (!lista.length) { area.append(el("p", "muted", S.parceiros.length ? "Nenhum parceiro com esse filtro." : "Nenhum parceiro cadastrado ainda.")); return; }
      area.append(tabela(["Nome", "Tipo", "Contato", "Convites", "Situação", ""], lista.map(function (p) {
        var nome = el("div"); nome.append(el("strong", null, p.nome));
        if (p.responsavel) nome.append(el("small", "muted", " · " + p.responsavel));
        if (p.profissao === PROFISSOES[0]) {
          var okCref = p.registro_conferido_em && /^ATIVO$/i.test(p.registro_situacao);
          nome.append(" ", situacao(okCref ? "CREF6 ativo" : (p.registro_conferido_em ? "CREF6: " + (p.registro_situacao || "?") : "CREF6 não conferido"), okCref ? "is-pub" : "is-rasc"));
        }
        var contato = el("div");
        if (p.whatsapp) contato.append(linkExt(p.whatsapp, "https://wa.me/" + numeroWa(p.whatsapp)));
        if (p.instagram) { if (p.whatsapp) contato.append(" "); contato.append(linkExt("@" + p.instagram.replace(/^@/, ""), "https://www.instagram.com/" + p.instagram.replace(/^@/, "") + "/")); }
        return [nome, TIPOS[p.tipo], contato,
          String(S.convites.filter(function (x) { return x.parceiro_id === p.id; }).length),
          situacao(p.ativo ? "Ativo" : "Inativo", p.ativo ? "is-pub" : "is-off"),
          acoes(botao("Editar", null, function () { formParceiro(p); }), p.ativo ? botao("Novo convite", null, function () { formConvite(null, { parceiro_id: p.id }); }) : null)];
      })));
    }
    tipo.addEventListener("change", desenha);
    q.addEventListener("input", desenha);
    desenha();
    corpo.append(c);
  }
  function numeroWa(t) { var n = String(t || "").replace(/\D/g, ""); if (n && n.length <= 11) n = "55" + n; return n; }

  function formParceiro(p) {
    corpo.innerHTML = "";
    var c = card(p ? "Editar parceiro" : "Novo parceiro", p ? p.nome : "Dados do parceiro");
    p = p || { tipo: "embaixador", ativo: true };
    var f = el("form", "assess-grid"); f.noValidate = true;
    var tipo = escolha(Object.keys(TIPOS).map(function (k) { return [k, TIPOS[k]]; }), p.tipo);
    var nome = entrada("text", p.nome, { maxLength: 120, required: true });
    var resp = entrada("text", p.responsavel, { maxLength: 120 });
    var wa = entrada("tel", p.whatsapp, { placeholder: "(31) 90000-0000", maxLength: 20 });
    var email = entrada("email", p.email, { maxLength: 120 });
    var insta = entrada("text", p.instagram, { placeholder: "@perfil", maxLength: 60 });
    var cidade = entrada("text", p.cidade, { maxLength: 80 });
    var doc = entrada("text", p.documento, { maxLength: 20, placeholder: "CPF ou CNPJ" });
    var pix = entrada("text", p.pix, { maxLength: 120 });
    var obs = entrada("textarea", p.observacoes, { maxLength: 1000 });
    var ativo = marcador("Ativo (aparece na lista para novos convites)", p.ativo);
    f.append(
      campo("Tipo", tipo), campo("Nome", nome, "Pessoa, perfil ou nome da assessoria/equipe."),
      campo("Responsável", resp, "Para assessoria e equipe: quem fala pela equipe."),
      campo("WhatsApp", wa), campo("E-mail", email), campo("Instagram", insta), campo("Cidade", cidade),
      campo("CPF ou CNPJ", doc, "Para o pagamento da comissão."), campo("Chave Pix", pix, "Em nome do próprio parceiro."),
      campo("Observações", obs, null, true)
    );

    // Profissional (embaixador/influenciador): tipo e, no CREF6/MG, registro
    // conferido na consulta pública do CREF6 (rota api/admin/cref6).
    var prof = escolha([["", "Não informado"]].concat(PROFISSOES.map(function (x) { return [x, x]; })), p.profissao || "");
    var reg = entrada("text", p.registro, { maxLength: 20, placeholder: "012345-G/MG" });
    var conf = { registro: p.registro || "", situacao: p.registro_situacao || "", nome: p.registro_nome || "", em: p.registro_conferido_em || "", categoria: "" };
    var resultadoCref = el("div", "painel-cref");
    var validar = botao("Validar no CREF6", "btn btn--line", validarCref);
    var colReg = el("div", "orc__field");
    colReg.append(el("span", null, "Número do CREF6"), reg, validar, resultadoCref);
    var blocoProf = el("div", "assess-grid__full painel-identidade");
    blocoProf.append(campo("Tipo de profissional", prof), colReg);
    f.append(blocoProf);
    function ehCref6() { return prof.value === PROFISSOES[0]; }
    function palavras(s) { return slug(s).split("-").filter(function (x) { return x.length > 2; }); }
    function nomeConfere() {
      var cad = palavras(nome.value), cref = palavras(conf.nome);
      return !cad.length || !cref.length || cad.every(function (x) { return cref.indexOf(x) >= 0; });
    }
    function mostraCref() {
      resultadoCref.innerHTML = "";
      if (!ehCref6()) return;
      if (!conf.em) {
        if (reg.value.trim()) resultadoCref.append(el("small", "assess-dica", "Ainda não conferido no CREF6."));
        return;
      }
      if (conf.situacao === "NÃO ENCONTRADO") {
        resultadoCref.append(el("p", "assess-alerta", "O registro " + conf.registro + " não foi encontrado no CREF6. Confira o número com o parceiro."));
        return;
      }
      var ok = el("p", "painel-cref__ok");
      ok.append(el("strong", null, conf.nome), document.createTextNode(" · " + [conf.categoria, conf.situacao].filter(Boolean).join(" · ")),
        el("small", null, " Conferido em " + new Date(conf.em).toLocaleDateString("pt-BR") + "."));
      resultadoCref.append(ok);
      if (!/^ATIVO$/i.test(conf.situacao)) resultadoCref.append(el("p", "assess-alerta", "Situação no CREF6: " + conf.situacao + ". O registro não está ativo."));
      if (!nomeConfere()) resultadoCref.append(el("p", "assess-alerta", "O nome no CREF6 (" + conf.nome + ") é diferente do nome do cadastro. Confira se o registro é mesmo desta pessoa."));
    }
    function validarCref() {
      if (!reg.value.trim()) { aviso("Informe o número do CREF6.", true); reg.focus(); return; }
      validar.disabled = true; validar.textContent = "Consultando o CREF6...";
      api("GET", "cref6?numero=" + encodeURIComponent(reg.value.trim())).then(function (r) {
        validar.disabled = false; validar.textContent = "Validar no CREF6";
        if (!r.ok && r.erro === "numero") { conf.em = ""; mostraCref(); resultadoCref.append(el("p", "assess-alerta", "Número inválido. Use o formato 012345-G/MG.")); return; }
        if (!r.ok) {
          conf.em = ""; mostraCref();
          var fora = el("p", "assess-alerta", "O CREF6 está fora do ar ou mudou a página. Confira à mão: ");
          fora.append(linkExt("consulta pública do CREF6", "https://portal.cref6.org.br/spw/ConsultaCadastral/TelaConsultaPublicaCompleta.aspx"));
          fora.append(". Dá para salvar assim, como não conferido.");
          resultadoCref.append(fora);
          return;
        }
        conf = { registro: r.registro, em: new Date().toISOString(), situacao: r.encontrado ? r.situacao : "NÃO ENCONTRADO", nome: r.encontrado ? r.nome : "", categoria: r.categoria || "" };
        reg.value = r.registro;
        mostraCref();
      }).catch(function (e) { validar.disabled = false; validar.textContent = "Validar no CREF6"; falha(e); });
    }
    reg.addEventListener("input", function () { if (reg.value.trim() !== conf.registro) { conf.em = ""; mostraCref(); } });
    nome.addEventListener("input", function () { if (conf.em) mostraCref(); });
    function mostraProf() {
      var equipeT = tipo.value === "assessoria" || tipo.value === "equipe";
      blocoProf.hidden = equipeT;
      colReg.hidden = !ehCref6();
      mostraCref();
    }
    prof.addEventListener("change", mostraProf);
    tipo.addEventListener("change", mostraProf);
    mostraProf();

    // Assessoria/equipe: logo e cor usadas na inscrição coletiva e na página da equipe.
    // logo = CAMINHO em /arquivos (assessorias/<id>-<tempo>.png); cor = "rrggbb".
    var idt = el("div", "assess-grid__full painel-identidade");
    var logoAtual = p.logo || "", logoNovo = null;
    var logoPrev = el("div", "painel-poster");
    function mostraLogo(src) { logoPrev.innerHTML = ""; if (src) { var im = el("img", "painel-logo"); im.alt = "Logo da equipe"; im.src = src; logoPrev.append(im); } }
    mostraLogo(urlArquivo(logoAtual));
    var logoArq = entrada("file", "", { accept: "image/png,image/jpeg,image/webp" });
    logoArq.addEventListener("change", function () { logoNovo = logoArq.files[0] || null; if (logoNovo) mostraLogo(URL.createObjectURL(logoNovo)); });
    var tirar = botao("Tirar a logo", null, function () { logoAtual = ""; logoNovo = null; logoArq.value = ""; mostraLogo(""); });
    var colLogo = el("div", "orc__field");
    colLogo.append(el("span", null, "Logo da equipe"), logoPrev, logoArq, tirar, el("small", "assess-dica", "PNG com fundo transparente fica melhor. O painel reduz para até 400 px."));
    var usaCor = marcador("Usar cor da equipe", /^[0-9a-f]{6}$/i.test(p.cor || ""));
    var cor = entrada("color", "#" + (/^[0-9a-f]{6}$/i.test(p.cor || "") ? p.cor : "24325a"));
    cor.addEventListener("input", function () { usaCor.caixa.checked = true; });
    var colCor = el("div", "orc__field");
    colCor.append(el("span", null, "Cor da equipe"), cor, usaCor, el("small", "assess-dica", "Aparece na página da equipe e na inscrição coletiva."));
    idt.append(colLogo, colCor);
    f.append(idt);
    function mostraIdentidade() { idt.hidden = !(tipo.value === "assessoria" || tipo.value === "equipe"); }
    tipo.addEventListener("change", mostraIdentidade);
    mostraIdentidade();
    var al = el("div", "assess-grid__full"); al.append(ativo); f.append(al);
    var salvar = el("button", "btn btn--red btn--lg", "Salvar parceiro"); salvar.type = "submit";
    f.append(acoes(salvar, botao("Cancelar", null, function () { mostra("parceiros"); }),
      p.id ? botao("Excluir parceiro", "orc__email painel-perigo", function () { excluirParceiro(p); }) : null));
    c.append(f);
    corpo.append(c);
    nome.focus();
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!nome.value.trim()) return aviso("Informe o nome do parceiro.", true);
      var linha = {
        tipo: tipo.value, nome: nome.value.trim(), responsavel: resp.value.trim(), whatsapp: wa.value.trim(),
        email: email.value.trim(), instagram: insta.value.trim().replace(/^@/, ""), cidade: cidade.value.trim(),
        documento: doc.value.trim(), pix: pix.value.trim(), observacoes: obs.value.trim(), ativo: ativo.caixa.checked,
      };
      var equipe = tipo.value === "assessoria" || tipo.value === "equipe";
      linha.profissao = equipe ? "" : prof.value;
      var cref = !equipe && ehCref6();
      if (cref && !reg.value.trim()) { reg.focus(); return aviso("Informe o número do CREF6 (ou escolha outro tipo de profissional).", true); }
      linha.registro = cref ? reg.value.trim() : "";
      linha.registro_situacao = cref && conf.em ? conf.situacao : "";
      linha.registro_nome = cref && conf.em ? conf.nome : "";
      linha.registro_conferido_em = cref && conf.em ? conf.em : "";
      if (equipe) {
        linha.cor = usaCor.caixa.checked ? cor.value.replace(/^#/, "").toLowerCase() : "";
        if (!logoNovo) linha.logo = logoAtual;
      }
      salvar.disabled = true; salvar.textContent = "Salvando...";
      var q = p.id ? api("PUT", "parceiros/" + encodeURIComponent(p.id), linha) : api("POST", "parceiros", linha);
      q.then(function (salvo) {
        if (!(equipe && logoNovo)) return salvo;
        // o id só existe depois do insert: insert -> upload -> update do campo logo.
        // Nome novo a cada envio e o arquivo antigo fica (links já enviados apontam para ele).
        return comprimeLogo(logoNovo).then(function (blob) {
          return enviaImagem("assessorias", salvo.id, blob, "image/png");
        }).then(function (caminho) {
          return api("PUT", "parceiros/" + encodeURIComponent(salvo.id), { logo: caminho });
        });
      }).then(function (salvo) {
        S.parceiros = S.parceiros.filter(function (x) { return x.id !== salvo.id; }).concat([salvo])
          .sort(function (a, b) { return a.nome.localeCompare(b.nome); });
        mostra("parceiros");
        aviso("Parceiro salvo.");
      }).catch(function (err) { salvar.disabled = false; salvar.textContent = "Salvar parceiro"; falha(err); });
    });
  }

  // Logo: PNG de até 400 px, mantendo a transparência
  function comprimeLogo(file) {
    return new Promise(function (ok, erro) {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return erro(new Error("a logo precisa ser PNG, JPG ou WebP"));
      var img = new Image();
      img.onload = function () {
        var esc = Math.min(1, 400 / Math.max(img.naturalWidth, img.naturalHeight));
        var cv = document.createElement("canvas");
        cv.width = Math.max(1, Math.round(img.naturalWidth * esc)); cv.height = Math.max(1, Math.round(img.naturalHeight * esc));
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        cv.toBlob(function (b) { b ? ok(b) : erro(new Error("não consegui converter a logo")); }, "image/png");
      };
      img.onerror = function () { erro(new Error("não consegui abrir a logo")); };
      img.src = URL.createObjectURL(file);
    });
  }
  function excluirParceiro(p) {
    var n = S.convites.filter(function (x) { return x.parceiro_id === p.id; }).length;
    if (!window.confirm("Excluir " + p.nome + "?" + (n ? " Os " + n + " convites dele também serão apagados. Para só esconder, desmarque \"Ativo\"." : ""))) return;
    api("DELETE", "parceiros/" + encodeURIComponent(p.id)).then(function () {
      S.parceiros = S.parceiros.filter(function (x) { return x.id !== p.id; });
      S.convites = S.convites.filter(function (x) { return x.parceiro_id !== p.id; });
      mostra("parceiros");
      aviso("Parceiro excluído.");
    }).catch(falha);
  }

  // =====================================================================
  //  CONVITES
  // =====================================================================
  var filtroProva = "";
  function abaConvites() {
    var c = card("Divulgação", "Convites");
    c.append(el("p", "muted", "Um convite liga um parceiro a uma prova, com o cupom criado na Ticket Sports. Dele saem o link para os atletas, o kit de divulgação e a mensagem pronta."));
    var prova = escolha(opcoesProvas(true), filtroProva);
    var filtros = el("div", "painel-filtros");
    filtros.append(campo("Prova", prova), botao("Novo convite", "btn btn--red", function () { formConvite(null, { prova_id: prova.value }); }));
    c.append(filtros);
    var area = el("div"); c.append(area);
    function desenha() {
      filtroProva = prova.value;
      var lista = S.convites.filter(function (x) { return !filtroProva || x.prova_id === filtroProva; });
      area.innerHTML = "";
      if (!S.parceiros.length) area.append(el("p", "assess-alerta", "Cadastre primeiro os parceiros na aba Parceiros."));
      if (!lista.length) { area.append(el("p", "muted", "Nenhum convite" + (filtroProva ? " nesta prova." : " ainda."))); return; }
      area.append(tabela(["Prova", "Parceiro", "Cupom", "Comissão", "Cortesias", ""], lista.map(function (cv) {
        var pv = provaPorId(cv.prova_id), pa = parceiroPorId(cv.parceiro_id);
        var quem = el("div"); quem.append(el("strong", null, pa ? pa.nome : "(parceiro apagado)"));
        if (pa) quem.append(el("small", "muted", " · " + TIPOS[pa.tipo]));
        return [pv ? pv.nome : cv.prova_id, quem, el("code", "painel-cupom", cv.cupom),
          Number(cv.comissao_pct) ? String(cv.comissao_pct).replace(".", ",") + "%" : "—",
          cv.cortesias ? String(cv.cortesias) : "—",
          acoes(botao("Links e mensagem", null, function () { detalheConvite(cv); }),
            botao("Editar", null, function () { formConvite(cv); }),
            botao("Excluir", "orc__email painel-perigo", function () { excluirConvite(cv); }))];
      })));
    }
    prova.addEventListener("change", desenha);
    desenha();
    corpo.append(c);
  }

  function formConvite(cv, padrao) {
    corpo.innerHTML = "";
    var c = card(cv ? "Editar convite" : "Novo convite", "Parceiro na prova");
    cv = cv || Object.assign({ desconto: "", comissao_pct: 0, cortesias: 0 }, padrao || {});
    var ativos = S.parceiros.filter(function (p) { return p.ativo || p.id === cv.parceiro_id; });
    if (!ativos.length) { c.append(el("p", "assess-alerta", "Cadastre um parceiro antes de criar convites.")); c.append(botao("Ir para Parceiros", "btn btn--red", function () { mostra("parceiros"); })); corpo.append(c); return; }
    var f = el("form", "assess-grid"); f.noValidate = true;
    var futuras = opcoesProvas(false);
    var prova = escolha(futuras, cv.prova_id || (futuras.filter(function (o) { var p = provaPorId(o[0]); return dataDe(p.data) >= hoje(); })[0] || futuras[0] || [""])[0]);
    var parceiro = escolha(ativos.map(function (p) { return [p.id, p.nome + " · " + TIPOS[p.tipo]]; }), cv.parceiro_id);
    var cupom = entrada("text", cv.cupom, { maxLength: 40, required: true, placeholder: "Ex.: ANA10" });
    cupom.addEventListener("input", function () { var pos = cupom.selectionStart; cupom.value = cupom.value.toUpperCase(); cupom.setSelectionRange(pos, pos); });
    var sugerir = botao("Sugerir cupom", null, function () {
      var pa = parceiroPorId(parceiro.value);
      var primeiro = slug(pa ? pa.nome : "").split("-")[0] || "TARDIM";
      cupom.value = (primeiro.toUpperCase().slice(0, 12) + (desconto.value.replace(/\D/g, "") || "")).slice(0, 40);
    });
    var desconto = entrada("text", cv.desconto, { placeholder: "10%", maxLength: 20 });
    var comissao = entrada("number", cv.comissao_pct, { min: 0, max: 100, step: 0.5 });
    var cortesias = entrada("number", cv.cortesias, { min: 0, max: 50, step: 1 });
    var contrapartida = entrada("text", cv.contrapartida, { maxLength: 300, placeholder: "Ex.: 2 posts no feed e 3 stories até 01/12" });
    var condicoes = entrada("textarea", cv.condicoes, { maxLength: 1000 });
    var colCupom = el("div", "orc__field");
    colCupom.append(el("span", null, "Cupom"), cupom, sugerir, el("small", "assess-dica", "Crie igualzinho na Ticket Sports: Promover > Cupons de desconto, tipo individual, vinculado às modalidades."));
    f.append(campo("Prova", prova), campo("Parceiro", parceiro), colCupom,
      campo("Desconto do cupom", desconto, "Só para aparecer na mensagem e no kit. O desconto de verdade é o da Ticket Sports."),
      campo("Comissão (% por inscrição paga)", comissao), campo("Cortesias", cortesias, "Inscrições gratuitas para o próprio parceiro."),
      campo("Contrapartida da cortesia", contrapartida, null, true), campo("Outras condições", condicoes, "Vão na mensagem do convite.", true));
    var salvar = el("button", "btn btn--red btn--lg", "Salvar convite"); salvar.type = "submit";
    f.append(acoes(salvar, botao("Cancelar", null, function () { mostra("convites"); })));
    c.append(f);
    corpo.append(c);
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var cod = cupom.value.trim().toUpperCase();
      if (!/^[A-Z0-9_-]{3,40}$/.test(cod)) return aviso("O cupom precisa ter de 3 a 40 letras, números, hífen ou sublinhado, sem espaços nem acentos.", true);
      if (!prova.value) return aviso("Escolha a prova.", true);
      var linha = {
        prova_id: prova.value, parceiro_id: parceiro.value, cupom: cod, desconto: desconto.value.trim(),
        comissao_pct: Number(comissao.value) || 0, cortesias: parseInt(cortesias.value, 10) || 0,
        contrapartida: contrapartida.value.trim(), condicoes: condicoes.value.trim(),
      };
      salvar.disabled = true;
      var q = cv.id ? api("PUT", "convites/" + encodeURIComponent(cv.id), linha) : api("POST", "convites", linha);
      q.then(function (salvo) {
        S.convites = [salvo].concat(S.convites.filter(function (x) { return x.id !== salvo.id; }));
        filtroProva = salvo.prova_id;
        detalheConvite(salvo);
        aviso("Convite salvo. Confira se o cupom " + cod + " existe na Ticket Sports.");
      }).catch(function (err) { salvar.disabled = false; falha(err); });
    });
  }

  function excluirConvite(cv) {
    if (!window.confirm("Excluir o convite do cupom " + cv.cupom + "? O cupom na Ticket Sports continua existindo.")) return;
    api("DELETE", "convites/" + encodeURIComponent(cv.id)).then(function () {
      S.convites = S.convites.filter(function (x) { return x.id !== cv.id; });
      mostra("convites");
      aviso("Convite excluído.");
    }).catch(falha);
  }

  function linksConvite(cv) {
    var pa = parceiroPorId(cv.parceiro_id) || { nome: "", tipo: "" };
    var b = base();
    var l = {
      atleta: b + "prova-" + cv.prova_id + ".html?cupom=" + encodeURIComponent(cv.cupom),
      kit: b + "kit.html?p=" + encodeURIComponent(cv.prova_id) + "&c=" + encodeURIComponent(cv.cupom) + "&n=" + encodeURIComponent(pa.nome) +
        (cv.desconto ? "&d=" + encodeURIComponent(cv.desconto) : ""),
    };
    if ((pa.tipo === "assessoria" || pa.tipo === "equipe") && window.CONVITE) {
      l.coletiva = b + "assessorias.html?c=" + CONVITE.gera({
        p: cv.prova_id, e: pa.nome, d: "", m: 0, a: pa.id, t: pa.responsavel || "",
        w: numeroWa(pa.whatsapp), c: (pa.cor || "").replace(/^#/, ""), l: pa.logo || "", k: cv.cortesias || 0,
      });
    }
    return l;
  }

  function mensagem(cv) {
    var pa = parceiroPorId(cv.parceiro_id) || { nome: "" };
    var pv = provaPorId(cv.prova_id) || { nome: cv.prova_id, data: "" };
    var l = linksConvite(cv);
    var partes = ["Olá, " + (pa.responsavel || pa.nome) + "! Aqui está o seu material de divulgação da " + pv.nome + (pv.data ? " (" + quando(pv.data) + ")" : "") + "."];
    partes.push("Seu link para os atletas:\n" + l.atleta);
    partes.push("Seu cupom: " + cv.cupom + (cv.desconto ? " (" + cv.desconto + " de desconto)" : ""));
    partes.push("Kit com a arte, textos prontos e card para stories:\n" + l.kit);
    if (l.coletiva) partes.push("Inscrição coletiva da equipe (planilha):\n" + l.coletiva);
    var cond = [];
    if (Number(cv.comissao_pct)) cond.push("comissão de " + String(cv.comissao_pct).replace(".", ",") + "% sobre cada inscrição paga com o seu cupom");
    if (cv.cortesias) cond.push(cv.cortesias + (cv.cortesias > 1 ? " inscrições" : " inscrição") + " de cortesia para você" + (cv.contrapartida ? ", em troca de: " + cv.contrapartida : ""));
    if (cond.length) partes.push("Condições: " + cond.join("; ") + ".");
    if (cv.condicoes) partes.push(cv.condicoes);
    partes.push("Regras do programa:\n" + base() + "programa-embaixadores.html");
    partes.push("Tardim Produções");
    return partes.join("\n\n");
  }

  function detalheConvite(cv) {
    S.aba = "convites";
    app.querySelectorAll(".painel-abas .cal-tab").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.aba === "convites")); });
    corpo.innerHTML = "";
    var pa = parceiroPorId(cv.parceiro_id) || { nome: "", whatsapp: "" };
    var pv = provaPorId(cv.prova_id) || { nome: cv.prova_id };
    var c = card("Convite pronto", pa.nome);
    c.append(el("p", "muted", pv.nome + " · cupom " + cv.cupom));
    if (pv.fonte === "rascunho") c.append(el("p", "assess-alerta", "Esta prova está como rascunho: a página dela só existe depois de publicada."));
    var pr = pv.linha || pv.obj || {};
    if (!pr.inscricao) c.append(el("p", "assess-alerta", "Esta prova ainda não tem o link da Ticket Sports: o botão de inscrição vai abrir o Linktree."));
    var l = linksConvite(cv);
    var caixa = el("div", "painel-links");
    [["Link para os atletas", l.atleta], ["Kit de divulgação", l.kit], l.coletiva ? ["Inscrição coletiva", l.coletiva] : null].forEach(function (x) {
      if (!x) return;
      var linha = el("div", "convite-link");
      var i = entrada("text", x[1], { readOnly: true });
      i.setAttribute("aria-label", x[0]);
      i.addEventListener("focus", function () { i.select(); });
      var cp = botao("Copiar", null, function () { copiar(x[1], cp); });
      linha.append(el("span", "painel-links__t", x[0]), i, acoes(cp, linkExt("Abrir", x[1])));
      caixa.append(linha);
    });
    c.append(caixa);
    var msg = entrada("textarea", mensagem(cv));
    var cm = campo("Mensagem para o parceiro (pode editar antes de enviar)", msg, null, true);
    cm.classList.add("painel-msg");
    c.append(cm);
    var numero = numeroWa(pa.whatsapp);
    var wa = el("a", "btn btn--wa", numero ? "Enviar no WhatsApp de " + (pa.responsavel || pa.nome) : "Enviar no WhatsApp");
    wa.target = "_blank"; wa.rel = "noopener";
    function atualizaWa() { wa.href = "https://wa.me/" + numero + "?text=" + encodeURIComponent(msg.value); }
    msg.addEventListener("input", atualizaWa);
    atualizaWa();
    var cpm = botao("Copiar mensagem", "btn btn--line", function () { copiar(msg.value, cpm); });
    c.append(acoes(wa, cpm, botao("Voltar para os convites", null, function () { mostra("convites"); })));
    corpo.append(c);
    c.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // =====================================================================
  //  APURAÇÃO (relatório exportado da Ticket Sports)
  // =====================================================================
  function abaApuracao() {
    var c = card("Comissões", "Apuração");
    c.append(el("p", "muted", "Exporte o relatório de inscritos da prova na Ticket Sports e solte o arquivo aqui. O painel soma as inscrições pagas por cupom e calcula a comissão de cada parceiro. O arquivo é lido só no seu navegador."));
    var prova = escolha(opcoesProvas(false), filtroProva || "");
    var drop = el("label", "assess-drop");
    var arq = entrada("file", "", { accept: ".xlsx,.xls,.csv" });
    arq.className = "sr-only";
    drop.append(el("b", null, "Solte o relatório aqui"), el("span", null, "ou clique para escolher (Excel ou CSV)"), arq);
    var linhaTopo = el("div", "painel-filtros");
    linhaTopo.append(campo("Prova", prova));
    c.append(linhaTopo, drop);
    var area = el("div"); c.append(area);
    corpo.append(c);

    ["dragover", "dragenter"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("is-over"); }); });
    ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function () { drop.classList.remove("is-over"); }); });
    drop.addEventListener("drop", function (e) { e.preventDefault(); if (e.dataTransfer.files[0]) le(e.dataTransfer.files[0]); });
    arq.addEventListener("change", function () { if (arq.files[0]) le(arq.files[0]); });
    prova.addEventListener("change", function () { filtroProva = prova.value; if (dados) monta(); });

    var dados = null;
    function le(file) {
      if (!window.XLSX) return aviso("A biblioteca de planilhas não carregou. Recarregue a página.", true);
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var wb = XLSX.read(new Uint8Array(rd.result), { type: "array" });
          var rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: true });
          var h = rows.findIndex(function (r) { return r.filter(function (x) { return String(x).trim(); }).length >= 3; });
          if (h < 0) throw new Error("não achei o cabeçalho");
          dados = { arquivo: file.name, cab: rows[h].map(function (x) { return String(x).trim(); }), linhas: rows.slice(h + 1).filter(function (r) { return r.some(function (x) { return String(x).trim(); }); }) };
          monta();
        } catch (e) { aviso("Não consegui ler o arquivo: " + e.message, true); }
      };
      rd.readAsArrayBuffer(file);
    }

    function acha(re) { var i = dados.cab.findIndex(function (h) { return re.test(h); }); return i < 0 ? "" : String(i); }
    function monta() {
      area.innerHTML = "";
      var ops = [["", "— não usar —"]].concat(dados.cab.map(function (h, i) { return [String(i), h || "Coluna " + (i + 1)]; }));
      var colCupom = escolha(ops, acha(/cupom|voucher|promo/i));
      var colValor = escolha(ops, acha(/valor.*(pago|l[ií]quido|total)|^valor$|total pago|pre[çc]o/i));
      var colSit = escolha(ops, acha(/status|situa[çc]/i));
      var grade = el("div", "assess-grid");
      grade.append(campo("Coluna do cupom", colCupom), campo("Coluna do valor pago", colValor), campo("Coluna da situação do pagamento", colSit, "Para contar só as inscrições pagas."));
      var sitBox = el("div", "assess-grid__full painel-sits");
      grade.append(sitBox);
      area.append(el("p", "assess-status", dados.arquivo + ": " + dados.linhas.length + " linhas."), grade);
      var resultado = el("div"); area.append(resultado);

      var marcadas = {};
      function situacoes() {
        sitBox.innerHTML = "";
        if (colSit.value === "") return;
        var vals = {};
        dados.linhas.forEach(function (r) { var v = String(r[colSit.value]).trim() || "(vazio)"; vals[v] = (vals[v] || 0) + 1; });
        sitBox.append(el("span", "painel-sits__t", "Conta como paga:"));
        Object.keys(vals).sort().forEach(function (v) {
          if (marcadas[v] == null) marcadas[v] = /pag|aprov|confirm|conclu|ativ|efetiv/i.test(v) && !/n[aã]o|cancel|estorn|pend|recus|expir|devol|aguard/i.test(v);
          var m = marcador(v + " (" + vals[v] + ")", marcadas[v]);
          m.caixa.addEventListener("change", function () { marcadas[v] = m.caixa.checked; calcula(); });
          sitBox.append(m);
        });
      }
      [colCupom, colValor].forEach(function (s) { s.addEventListener("change", calcula); });
      colSit.addEventListener("change", function () { situacoes(); calcula(); });
      situacoes();
      calcula();

      function calcula() {
        resultado.innerHTML = "";
        if (colCupom.value === "") { resultado.append(el("p", "assess-alerta", "Escolha a coluna do cupom.")); return; }
        var convs = S.convites.filter(function (x) { return x.prova_id === prova.value; });
        var porCupom = {};
        convs.forEach(function (cv) { porCupom[cv.cupom] = { cv: cv, n: 0, total: 0 }; });
        var soltos = {};
        var pagas = 0;
        dados.linhas.forEach(function (r) {
          var cod = String(r[colCupom.value]).trim().toUpperCase();
          if (!cod) return;
          if (colSit.value !== "" && !marcadas[String(r[colSit.value]).trim() || "(vazio)"]) return;
          pagas++;
          var v = colValor.value === "" ? 0 : valorNum(r[colValor.value]);
          if (porCupom[cod]) { porCupom[cod].n++; porCupom[cod].total += v; }
          else soltos[cod] = (soltos[cod] || 0) + 1;
        });
        var linhasRes = Object.keys(porCupom).map(function (k) {
          var x = porCupom[k], pa = parceiroPorId(x.cv.parceiro_id) || { nome: "?", tipo: "" };
          var pct = Number(x.cv.comissao_pct) || 0;
          return { parceiro: pa.nome, tipo: TIPOS[pa.tipo] || "", pix: pa.pix || "", cupom: k, inscricoes: x.n, valor: x.total, pct: pct, comissao: Math.round(x.total * pct) / 100 };
        }).sort(function (a, b) { return b.inscricoes - a.inscricoes; });
        if (!convs.length) resultado.append(el("p", "assess-alerta", "Esta prova não tem convites cadastrados."));
        var tot = linhasRes.reduce(function (a, x) { a.n += x.inscricoes; a.v += x.valor; a.c += x.comissao; return a; }, { n: 0, v: 0, c: 0 });
        var nums = el("div", "assess-nums");
        [[String(pagas), "inscrições com cupom contadas"], [String(tot.n), "dos parceiros"], [reais(tot.c), "de comissão a pagar"]].forEach(function (n) {
          var d = el("div", "assess-num"); d.append(el("b", null, n[0]), el("span", null, n[1])); nums.append(d);
        });
        resultado.append(nums);
        if (linhasRes.length) {
          resultado.append(tabela(["Parceiro", "Cupom", "Inscrições", "Valor pago", "Comissão", "A pagar"], linhasRes.map(function (x) {
            return [x.parceiro + (x.tipo ? " · " + x.tipo : ""), x.cupom, String(x.inscricoes), colValor.value === "" ? "—" : reais(x.valor), x.pct ? String(x.pct).replace(".", ",") + "%" : "—", colValor.value === "" ? "—" : reais(x.comissao)];
          })));
        }
        var ks = Object.keys(soltos);
        if (ks.length) {
          var s = el("p", "assess-alerta", "Cupons usados que não são de nenhum convite desta prova: " + ks.map(function (k) { return k + " (" + soltos[k] + ")"; }).join(", ") + ". Podem ser cortesias ou cupons gerais.");
          resultado.append(s);
        }
        if (colValor.value === "") resultado.append(el("p", "muted", "Sem a coluna do valor, o painel só conta as inscrições."));
        if (linhasRes.length && window.XLSX) {
          resultado.append(acoes(botao("Baixar apuração (Excel)", "btn btn--red", function () {
            var pv = provaPorId(prova.value) || { id: prova.value, nome: prova.value };
            var ws = XLSX.utils.json_to_sheet(linhasRes.map(function (x) {
              return { Parceiro: x.parceiro, Tipo: x.tipo, Cupom: x.cupom, "Inscrições pagas": x.inscricoes, "Valor pago (R$)": Math.round(x.valor * 100) / 100, "Comissão (%)": x.pct, "A pagar (R$)": x.comissao, Pix: x.pix };
            }));
            var wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Apuração");
            XLSX.writeFile(wb, "Apuracao_" + slug(pv.nome) + ".xlsx");
          })));
        }
      }
    }
  }
  function valorNum(v) {
    if (typeof v === "number") return v;
    var s = String(v || "").replace(/[^\d,.-]/g, "");
    if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
    return parseFloat(s) || 0;
  }

  // =====================================================================
  //  INSCRIÇÕES COLETIVAS E ORÇAMENTOS (o que chega pelo site)
  // =====================================================================
  function dataHora(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  function baixaPlanilha(linhasP, aba, arquivo) {
    if (!window.XLSX) return aviso("A biblioteca de planilhas não carregou. Recarregue a página.", true);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhasP), aba);
    XLSX.writeFile(wb, arquivo);
  }
  function carregando(c, chave, caminho, desenha) {
    if (S[chave]) return desenha();
    var p = el("p", "muted", "Carregando...");
    c.append(p);
    api("GET", caminho).then(function (d) { S[chave] = d; p.remove(); desenha(); }).catch(function (e) { p.remove(); falha(e); });
  }

  function abaInscricoes() {
    var c = card("Recebidas pelo site", "Inscrições coletivas");
    c.append(el("p", "muted", "Planilhas que as assessorias conferiram e enviaram pela página de inscrição coletiva. Os dados dos atletas são pessoais: baixe só quando for fazer as inscrições."));
    corpo.append(c);
    carregando(c, "inscricoes", "inscricoes", function () {
      var prova = escolha([["", "Todas as provas"]].concat(Object.keys(S.inscricoes.reduce(function (a, i) { a[i.prova_id] = i.prova_nome; return a; }, {}))
        .map(function (id) { var x = S.inscricoes.filter(function (i) { return i.prova_id === id; })[0]; return [id, x.prova_nome]; })), "");
      var filtros = el("div", "painel-filtros"); filtros.append(campo("Prova", prova)); c.append(filtros);
      var area = el("div"); c.append(area);
      function desenha() {
        area.innerHTML = "";
        var lista = S.inscricoes.filter(function (i) { return !prova.value || i.prova_id === prova.value; });
        if (!lista.length) { area.append(el("p", "muted", "Nenhuma inscrição coletiva recebida ainda.")); return; }
        var total = lista.reduce(function (a, i) { return a + (Number(i.atletas) || Number(i.total) || 0); }, 0);
        area.append(el("p", "assess-status", lista.length + " envios · " + total + " atletas"));
        area.append(tabela(["Recebida", "Prova", "Equipe", "Responsável", "Atletas", "Canal", ""], lista.map(function (i) {
          var b = botao("Baixar atletas (Excel)", null, function () {
            b.disabled = true;
            api("GET", "inscricoes/" + encodeURIComponent(i.id) + "/atletas").then(function (at) {
              b.disabled = false;
              baixaPlanilha(at.map(function (a) {
                return { Nome: a.nome, CPF: a.cpf, Nascimento: a.nascimento, Sexo: a.sexo, "Distância": a.distancia, Camiseta: a.camiseta, "E-mail": a.email, Telefone: a.telefone, Equipe: a.equipe || i.equipe };
              }), "Atletas", "Inscricao_" + slug(i.equipe) + "_" + slug(i.prova_nome) + ".xlsx");
            }).catch(function (e) { b.disabled = false; falha(e); });
          });
          var resp = el("div"); resp.append(i.responsavel || "");
          if (i.telefone) { resp.append(" "); resp.append(linkExt(i.telefone, "https://wa.me/" + numeroWa(i.telefone))); }
          return [dataHora(i.criado_em), i.prova_nome, el("strong", null, i.equipe), resp, String(i.atletas != null ? i.atletas : i.total), i.canal === "email" ? "E-mail" : "WhatsApp", b];
        })));
      }
      prova.addEventListener("change", desenha);
      desenha();
    });
  }

  function abaOrcamentos() {
    var c = card("Recebidos pelo site", "Pedidos de orçamento");
    c.append(el("p", "muted", "Cópia de cada pedido feito no formulário \"Peça seu orçamento\". O contato em si chega no WhatsApp ou no e-mail que a pessoa escolheu."));
    corpo.append(c);
    carregando(c, "orcamentos", "orcamentos", function () {
      var lista = S.orcamentos;
      if (!lista.length) { c.append(el("p", "muted", "Nenhum pedido recebido ainda.")); return; }
      c.append(acoes(botao("Baixar todos (Excel)", "btn btn--line", function () {
        baixaPlanilha(lista.map(function (o) {
          return { Recebido: dataHora(o.criado_em), Canal: o.canal, "Serviço": o.servico, Nome: o.nome, Contratante: o.contratante, Empresa: o.empresa, Cidade: o.cidade, Quando: o.quando, "Público": o.publico, Detalhes: o.detalhes };
        }), "Orçamentos", "Orcamentos_Tardim.xlsx");
      })));
      c.append(tabela(["Recebido", "Serviço", "Quem", "Cidade", "Quando", "Público", "Detalhes"], lista.map(function (o) {
        var quem = el("div"); quem.append(el("strong", null, o.nome));
        if (o.empresa || o.contratante) quem.append(el("small", "muted", " · " + [o.contratante, o.empresa].filter(Boolean).join(" · ")));
        var det = el("span", "painel-detalhe", o.detalhes || "");
        det.title = o.detalhes || "";
        return [dataHora(o.criado_em), o.servico, quem, o.cidade, o.quando, o.publico, det];
      })));
    });
  }

  // ---------- início ----------
  fetch("api/admin/sessao", { credentials: "same-origin" }).then(function (r) {
    return r.text().then(function (t) {
      var j = null; try { j = JSON.parse(t); } catch (e) { j = null; }
      if (r.ok && j) return entrar();
      if (r.status === 401 && j) return telaLogin();
      semApi(j && j.mensagem ? j.mensagem : "");
    });
  }).catch(function () { semApi(""); });
})();
