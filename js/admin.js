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
  var UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
  function cidadeUf(p) { return (p.cidade || "") + (p.cidade && p.uf ? "/" + p.uf : ""); }
  function seguidoresTxt(n) { return n ? Number(n).toLocaleString("pt-BR") + " seguidores" : ""; }
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
    var este = avisoEl;
    if (!erro && !link) setTimeout(function () { if (avisoEl === este) { avisoEl.remove(); avisoEl = null; } }, 8000);
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
  // ids (opcional): um por linha, para destacar o item recém-salvo
  function tabela(cabecalho, linhasTab, ids) {
    var w = el("div", "painel-tab");
    var t = el("table");
    var th = el("tr");
    cabecalho.forEach(function (h) { th.append(el("th", null, h)); });
    var thead = el("thead"); thead.append(th);
    var tb = el("tbody");
    linhasTab.forEach(function (cels, n) {
      var tr = el("tr");
      if (ids && ids[n] != null) tr.dataset.id = String(ids[n]);
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

  // Caixa de confirmação dentro da página (no lugar do confirm/prompt do navegador).
  // Devolve true/false; com op.campo, devolve o texto digitado ou null se cancelar.
  function pergunta(titulo, texto, sim, op) {
    op = op || {};
    return new Promise(function (ok) {
      var d = el("dialog", "painel-dialogo");
      var f = el("form"); f.method = "dialog";
      f.append(el("h2", null, titulo));
      if (texto) f.append(el("p", null, texto));
      var txt = null;
      if (op.campo) { txt = entrada("textarea", op.valor || "", { maxLength: 300, rows: 3 }); f.append(campo(op.campo, txt)); }
      var bNao = el("button", "btn btn--line", op.nao || "Cancelar"); bNao.value = "nao";
      var bSim = el("button", "btn btn--red", sim); bSim.value = "sim";
      var linha = el("div", "painel-dialogo__acoes"); linha.append(bNao, bSim);
      f.append(linha); d.append(f); document.body.append(d);
      d.addEventListener("close", function () {
        var r = d.returnValue === "sim";
        d.remove();
        ok(txt ? (r ? txt.value : null) : r);
      });
      d.showModal();
      (txt || bNao).focus();
    });
  }
  function perguntaSairSemSalvar() {
    return pergunta("Sair sem salvar?", "O que você digitou neste formulário vai se perder.", "Sair sem salvar", { nao: "Continuar editando" });
  }
  function acoes() {
    var d = el("div", "painel-acoes-linha");
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) d.append(arguments[i]);
    return d;
  }

  // ---------- API do painel (functions/api/admin) ----------
  var S = { provas: [], parceiros: [], convites: [], depoimentos: [], orcamentos: null, inscricoes: null, aba: "provas" };
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
    corpo = null; sujo = false;
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
      S.depoimentos = d.depoimentos || []; S.semDepoimentos = !d.depoimentos; // null = banco sem a tabela
      S.orcamentos = null; S.inscricoes = null; S.propostas = null; S.minutario = null; S.config = null;
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
  var ABAS = [["provas", "Provas"], ["parceiros", "Parceiros"], ["convites", "Convites"], ["apuracao", "Apuração"],
    ["inscricoes", "Inscrições coletivas"], ["avisos", "Me avise"], ["orcamentos", "Orçamentos"], ["propostas", "Propostas"], ["depoimentos", "Depoimentos"], ["medicao", "Medição"]];
  var NOME_ABA = {};
  ABAS.forEach(function (a) { NOME_ABA[a[0]] = a[1]; });

  function render() {
    app.innerHTML = "";
    var topo = el("div", "painel-top");
    var tit = el("div", "painel-top__tit");
    tit.append(el("h1", null, "Painel"), el("p", "muted", "Provas, parceiros, convites e o que chega pelo site."));
    var atualizar = botao("Atualizar dados", "btn btn--line btn--sm", function () {
      atualizar.disabled = true;
      carregar().then(function () { atualizar.disabled = false; contaPendentes(); redesenha(); aviso("Dados atualizados."); })
        .catch(function (e) { atualizar.disabled = false; falha(e); });
    });
    topo.append(tit, acoes(atualizar, botao("Sair", null, sair)));
    // As abas são links (#provas, #parceiros...): o Voltar do navegador e o F5 mantêm a tela
    var abas = el("nav", "cal-tabs painel-abas");
    abas.setAttribute("aria-label", "Seções do painel");
    ABAS.forEach(function (a) {
      var l = el("a", "cal-tab", a[1]);
      l.href = "#" + a[0];
      l.dataset.aba = a[0];
      abas.append(l);
    });
    corpo = el("div", "painel-corpo");
    app.append(topo, abas, corpo);
    contaPendentes();
    var n = pendentes().length;
    var inicial = rotaDoEndereco() || (n ? "parceiros" : "provas");
    history.replaceState(null, "", "#" + inicial);
    rotaAtual = inicial; rotaAnterior = "";
    abre(inicial);
    if (n) aviso(n === 1 ? "1 cadastro novo de parceiro aguardando aprovação." : n + " cadastros novos de parceiros aguardando aprovação.",
      false, S.aba !== "parceiros" ? ["Ver agora", function () { ir("parceiros"); }] : null);
  }
  // Cadastros feitos pelo site (parceiro.html) que ainda não foram aprovados nem recusados
  function pendentes() { return S.parceiros.filter(function (p) { return p.situacao === "pendente"; }); }
  function contaPendentes() {
    var b = app.querySelector('.painel-abas [data-aba="parceiros"]');
    if (!b) return;
    var n = pendentes().length;
    b.textContent = "Parceiros";
    if (n) { var s = el("span", "cal-tab__n", String(n)); s.title = n === 1 ? "1 cadastro novo" : n + " cadastros novos"; b.append(s); }
  }

  // ---------- navegação ----------
  // Cada tela tem endereço próprio: #provas, #prova/<id>, #prova/novo, #parceiro/<id>,
  // #convite/novo?prova=<id>, #convite/<id>, #convite/<id>/links...
  var rotaAtual = "", rotaAnterior = "", sujo = false, destaque = null;
  function rotaDoEndereco() { return location.hash.replace(/^#/, ""); }
  function enc(x) { return encodeURIComponent(String(x)); }
  // Vai para uma tela (entra no histórico do navegador)
  function ir(rota) {
    if (rota === rotaAtual) return redesenha();
    if (!sujo) { location.hash = rota; return; }
    perguntaSairSemSalvar().then(function (s) { if (s) { sujo = false; location.hash = rota; } });
  }
  // Volta para a lista depois de salvar, cancelar ou excluir (sem deixar o formulário no Voltar)
  function voltarPara(rota) {
    sujo = false;
    if (rotaAnterior === rota) history.back();
    else location.replace("#" + rota);
  }
  function cancelar(rota) {
    if (!sujo) return voltarPara(rota);
    perguntaSairSemSalvar().then(function (s) { if (s) voltarPara(rota); });
  }
  function redesenha() { abre(rotaAtual); }

  window.addEventListener("hashchange", function () {
    var nova = rotaDoEndereco();
    if (!corpo || nova === rotaAtual) return;
    if (sujo) {
      // Voltar do navegador com formulário alterado: fica na tela e pergunta
      history.pushState(null, "", "#" + rotaAtual);
      perguntaSairSemSalvar().then(function (s) { if (s) { sujo = false; location.hash = nova; } });
      return;
    }
    rotaAnterior = rotaAtual; rotaAtual = nova;
    abre(nova);
  });
  window.addEventListener("beforeunload", function (e) { if (sujo) { e.preventDefault(); e.returnValue = ""; } });

  // Marca o formulário como alterado ao digitar (para avisar antes de sair sem salvar)
  function vigia(f) {
    var marca = function () { sujo = true; };
    f.addEventListener("input", marca);
    f.addEventListener("change", marca);
  }

  // "← Voltar" e o caminho (Convites › Editar convite) no topo de cada formulário
  function trilha(aba, atual) {
    var n = el("nav", "painel-trilha");
    n.setAttribute("aria-label", "Você está em");
    var v = botao("← Voltar", "painel-voltar", function () { cancelar(aba); });
    var ol = el("ol");
    var li = el("li"), a = el("a", null, NOME_ABA[aba]);
    a.href = "#" + aba;
    li.append(a);
    var atualLi = el("li", null, atual);
    atualLi.setAttribute("aria-current", "page");
    ol.append(li, atualLi);
    n.append(v, ol);
    return n;
  }
  // Barra de Salvar/Cancelar que acompanha a rolagem do formulário
  function barraForm() {
    var b = acoes.apply(null, arguments);
    b.classList.add("painel-barra");
    return b;
  }

  function naoAchou(aba, msg) {
    aviso(msg, true);
    history.replaceState(null, "", "#" + aba);
    rotaAtual = aba;
    abre(aba);
  }
  function porId(lista, id) { return lista.filter(function (x) { return String(x.id) === String(id); })[0]; }

  function abre(rota) {
    sujo = false;
    var partes = rota.split("?");
    var cam = partes[0].split("/").map(function (x) { try { return decodeURIComponent(x); } catch (e) { return x; } });
    var params = new URLSearchParams(partes[1] || "");
    var tipo = cam[0], id = cam[1], extra = cam[2];
    var aba = { prova: "provas", parceiro: "parceiros", convite: "convites", depoimento: "depoimentos", proposta: "propostas", minutario: "propostas", "modelo-contrato": "propostas" }[tipo] || tipo;
    if (!NOME_ABA[aba]) { tipo = aba = "provas"; history.replaceState(null, "", "#provas"); rotaAtual = "provas"; }
    S.aba = aba;
    app.querySelectorAll(".painel-abas .cal-tab").forEach(function (b) {
      if (b.dataset.aba === aba) { b.setAttribute("aria-current", "page"); b.setAttribute("aria-pressed", "true"); }
      else { b.removeAttribute("aria-current"); b.setAttribute("aria-pressed", "false"); }
    });
    var ativa = app.querySelector('.painel-abas [aria-current="page"]');
    if (ativa && ativa.scrollIntoView) ativa.scrollIntoView({ block: "nearest", inline: "nearest" });
    corpo.innerHTML = "";
    // Toda tela abre do começo (sem ficar no meio da página anterior)
    var y = app.getBoundingClientRect().top + window.scrollY - 72;
    if (window.scrollY > y) window.scrollTo(0, Math.max(0, y));

    var titulo = NOME_ABA[aba];
    if (tipo === aba) {
      ({ provas: abaProvas, parceiros: abaParceiros, convites: abaConvites, apuracao: abaApuracao,
        inscricoes: abaInscricoes, avisos: abaAvisos, orcamentos: abaOrcamentos, depoimentos: abaDepoimentos, medicao: abaMedicao, propostas: abaPropostas })[aba]();
    } else if (tipo === "proposta") {
      // As propostas são lidas só quando a aba é aberta; o endereço direto de uma proposta espera a leitura
      var abreProposta = function () {
        var base = id === "novo" ? (params.get("de") ? porId(S.propostas, params.get("de")) : null) : porId(S.propostas, id);
        if (id !== "novo" && !base) return naoAchou("propostas", "Essa proposta não está mais no painel.");
        // #proposta/<id> = andamento (do orçamento ao contrato assinado); #proposta/<id>/editar = itens e valores
        if (id === "novo") formProposta(null, base);
        else if (extra === "editar") formProposta(base, null);
        else telaAndamento(base);
      };
      if (S.propostas) abreProposta();
      else api("GET", "propostas").then(function (d) { S.propostas = d; abreProposta(); }).catch(function (e) { falha(e); ir("propostas"); });
      titulo = id === "novo" ? "Nova proposta" : (extra === "editar" ? "Editar proposta" : "Proposta");
    } else if (tipo === "minutario") {
      telaMinutario();
      titulo = "Minutário";
    } else if (tipo === "modelo-contrato") {
      telaModeloContrato();
      titulo = "Empresa e modelo do contrato";
    } else if (tipo === "depoimento") {
      var dp = id === "novo" ? null : porId(S.depoimentos, id);
      if (id !== "novo" && !dp) return naoAchou("depoimentos", "Esse depoimento não está mais no painel.");
      formDepoimento(dp);
      titulo = dp ? "Depoimento de " + dp.nome : "Novo depoimento";
    } else if (tipo === "prova") {
      var pv = id === "novo" ? null : provaPorId(id);
      if (id !== "novo" && !pv) return naoAchou("provas", "Essa prova não está mais no painel.");
      formProva(pv);
      titulo = pv ? pv.nome : "Nova prova";
    } else if (tipo === "parceiro") {
      var pa = id === "novo" ? null : porId(S.parceiros, id);
      if (id !== "novo" && !pa) return naoAchou("parceiros", "Esse parceiro não está mais no painel.");
      formParceiro(pa);
      titulo = pa ? pa.nome : "Novo parceiro";
    } else if (tipo === "convite") {
      if (id === "novo") {
        var padrao = {};
        if (params.get("prova")) padrao.prova_id = params.get("prova");
        if (params.get("parceiro")) padrao.parceiro_id = (porId(S.parceiros, params.get("parceiro")) || {}).id;
        formConvite(null, padrao);
        titulo = "Novo convite";
      } else {
        var cv = porId(S.convites, id);
        if (!cv) return naoAchou("convites", "Esse convite não está mais no painel.");
        if (extra === "links") detalheConvite(cv); else formConvite(cv);
        titulo = "Convite " + cv.cupom;
      }
    }
    document.title = titulo + " · Painel Tardim";
    if (destaque != null) {
      var tr = corpo.querySelector('tr[data-id="' + String(destaque).replace(/["\\]/g, "") + '"]');
      destaque = null;
      if (tr) { tr.classList.add("is-novo"); tr.scrollIntoView({ block: "center" }); }
    }
  }

  // =====================================================================
  //  PROVAS
  // =====================================================================
  function abaProvas() {
    var c = card("Calendário", "Provas");
    c.append(el("p", "muted", "Cadastre a prova e marque como publicada: a página da prova, o kit de divulgação e o card para stories saem prontos na hora."));
    c.append(acoes(botao("Nova prova", "btn btn--red", function () { ir("prova/novo"); })));
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
            botao(p.fonte === "codigo" ? "Trazer para o painel" : "Editar", null, function () { ir("prova/" + enc(p.id)); }),
            linkExt("Kit", base() + "kit.html?p=" + encodeURIComponent(p.id)),
            p.fonte !== "rascunho" ? linkExt("Página", base() + "prova-" + p.id + ".html") : null
          ),
        ];
      }), lista.map(function (p) { return p.id; })));
    }
    corpo.append(c);
  }

  function formProva(item) {
    var r = item ? (item.linha || deObjeto(item.obj)) : null;
    var existe = !!(item && item.linha);
    corpo.innerHTML = "";
    corpo.append(trilha("provas", existe ? "Editar prova" : (item ? "Trazer para o painel" : "Nova prova")));
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
      var cols = [v.nome || "", v.valor || "", v.detalhe || "", v.esgotado ? "esgotado" : "", v.ate ? curta(v.ate) : ""];
      while (cols.length > 2 && !cols[cols.length - 1]) cols.pop();
      return cols.join(" | ");
    }).join("\n"), { rows: 5, placeholder: "1º lote | R$ 80,00 | | | 21/02/2027\n2º lote | R$ 90,00 | | | 21/03/2027\n60+ e PcD | 50% de desconto | conforme a lei" });
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
    var faqAntes = (r.faq || []).map(function (q) { return q[0] + " | " + q[1]; }).join("\n");
    var faq = entrada("textarea", faqAntes, { rows: 5, placeholder: "Posso retirar o kit de outra pessoa? | Sim, com documento com foto e autorização assinada.\nTem guarda-volumes? | Sim, ao lado do pórtico, a partir das 6h." });
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
      campo("Valores (um por linha: nome | valor | detalhe | esgotado | último dia do lote)", valores, "O último dia (dd/mm/aaaa) é opcional e só vai nos lotes, na ordem em que acontecem: o site passa para o lote seguinte sozinho e mostra \"1º lote até 21/02\". Linhas sem data valem sempre.", true),
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
      campo("Perguntas frequentes (uma por linha: pergunta | resposta)", faq, "Aparecem na página da prova, na seção \"Perguntas frequentes\". Vazio = a seção não aparece.", true),
      campo("Texto de divulgação", texto, "Opcional. Vazio = o kit monta o texto sozinho com os dados da prova.", true)
    );
    var pl = el("div", "assess-grid__full"); pl.append(publicada); f.append(pl);
    var salvar = el("button", "btn btn--red btn--lg", "Salvar prova"); salvar.type = "submit";
    f.append(barraForm(salvar, botao("Cancelar", null, function () { cancelar("provas"); }),
      existe ? botao("Excluir prova", "orc__email painel-perigo", function () { excluirProva(r.id); }) : null));
    c.append(f);
    corpo.append(c);
    vigia(f);
    nome.focus({ preventScroll: true });

    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var ident = id.value.trim();
      if (!nome.value.trim()) return aviso("Informe o nome da prova.", true);
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(ident)) return aviso("O identificador só pode ter letras minúsculas, números e hífen.", true);
      if (!dt.value) return aviso("Informe a data da prova.", true);
      var dataRuim = "";
      var linha = {
        id: ident, nome: nome.value.trim(), data: dt.value, hora: hora.value.trim(), local: local.value.trim(),
        percursos: linhas(percursos.value), resumo: resumo.value.trim(), poster: poster.value.trim(), inscricao: inscricao.value.trim(),
        valores: linhas(valores.value).map(function (l) {
          var p = l.split("|").map(function (x) { return x.trim(); });
          var v = { nome: p[0], valor: p[1] || "" };
          if (p[2]) v.detalhe = p[2];
          if (/esgotad/i.test(p[3] || "")) v.esgotado = true;
          var dm = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(p[4] || "");
          if (dm) v.ate = dm[3] + "-" + dm[2].padStart(2, "0") + "-" + dm[1].padStart(2, "0");
          else if (p[4]) dataRuim = p[4];
          return v;
        }),
        kit: { itens: linhas(kitItens.value), retirada: retirada.value.trim() },
        programacao: linhas(programacao.value).map(function (l) { var i = l.indexOf("|"); return i < 0 ? [l, ""] : [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
        premiacao: premiacao.value.trim(), percurso_mapa: mapa.value.trim(), regulamento: regulamento.value.trim(),
        resultados: resultados.value.trim(), fotos: fotos.value.trim(), realizacao: realizacao.value.trim(),
        texto_divulgacao: texto.value.trim(), hashtags: hashtags.value.trim(), publicada: publicada.caixa.checked,
      };
      if (dataRuim) return aviso("Nos valores, o último dia do lote precisa estar como dd/mm/aaaa. Não entendi: " + dataRuim, true);
      // Só envia as perguntas quando há o que gravar ou apagar: banco ainda sem a coluna faq continua salvando a prova
      if (faq.value.trim() || faqAntes) {
        linha.faq = linhas(faq.value).map(function (l) { var i = l.indexOf("|"); return i < 0 ? null : [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
          .filter(function (q) { return q && q[0] && q[1]; });
        if (linha.faq.length !== linhas(faq.value).length) return aviso("Nas perguntas frequentes, cada linha precisa ter a pergunta e a resposta separadas por | (barra vertical).", true);
      }
      salvar.disabled = true; salvar.textContent = "Salvando...";
      var enviaArte = arquivo.files[0] ? comprime(arquivo.files[0]).then(function (blob) {
        return enviaImagem("provas", ident, blob, "image/jpeg").then(function (caminho) { linha.poster = "arquivos/" + caminho; });
      }) : Promise.resolve();
      enviaArte.then(function () {
        return existe ? api("PUT", "provas/" + encodeURIComponent(ident), linha) : api("POST", "provas", linha);
      }).then(function (salva) {
        S.provas = S.provas.filter(function (x) { return x.id !== ident; }).concat([salva]);
        destaque = ident;
        voltarPara("provas");
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
      hashtags: p.hashtags || "", faq: p.faq || [], publicada: true,
    };
  }

  function excluirProva(id) {
    var n = S.convites.filter(function (x) { return x.prova_id === id; }).length;
    pergunta("Excluir esta prova?", "Ela sai do site e do painel." + (n === 1 ? " O convite dela continua guardado." : n ? " Os " + n + " convites dela continuam guardados." : ""), "Excluir prova").then(function (sim) {
      if (!sim) return;
      api("DELETE", "provas/" + encodeURIComponent(id)).then(function () {
        S.provas = S.provas.filter(function (x) { return x.id !== id; });
        voltarPara("provas");
        aviso("Prova excluída do painel.");
      }).catch(falha);
    });
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
    var pend = pendentes();
    if (pend.length) corpo.append(cardPendentes(pend));
    var c = card("Cadastro", "Parceiros");
    c.append(el("p", "muted", "Embaixadores, influenciadores, assessorias e equipes. Cada parceiro pode ter convites em várias provas."));
    var tipo = escolha([["", "Todos os tipos"]].concat(Object.keys(TIPOS).map(function (k) { return [k, TIPOS[k]]; })), filtroTipo);
    var q = entrada("search", busca, { placeholder: "Buscar por nome, cidade ou Instagram" });
    var filtros = el("div", "painel-filtros");
    filtros.append(campo("Tipo", tipo), campo("Busca", q), botao("Novo parceiro", "btn btn--red", function () { ir("parceiro/novo"); }));
    c.append(filtros);
    var area = el("div");
    c.append(area);
    function desenha() {
      filtroTipo = tipo.value; busca = q.value;
      var termo = slug(busca).replace(/-/g, " ");
      var lista = S.parceiros.filter(function (p) {
        if (filtroTipo && p.tipo !== filtroTipo) return false;
        if (!termo) return true;
        return slug([p.nome, p.responsavel, p.cidade, p.uf, p.instagram].join(" ")).replace(/-/g, " ").indexOf(termo) >= 0;
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
        nome.append(selosInsta(p));
        var contato = el("div");
        if (p.whatsapp) contato.append(linkExt(p.whatsapp, "https://wa.me/" + numeroWa(p.whatsapp)));
        if (p.instagram) { if (p.whatsapp) contato.append(" "); contato.append(linkExt("@" + p.instagram.replace(/^@/, ""), "https://www.instagram.com/" + p.instagram.replace(/^@/, "") + "/")); }
        return [nome, TIPOS[p.tipo], contato,
          String(S.convites.filter(function (x) { return x.parceiro_id === p.id; }).length),
          p.situacao === "pendente" ? situacao("Aguardando aprovação", "is-rasc")
            : p.situacao === "recusado" ? situacao("Recusado", "is-off")
            : situacao(p.ativo ? "Ativo" : "Inativo", p.ativo ? "is-pub" : "is-off"),
          acoes(botao("Editar", null, function () { ir("parceiro/" + enc(p.id)); }), p.ativo ? botao("Novo convite", null, function () { ir("convite/novo?parceiro=" + enc(p.id)); }) : null,
            p.tipo === "influenciador" ? botaoInsta(p) : null)];
      }), lista.map(function (p) { return p.id; })));
    }
    tipo.addEventListener("change", desenha);
    q.addEventListener("input", desenha);
    desenha();
    corpo.append(c);
  }
  // Mesma máscara de js/parceiro.js: (31) 99999-9999 celular, (31) 3333-4444 fixo, sem o +55
  function mascaraTel(v) {
    var d = String(v || "").replace(/\D/g, "");
    if (d.length > 11 && d.indexOf("55") === 0) d = d.slice(2);
    d = d.slice(0, 11);
    return d.length > 10 ? d.replace(/^(\d{2})(\d{5})(\d{0,4})$/, "($1) $2-$3")
      : d.length > 6 ? d.replace(/^(\d{2})(\d{4})(\d{0,4})$/, "($1) $2-$3")
      : d.length > 2 ? d.replace(/^(\d{2})(\d+)$/, "($1) $2")
      : d.length ? "(" + d : "";
  }
  function numeroWa(t) { var n = String(t || "").replace(/\D/g, ""); if (n && n.length <= 11) n = "55" + n; return n; }

  // Instagram conferido pela API da Meta (functions/_lib/instagram.js, rota parceiros/<id>/instagram)
  function selosInsta(p) {
    var d = el("span");
    if (!p.instagram) return d;
    if (p.ig_situacao === "ok") {
      var titulo = "Conferido em " + new Date(p.ig_conferido_em).toLocaleDateString("pt-BR") + " · " + Number(p.ig_posts || 0).toLocaleString("pt-BR") + " posts";
      var s = situacao("Instagram: " + seguidoresTxt(p.ig_seguidores || 0), "is-pub"); s.title = titulo;
      d.append(" ", s);
      // estimativa do cadastro bem acima do real
      if (p.seguidores && p.seguidores > (p.ig_seguidores || 0) * 1.3) d.append(" ", situacao("Informou " + Number(p.seguidores).toLocaleString("pt-BR"), "is-rasc"));
    } else if (p.ig_situacao === "nao_encontrado") {
      var n = situacao("Instagram não encontrado", "is-rasc"); n.title = "Conta pessoal, privada ou @ errado. Só conta Comercial ou Criador de conteúdo aparece.";
      d.append(" ", n);
    }
    return d;
  }
  function conferirInsta(p, btn) {
    btn.disabled = true; btn.textContent = "Consultando...";
    api("POST", "parceiros/" + encodeURIComponent(p.id) + "/instagram", {}).then(function (r) {
      var res = r.resultado || {};
      if (!res.ok) {
        btn.disabled = false; btn.textContent = "Conferir Instagram";
        return aviso({
          config: "Falta configurar a API do Instagram (segredos IG_USER_ID e IG_TOKEN). Veja o README.",
          token: "O token do Instagram (IG_TOKEN) é inválido ou expirou. Gere outro no Gerenciador de Negócios da Meta.",
          usuario: "O @ do Instagram deste parceiro é inválido.",
        }[res.erro] || "A API do Instagram não respondeu. Tente de novo em alguns minutos.", true);
      }
      S.parceiros = S.parceiros.map(function (x) { return x.id === p.id ? r.parceiro : x; });
      redesenha();
      aviso(res.encontrado ? "@" + res.usuario + ": " + seguidoresTxt(res.seguidores) + "." : "@" + res.usuario + " não encontrado. Pode ser conta pessoal ou @ errado.", !res.encontrado);
    }).catch(function (e) { btn.disabled = false; btn.textContent = "Conferir Instagram"; falha(e); });
  }
  function botaoInsta(p) {
    return p.instagram ? botao("Conferir Instagram", null, function (e) { conferirInsta(p, e.currentTarget); }) : null;
  }

  // Cadastros novos (feitos em parceiro.html): aprovar libera a área do parceiro; recusar guarda o motivo
  function cardPendentes(lista) {
    var c = card("Cadastros pelo site", lista.length === 1 ? "1 cadastro aguardando aprovação" : lista.length + " cadastros aguardando aprovação");
    c.classList.add("painel-pendentes");
    c.append(el("p", "muted", "Confira os dados (Instagram, WhatsApp, CREF quando houver) antes de aprovar. Aprovado, o parceiro passa a ver na área dele os convites que você criar."));
    c.append(tabela(["Recebido", "Nome", "Tipo", "Contato", "Cidade", ""], lista.map(function (p) {
      var nome = el("div"); nome.append(el("strong", null, p.nome));
      if (p.responsavel) nome.append(el("small", "muted", " · " + p.responsavel));
      var contato = el("div");
      if (p.email) contato.append(linkExt(p.email, "mailto:" + p.email), " ");
      if (p.whatsapp) contato.append(linkExt(p.whatsapp, "https://wa.me/" + numeroWa(p.whatsapp)), " ");
      if (p.instagram) contato.append(linkExt("@" + p.instagram.replace(/^@/, ""), "https://www.instagram.com/" + p.instagram.replace(/^@/, "") + "/"));
      var recebido = p.criado_em ? new Date(p.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";
      if (p.seguidores && p.ig_situacao !== "ok") nome.append(el("small", "muted", " · " + seguidoresTxt(p.seguidores) + " (informado)"));
      nome.append(selosInsta(p));
      return [recebido, nome, TIPOS[p.tipo] || p.tipo, contato, cidadeUf(p),
        acoes(botao("Aprovar", "btn btn--red", function (e) { decide(p, "aprovado", e.currentTarget); }),
          botao("Recusar", "orc__email painel-perigo", function (e) { decide(p, "recusado", e.currentTarget); }),
          botao("Editar", null, function () { ir("parceiro/" + enc(p.id)); }), botaoInsta(p))];
    })));
    return c;
  }
  function decide(p, sit, btn) {
    if (sit === "recusado") {
      return pergunta("Recusar o cadastro de " + p.nome + "?", "Ele não vai poder receber convites. Se quiser, explique o motivo: o parceiro vê esta mensagem na área dele.",
        "Recusar cadastro", { campo: "Motivo (opcional)" }).then(function (motivo) {
        if (motivo === null) return;
        grava({ situacao: sit, ativo: false, motivo_recusa: motivo.trim().slice(0, 300) });
      });
    }
    grava({ situacao: sit, ativo: true, motivo_recusa: "" });
    function grava(dados) {
    btn.disabled = true;
    api("PUT", "parceiros/" + encodeURIComponent(p.id), dados).then(function (salvo) {
      S.parceiros = S.parceiros.map(function (x) { return x.id === p.id ? salvo : x; });
      contaPendentes();
      redesenha();
      aviso(sit === "aprovado" ? p.nome + " aprovado. Avise pelo WhatsApp e crie o primeiro convite." : "Cadastro de " + p.nome + " recusado.",
        false, sit === "aprovado" && p.whatsapp ? ["Avisar no WhatsApp", function () {
          window.open("https://wa.me/" + numeroWa(p.whatsapp) + "?text=" + encodeURIComponent(
            "Olá, " + (p.responsavel || p.nome) + "! Seu cadastro de parceiro da Tardim Produções foi aprovado. Entre na sua área para ver os convites: " + base() + "parceiro.html"), "_blank", "noopener");
        }] : null);
    }).catch(function (err) { btn.disabled = false; falha(err); });
    }
  }

  function formParceiro(p) {
    corpo.innerHTML = "";
    corpo.append(trilha("parceiros", p ? "Editar parceiro" : "Novo parceiro"));
    var c = card(p ? "Editar parceiro" : "Novo parceiro", p ? p.nome : "Dados do parceiro");
    p = p || { tipo: "embaixador", ativo: true };
    var f = el("form", "assess-grid"); f.noValidate = true;
    var tipo = escolha(Object.keys(TIPOS).map(function (k) { return [k, TIPOS[k]]; }), p.tipo);
    var nome = entrada("text", p.nome, { maxLength: 120, required: true });
    var resp = entrada("text", p.responsavel, { maxLength: 120 });
    var wa = entrada("tel", mascaraTel(p.whatsapp), { placeholder: "(31) 90000-0000", maxLength: 20, inputMode: "numeric" });
    wa.addEventListener("input", function () { wa.value = mascaraTel(wa.value); });
    var email = entrada("email", p.email, { maxLength: 120 });
    var insta = entrada("text", p.instagram, { placeholder: "@perfil", maxLength: 60 });
    var cidade = entrada("text", p.cidade, { maxLength: 80 });
    var uf = escolha([["", "—"]].concat(UFS.map(function (u) { return [u, u]; })), p.uf || "");
    var seg = entrada("number", p.seguidores || "", { min: 0, step: 1, placeholder: "Só para influenciador" });
    var doc = entrada("text", p.documento, { maxLength: 20, placeholder: "CPF ou CNPJ" });
    var pix = entrada("text", p.pix, { maxLength: 120 });
    var obs = entrada("textarea", p.observacoes, { maxLength: 1000 });
    var ativo = marcador("Ativo (aparece na lista para novos convites)", p.ativo);
    f.append(
      campo("Tipo", tipo), campo("Nome", nome, "Pessoa, perfil ou nome da assessoria/equipe."),
      campo("Responsável", resp, "Para assessoria e equipe: quem fala pela equipe."),
      campo("WhatsApp", wa), campo("E-mail", email), campo("Instagram", insta), campo("Cidade", cidade), campo("Estado (UF)", uf),
      campo("Seguidores (estimado)", seg, p.ig_situacao === "ok" ? "No Instagram: " + seguidoresTxt(p.ig_seguidores) + " (conferido em " + new Date(p.ig_conferido_em).toLocaleDateString("pt-BR") + ")." : null),
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
    f.append(barraForm(salvar, botao("Cancelar", null, function () { cancelar("parceiros"); }),
      p.id ? botao("Excluir parceiro", "orc__email painel-perigo", function () { excluirParceiro(p); }) : null));
    c.append(f);
    corpo.append(c);
    if (p.id && p.tipo === "assessoria") corpo.append(cardIntegracao(p));
    vigia(f);
    nome.focus({ preventScroll: true });
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!nome.value.trim()) return aviso("Informe o nome do parceiro.", true);
      var linha = {
        tipo: tipo.value, nome: nome.value.trim(), responsavel: resp.value.trim(), whatsapp: wa.value.trim(),
        email: email.value.trim(), instagram: insta.value.trim().replace(/^@/, ""), cidade: cidade.value.trim(),
        uf: uf.value, seguidores: Number(seg.value) || 0,
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
        destaque = salvo.id;
        voltarPara("parceiros");
        aviso("Parceiro salvo.");
      }).catch(function (err) { salvar.disabled = false; salvar.textContent = "Salvar parceiro"; falha(err); });
    });
  }

  // Integração (API v1, docs/api-v1-parceiros.md): tudo por convite. O painel convida o sistema
  // da assessoria (ex.: IM3); o admin dela aceita ou recusa lá; a chave vai direto para o servidor
  // dela e ninguém precisa copiar nada. Convites de prova também são aceitos ou recusados lá.
  var SIT_CONEXAO = {
    enviando: ["Enviando...", "is-rasc"], enviado: ["Aguardando resposta", "is-rasc"], falhou: ["Não entregue", "is-off"],
    aceito: ["Aceito", "is-pub"], recusado: ["Recusado", "is-off"], cancelado: ["Cancelado", "is-off"],
  };
  function cardIntegracao(p) {
    var c = card("Integração", "Conectar o sistema da assessoria");
    c.append(el("p", "muted", "Se a assessoria usa um sistema próprio (como o IM3), convide-o aqui. O responsável recebe o convite no sistema dele e aceita ou recusa. Conectado, cada convite de prova que você criar chega lá para ele aceitar, e as respostas aparecem aqui."));
    var area = el("div"); c.append(area);
    if (p.situacao !== "aprovado" || !p.ativo) {
      area.append(el("p", "assess-alerta", "Aprove e ative esta assessoria para convidar o sistema dela."));
      return c;
    }
    function data(v) { return v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"; }
    function host(u) { return String(u || "").replace(/^https?:\/\//, ""); }
    function carrega() {
      area.innerHTML = ""; area.append(el("p", "muted", "Carregando..."));
      api("GET", "parceiros/" + encodeURIComponent(p.id) + "/integracoes").then(desenha).catch(function (e) {
        area.innerHTML = "";
        area.append(el("p", "assess-alerta", /tabelas|503/.test(String(e && e.message)) ? "Falta criar as tabelas da integração no banco (d1/migracoes/013-integracoes.sql)." : "Não consegui carregar a integração."));
      });
    }
    function desenha(r) {
      area.innerHTML = "";
      if (!r.assinatura) area.append(el("p", "assess-alerta", "Falta configurar a assinatura dos convites (segredo TARDIM_ASSINATURA_JWK). Veja o README."));
      var ativas = r.integracoes.filter(function (k) { return !k.revogada_em; });
      ativas.forEach(function (k) {
        var b = el("div", "painel-cref");
        var ok = el("p", "painel-cref__ok");
        ok.append(el("strong", null, "Conectada a " + (k.nome || host(k.plataforma_url))), document.createTextNode(" · " + host(k.plataforma_url) + (k.ambiente === "test" ? " · teste" : "")),
          el("small", null, " Desde " + data(k.criada_em) + (k.usada_em ? " · último acesso " + data(k.usada_em) : "") + "."));
        b.append(ok, acoes(botao("Desconectar", "orc__email painel-perigo", function () { desconecta(k); })));
        area.append(b);
      });
      var historico = r.conexoes.filter(function (x) { return !(x.situacao === "aceito" && ativas.some(function (k) { return k.id === x.integracao_id; })); });
      if (historico.length) {
        area.append(el("h3", null, "Convites de conexão"));
        area.append(tabela(["Sistema", "Situação", "Enviado", "Resposta", ""], historico.map(function (x) {
          var s = SIT_CONEXAO[x.situacao] || [x.situacao, "is-rasc"];
          var sit = el("div"); sit.append(situacao(s[0], s[1]));
          if (x.situacao === "falhou" && x.erro) sit.append(el("small", "muted", " " + x.erro));
          if (x.situacao === "enviado") sit.append(el("small", "muted", " vale até " + data(x.expira_em)));
          var resp = x.respondido_em ? data(x.respondido_em) + (x.respondido_por ? " por " + x.respondido_por : "") + (x.motivo ? ". Motivo: " + x.motivo : "") : "—";
          var aberta = ["enviando", "enviado", "falhou"].indexOf(x.situacao) >= 0;
          return [host(x.plataforma_url) + (x.ambiente === "test" ? " (teste)" : ""), sit, data(x.enviado_em), resp,
            aberta ? acoes(botao(x.situacao === "falhou" ? "Tentar de novo" : "Reenviar", null, function (e) { reenvia(x, e.currentTarget); }),
              botao("Cancelar convite", "orc__email painel-perigo", function () { cancelaConvite(x); })) : null];
        })));
      }
      if (!ativas.length) area.append(formConvite(r.conexoes[0]));
    }
    function formConvite(ultimo) {
      var box = el("div");
      var f = el("form", "assess-grid"); f.noValidate = true;
      var end = entrada("url", ultimo ? ultimo.plataforma_url : "https://", { placeholder: "https://im3-eventos.vercel.app", maxLength: 200 });
      var amb = escolha([["live", "Produção"], ["test", "Teste (o sistema vê também provas não publicadas)"]], "live");
      f.append(campo("Endereço do sistema da assessoria", end, "O endereço que a assessoria usa para abrir o sistema dela."), campo("Ambiente", amb));
      var enviar = el("button", "btn btn--red", "Convidar para conectar"); enviar.type = "submit";
      f.append(barraForm(enviar));
      var titulo = el("h3", null, "Convidar o sistema da assessoria"); titulo.style.marginTop = "1.5rem";
      box.append(titulo, f);
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        enviar.disabled = true; enviar.textContent = "Enviando convite...";
        api("POST", "parceiros/" + encodeURIComponent(p.id) + "/conexao", { plataforma_url: end.value.trim(), ambiente: amb.value }).then(function (x) {
          aviso(x.situacao === "enviado" ? "Convite entregue. Agora é com a assessoria: ela aceita ou recusa no sistema dela." : "O sistema não recebeu o convite: " + (x.erro || "erro desconhecido") + ".", x.situacao !== "enviado");
          carrega();
        }).catch(function (err) { enviar.disabled = false; enviar.textContent = "Convidar para conectar"; falha(err); });
      });
      return box;
    }
    function reenvia(x, btn) {
      btn.disabled = true;
      api("POST", "conexoes/" + encodeURIComponent(x.id) + "/reenviar", {}).then(function (r) {
        aviso(r.situacao === "enviado" ? "Convite entregue de novo." : "Ainda não entregou: " + (r.erro || "erro desconhecido") + ".", r.situacao !== "enviado");
        carrega();
      }).catch(function (e) { btn.disabled = false; falha(e); });
    }
    function cancelaConvite(x) {
      pergunta("Cancelar o convite para " + host(x.plataforma_url) + "?", "Se a assessoria tentar aceitar depois, o sistema dela vai receber um erro.", "Cancelar convite").then(function (sim) {
        if (!sim) return;
        api("POST", "conexoes/" + encodeURIComponent(x.id) + "/cancelar", {}).then(function () { aviso("Convite cancelado."); carrega(); }).catch(falha);
      });
    }
    function desconecta(k) {
      pergunta("Desconectar " + (k.nome || host(k.plataforma_url)) + "?", "O sistema da assessoria é avisado e perde o acesso na hora. Para voltar, faça um convite novo.", "Desconectar").then(function (sim) {
        if (!sim) return;
        api("POST", "integracoes/" + encodeURIComponent(k.id) + "/desconectar", {}).then(function () { aviso("Desconectado."); carrega(); }).catch(falha);
      });
    }
    carrega();
    return c;
  }

  // Resposta da assessoria ao convite de prova, dada no sistema dela (API v1)
  function seloConviteApi(cv) {
    if (!cv.api_situacao) return null;
    var d = el("span");
    var t = cv.api_situacao === "aceito" ? situacao("Aceito no sistema" + (cv.api_modo_pagamento === "ticketsports" ? " (paga na Ticket Sports)" : cv.api_modo_pagamento === "assessoria" ? " (PIX na assessoria)" : ""), "is-pub")
      : cv.api_situacao === "recusado" ? situacao("Recusado no sistema", "is-off")
      : situacao("Aguardando resposta no sistema", "is-rasc");
    if (cv.api_motivo) t.title = "Motivo: " + cv.api_motivo;
    d.append(" ", t);
    if (/^erro/.test(cv.api_aviso || "")) {
      var e = situacao("Aviso não entregue", "is-off"); e.title = cv.api_aviso;
      d.append(" ", e, " ", botao("Reenviar aviso", null, function (ev) {
        var b = ev.currentTarget; b.disabled = true;
        api("POST", "convites/" + encodeURIComponent(cv.id) + "/avisar", {}).then(function (r) {
          S.convites = S.convites.map(function (x) { return x.id === cv.id ? r.convite : x; });
          aviso(r.aviso && r.aviso.ok ? "Aviso entregue." : "Ainda não entregou: " + ((r.aviso && r.aviso.erro) || "erro") + ".", !(r.aviso && r.aviso.ok));
          redesenha();
        }).catch(function (err) { b.disabled = false; falha(err); });
      }));
    }
    return d;
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
    pergunta("Excluir " + p.nome + "?", (n ? (n === 1 ? "O convite deste parceiro também será apagado. " : "Os " + n + " convites deste parceiro também serão apagados. ") : "") + "Para só esconder, desmarque \"Ativo\" e salve.", "Excluir parceiro").then(function (sim) {
      if (!sim) return;
      api("DELETE", "parceiros/" + encodeURIComponent(p.id)).then(function () {
        S.parceiros = S.parceiros.filter(function (x) { return x.id !== p.id; });
        S.convites = S.convites.filter(function (x) { return x.parceiro_id !== p.id; });
        contaPendentes();
        voltarPara("parceiros");
        aviso("Parceiro excluído.");
      }).catch(falha);
    });
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
    filtros.append(campo("Prova", prova), botao("Novo convite", "btn btn--red", function () { ir("convite/novo" + (prova.value ? "?prova=" + enc(prova.value) : "")); }));
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
        var selo = seloConviteApi(cv); if (selo) quem.append(selo);
        return [pv ? pv.nome : cv.prova_id, quem, el("code", "painel-cupom", cv.cupom),
          Number(cv.comissao_pct) ? String(cv.comissao_pct).replace(".", ",") + "%" : "—",
          cv.cortesias ? String(cv.cortesias) : "—",
          acoes(botao("Links e mensagem", null, function () { ir("convite/" + enc(cv.id) + "/links"); }),
            botao("Editar", null, function () { ir("convite/" + enc(cv.id)); }),
            botao("Excluir", "orc__email painel-perigo", function () { excluirConvite(cv); }))];
      }), lista.map(function (cv) { return cv.id; })));
    }
    prova.addEventListener("change", desenha);
    desenha();
    corpo.append(c);
  }

  function formConvite(cv, padrao) {
    corpo.innerHTML = "";
    corpo.append(trilha("convites", cv ? "Editar convite" : "Novo convite"));
    var c = card(cv ? "Editar convite" : "Novo convite", "Parceiro na prova");
    cv = cv || Object.assign({ desconto: "", comissao_pct: 0, cortesias: 0 }, padrao || {});
    var ativos = S.parceiros.filter(function (p) { return p.ativo || p.id === cv.parceiro_id; });
    if (!ativos.length) { c.append(el("p", "assess-alerta", "Cadastre um parceiro antes de criar convites.")); c.append(botao("Ir para Parceiros", "btn btn--red", function () { ir("parceiros"); })); corpo.append(c); return; }
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
    // Inscrição coletiva (só assessoria e equipe): as condições que vão no link de assessorias.html
    var co = cv.coletiva && !Array.isArray(cv.coletiva) ? cv.coletiva : {};
    function numero(valor, ph, passo) { return entrada("number", valor || "", { min: 0, step: passo || 1, placeholder: ph }); }
    var colPrazo = entrada("date", co.d), colPrazoAtl = entrada("date", co.i);
    var colLimite = numero(co.m, "Sem limite"), colValor = numero(co.v, "Ex.: 89,90", 0.01);
    var colPag = entrada("text", co.g, { maxLength: 80, placeholder: "Ex.: Pix único até 5 dias antes da prova" });
    var colFx = [0, 1, 2].map(function (i) { var p = (co.f || [])[i] || []; return [numero(p[0], "Atletas"), numero(p[1], "% desc.", 0.5)]; });
    var fxBox = el("div", "convite-faixas");
    colFx.forEach(function (p, i) {
      p[0].setAttribute("aria-label", "Faixa " + (i + 1) + ": a partir de quantos atletas");
      p[1].setAttribute("aria-label", "Faixa " + (i + 1) + ": desconto em %");
      var l = el("div", "convite-faixa");
      l.append(el("span", null, "A partir de"), p[0], el("span", null, "atletas:"), p[1], el("span", null, "%"));
      fxBox.append(l);
    });
    var fxCampo = el("div", "orc__field assess-grid__full"); fxCampo.append(el("span", null, "Desconto por volume (até 3 faixas)"), fxBox);
    var benBox = el("div", "convite-benef");
    var colBen = [["t", "Espaço para tenda"], ["k", "Retirada de kits em lote"], ["f", "Foto oficial da equipe"], ["e", "Ponto de encontro"]].map(function (b) {
      var i = el("input"); i.type = "checkbox"; i.value = b[0]; i.checked = String(co.b || "").indexOf(b[0]) >= 0;
      var l = el("label", "assess-toggle"); l.append(i, " " + b[1]); benBox.append(l);
      return i;
    });
    var benCampo = el("div", "orc__field assess-grid__full"); benCampo.append(el("span", null, "Benefícios no dia da prova"), benBox);
    var colKit = entrada("text", co.kt, { maxLength: 90, placeholder: "Ex.: sábado, 9h às 10h, na loja X" });
    var colEncontro = entrada("text", co.pe, { maxLength: 90, placeholder: "Ex.: ao lado do pórtico, às 6h30" });
    var tituloCol = el("div", "assess-grid__full convite-sec");
    tituloCol.append(el("h3", null, "Inscrição coletiva"), el("p", "muted", "Só para assessoria e equipe. Tudo opcional: o que ficar em branco não aparece para a assessoria. As cortesias são as do campo acima."));
    var blocoCol = [tituloCol,
      campo("Prazo para enviar a planilha", colPrazo, "Depois dessa data o link para de funcionar."),
      campo("Limite de atletas", colLimite),
      campo("Prazo interno dos atletas", colPrazoAtl, "Aparece na página da equipe. Em branco, usa o prazo acima."),
      campo("Valor por atleta (R$)", colValor, "A assessoria vê o combinado e o total estimado."),
      fxCampo, campo("Forma de pagamento", colPag, null, true), benCampo,
      campo("Retirada de kits (dia, horário, local)", colKit), campo("Ponto de encontro", colEncontro)];
    blocoCol.forEach(function (x) { f.append(x); });
    function mostraColetiva() {
      var pa = parceiroPorId(parceiro.value);
      var sim = !!pa && (pa.tipo === "assessoria" || pa.tipo === "equipe");
      blocoCol.forEach(function (x) { x.style.display = sim ? "" : "none"; });
    }
    parceiro.addEventListener("change", mostraColetiva);
    mostraColetiva();
    var salvar = el("button", "btn btn--red btn--lg", "Salvar convite"); salvar.type = "submit";
    f.append(barraForm(salvar, botao("Cancelar", null, function () { cancelar("convites"); })));
    c.append(f);
    corpo.append(c);
    vigia(f);
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var cod = cupom.value.trim().toUpperCase();
      if (!/^[A-Z0-9_-]{3,40}$/.test(cod)) return aviso("O cupom precisa ter de 3 a 40 letras, números, hífen ou sublinhado, sem espaços nem acentos.", true);
      if (!prova.value) return aviso("Escolha a prova.", true);
      var linha = {
        prova_id: prova.value, parceiro_id: parceiro.value, cupom: cod, desconto: desconto.value.trim(),
        comissao_pct: Number(comissao.value) || 0, cortesias: parseInt(cortesias.value, 10) || 0,
        contrapartida: contrapartida.value.trim(), condicoes: condicoes.value.trim(),
        coletiva: {
          d: colPrazo.value, m: parseInt(colLimite.value, 10) || 0, i: colPrazoAtl.value,
          v: Number(colValor.value) > 0 ? Math.round(Number(colValor.value) * 100) / 100 : 0,
          f: colFx.map(function (p) { return [Math.floor(Number(p[0].value)) || 0, Number(p[1].value) || 0]; })
            .filter(function (p) { return p[0] > 0 && p[1] > 0 && p[1] <= 100; }).sort(function (a, b) { return a[0] - b[0]; }),
          g: colPag.value.trim(), b: colBen.filter(function (c) { return c.checked; }).map(function (c) { return c.value; }).join(""),
          kt: colKit.value.trim(), pe: colEncontro.value.trim(),
        },
      };
      var pvEsc = provaPorId(prova.value);
      if (linha.coletiva.d && pvEsc && pvEsc.data && linha.coletiva.d > pvEsc.data) return aviso("O prazo da inscrição coletiva não pode ser depois da data da prova.", true);
      salvar.disabled = true;
      var q = cv.id ? api("PUT", "convites/" + encodeURIComponent(cv.id), linha) : api("POST", "convites", linha);
      q.then(function (salvo) {
        S.convites = [salvo].concat(S.convites.filter(function (x) { return x.id !== salvo.id; }));
        filtroProva = salvo.prova_id;
        // O formulário sai do histórico: Voltar a partir dos links leva à lista
        sujo = false;
        location.replace("#convite/" + enc(salvo.id) + "/links");
        aviso("Convite salvo. Confira se o cupom " + cod + " existe na Ticket Sports.");
      }).catch(function (err) { salvar.disabled = false; falha(err); });
    });
  }

  function excluirConvite(cv) {
    pergunta("Excluir o convite do cupom " + cv.cupom + "?", "O parceiro deixa de ver este convite. O cupom na Ticket Sports continua existindo.", "Excluir convite").then(function (sim) {
      if (!sim) return;
      api("DELETE", "convites/" + encodeURIComponent(cv.id)).then(function () {
        S.convites = S.convites.filter(function (x) { return x.id !== cv.id; });
        redesenha();
        aviso("Convite excluído.");
      }).catch(falha);
    });
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
      var co = cv.coletiva && !Array.isArray(cv.coletiva) ? cv.coletiva : {};
      l.coletiva = b + "assessorias.html?c=" + CONVITE.gera({
        p: cv.prova_id, e: pa.nome, d: co.d || "", m: co.m || 0, a: pa.id, t: pa.responsavel || "",
        w: numeroWa(pa.whatsapp), c: (pa.cor || "").replace(/^#/, ""), l: pa.logo || "", k: cv.cortesias || 0,
        v: co.v, f: co.f, g: co.g, b: co.b, kt: co.kt, pe: co.pe, i: co.i,
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
    corpo.innerHTML = "";
    corpo.append(trilha("convites", "Links e mensagem"));
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
    c.append(acoes(wa, cpm, botao("Editar convite", null, function () { ir("convite/" + enc(cv.id)); }),
      botao("Voltar para os convites", null, function () { voltarPara("convites"); })));
    corpo.append(c);
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
          // CSV: lê cada célula como texto. Sem isso, "89,91" (vírgula decimal) vira 8991 e a comissão sai cem vezes maior
          var wb = XLSX.read(new Uint8Array(rd.result), { type: "array", raw: /\.(csv|txt)$/i.test(file.name) });
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
      area.append(el("p", "assess-status", dados.arquivo + ": " + dados.linhas.length + (dados.linhas.length === 1 ? " linha." : " linhas.")), grade);
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
        area.append(el("p", "assess-status", lista.length + (lista.length === 1 ? " envio · " : " envios · ") + total + (total === 1 ? " atleta" : " atletas")));
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
          var api_ = i.origem === "api";
          var canal = api_ ? "Sistema da assessoria" + (i.modo_pagamento === "ticketsports" ? " · paga na Ticket Sports" : i.modo_pagamento === "assessoria" ? " · PIX na assessoria" : "") : i.canal === "email" ? "E-mail" : "WhatsApp";
          return [dataHora(i.criado_em), i.prova_nome, el("strong", null, i.equipe), resp, String(i.atletas != null ? i.atletas : i.total), canal,
            acoes(api_ ? botao("Conferir", "btn btn--red", function () { confereEnvio(i); }) : null, b)];
        })));
        area.append(detalhe);
      }
      // Envio do sistema da assessoria (API v1): conferir cada atleta. Cada mudança avisa o sistema dela.
      var detalhe = el("div");
      var SIT_AT = { recebido: ["Recebido", "is-rasc"], aguardando_pagamento: ["Aguardando pagamento", "is-rasc"], inscrito: ["Inscrito", "is-pub"], recusado: ["Recusado", "is-off"], cancelado: ["Cancelado", "is-off"] };
      function confereEnvio(i) {
        detalhe.innerHTML = ""; detalhe.append(el("p", "muted", "Carregando atletas..."));
        api("GET", "inscricoes/" + encodeURIComponent(i.id) + "/atletas").then(function (at) {
          detalhe.innerHTML = "";
          var t = el("h3", null, "Conferir: " + i.equipe + " · " + i.prova_nome); t.style.marginTop = "1.5rem";
          detalhe.append(t, el("p", "muted", "Confirme quem já foi inscrito oficialmente (com o número de peito, se já tiver) ou recuse com o motivo. A assessoria vê a resposta no sistema dela na hora."));
          var pend = at.filter(function (a) { return a.situacao === "recebido" || a.situacao === "aguardando_pagamento"; }).length;
          if (pend) detalhe.append(acoes(botao("Confirmar os " + pend + " recebidos", "btn btn--red", function (e) {
            var bt = e.currentTarget; bt.disabled = true;
            api("POST", "inscricoes/" + encodeURIComponent(i.id) + "/confirmar", {}).then(function (r) {
              var falhou = (r.avisos || []).some(function (x) { return !x.ok; });
              aviso(r.confirmados + " confirmados." + (falhou ? " O aviso ao sistema da assessoria não foi entregue." : " A assessoria já foi avisada."), falhou);
              confereEnvio(i);
            }).catch(function (err) { bt.disabled = false; falha(err); });
          })));
          detalhe.append(tabela(["Atleta", "Percurso", "Camiseta", "Situação", "Nº de peito", ""], at.map(function (a) {
            var s = SIT_AT[a.situacao] || [a.situacao || "—", "is-rasc"];
            var sit = el("div"); sit.append(situacao(s[0], s[1]));
            if (a.motivo) sit.append(el("small", "muted", " " + a.motivo));
            if (/^erro/.test(a.aviso || "")) { var e = situacao("Aviso não entregue", "is-off"); e.title = a.aviso; sit.append(" ", e); }
            var nome = el("div"); nome.append(el("strong", null, a.nome)); nome.append(el("small", "muted", " · " + (a.sexo || "") + " · " + (a.nascimento || "")));
            var peito = entrada("text", a.numero_peito || "", { maxLength: 10, placeholder: "—" }); peito.style.maxWidth = "6rem";
            function grava(dados, bt) {
              if (bt) bt.disabled = true;
              api("PUT", "atletas/" + a.id, dados).then(function (r) {
                aviso(r.aviso && !r.aviso.ok ? "Salvo, mas o aviso ao sistema da assessoria não foi entregue." : "Salvo. A assessoria foi avisada.", !!(r.aviso && !r.aviso.ok));
                confereEnvio(i);
              }).catch(function (err) { if (bt) bt.disabled = false; falha(err); });
            }
            var ativo = a.situacao !== "cancelado";
            return [nome, a.distancia, a.camiseta, sit, peito, ativo ? acoes(
              botao(a.situacao === "inscrito" ? "Salvar nº" : "Confirmar", null, function (e) { grava({ situacao: "inscrito", numero_peito: peito.value.trim(), motivo: "" }, e.currentTarget); }),
              a.situacao !== "recusado" ? botao("Recusar", "orc__email painel-perigo", function () {
                pergunta("Recusar " + a.nome + "?", "A assessoria vê o motivo no sistema dela.", "Recusar", { campo: "Motivo" }).then(function (mot) {
                  if (mot === null) return;
                  grava({ situacao: "recusado", motivo: mot.trim() || "Recusado pela organização" });
                });
              }) : null) : null];
          })));
          detalhe.scrollIntoView({ behavior: "smooth", block: "start" });
        }).catch(function (e) { detalhe.innerHTML = ""; falha(e); });
      }
      prova.addEventListener("change", desenha);
      desenha();
    });
  }

  // "Me avise quando abrir" (functions/api/aviso.js): quem está esperando o link de cada prova
  function abaAvisos() {
    var c = card("Recebidos pelo site", "Me avise quando abrir");
    c.append(el("p", "muted", "Pessoas que pediram aviso nas provas com \"Inscrições em breve\" ou, em provas já realizadas, o aviso da próxima edição. Depois de colocar o link da Ticket Sports na prova e publicar o site, clique em \"Avisar por e-mail\": cada pessoa recebe o link uma vez."));
    corpo.append(c);
    S.avisos = null;
    carregando(c, "avisos", "avisos", function () {
      var porProva = {};
      S.avisos.forEach(function (a) { porProva[a.prova_id] = a; });
      var lista = todasProvas().filter(function (p) { return porProva[p.id]; });
      // Pedidos de provas que não estão mais na lista (removidas)
      Object.keys(porProva).forEach(function (id) { if (!lista.some(function (p) { return p.id === id; })) lista.push({ id: id, nome: id, data: "" }); });
      if (!lista.length) { c.append(el("p", "muted", "Ninguém pediu aviso ainda.")); return; }
      c.append(tabela(["Prova", "Data", "Esperando", "Já avisados", "Link de inscrição", ""], lista.map(function (p) {
        var o = p.obj || p.linha || {};
        var a = porProva[p.id];
        var pend = Number(a.pendentes) || 0;
        var link = o.inscricao || "";
        var b = null;
        // Prova já realizada: quem pediu aviso quer a próxima edição; escolhe-se a prova nova para mandar o link dela
        if (pend && p.data && dataDe(p.data) < hoje()) {
          var novas = todasProvas().filter(function (n) { return n.id !== p.id && dataDe(n.data) >= hoje() && ((n.obj || n.linha || {}).inscricao); });
          if (!novas.length) return [el("strong", null, p.nome), curta(p.data), String(pend), String(Number(a.enviados) || 0), el("span", "muted", "prova realizada"), el("span", "muted", "cadastre a nova edição com o link de inscrição")];
          var qual = escolha(novas.map(function (n) { return [n.id, n.nome + " · " + curta(n.data)]; }));
          qual.setAttribute("aria-label", "Nova edição para avisar");
          var bn = botao("Avisar da nova edição (" + pend + ")", "btn btn--red btn--sm", function () {
            var n = provaPorId(qual.value), no = n.obj || n.linha || {};
            pergunta("Avisar da nova edição?", "O e-mail \"Inscrições abertas: " + n.nome + "\" vai para " + pend + (pend === 1 ? " pessoa" : " pessoas") + " que pediram aviso na página da " + p.nome + ". Cada pessoa recebe uma vez só.", "Enviar e-mails").then(function (sim) {
              if (!sim) return;
              bn.disabled = true; bn.textContent = "Enviando...";
              api("POST", "avisos/" + encodeURIComponent(p.id) + "/enviar", { nome: n.nome, data: quando(n.data), local: no.local || "", link: no.inscricao, pagina_id: n.id }).then(function (r) {
                aviso(r.enviados + (r.enviados === 1 ? " e-mail enviado" : " e-mails enviados") + (r.falhas ? "; " + r.falhas + " ficaram para depois (clique de novo)" : "") + ".");
                redesenha();
              }).catch(function (e) { bn.disabled = false; bn.textContent = "Avisar da nova edição (" + pend + ")"; falha(e); });
            });
          });
          return [el("strong", null, p.nome), curta(p.data), String(pend), String(Number(a.enviados) || 0), el("span", "muted", "prova realizada"), acoes(qual, bn)];
        }
        if (pend && link) {
          b = botao("Avisar por e-mail (" + pend + ")", "btn btn--red btn--sm", function () {
            pergunta("Avisar por e-mail?", "O e-mail \"Inscrições abertas\" vai para " + pend + (pend === 1 ? " pessoa" : " pessoas") + " que pediram aviso da " + p.nome + ". Cada pessoa recebe uma vez só.", "Enviar e-mails").then(function (sim) {
            if (!sim) return;
            b.disabled = true; b.textContent = "Enviando...";
            api("POST", "avisos/" + encodeURIComponent(p.id) + "/enviar", { nome: p.nome, data: quando(p.data), local: o.local || "", link: link }).then(function (r) {
              aviso(r.enviados + (r.enviados === 1 ? " e-mail enviado" : " e-mails enviados") + (r.falhas ? "; " + r.falhas + " ficaram para depois (clique de novo)" : "") + ".");
              redesenha();
            }).catch(function (e) { b.disabled = false; b.textContent = "Avisar por e-mail (" + pend + ")"; falha(e); });
            });
          });
        }
        return [el("strong", null, p.nome), curta(p.data), String(pend), String(Number(a.enviados) || 0),
          link ? linkExt("Abrir", link) : el("span", "muted", "ainda sem link"), b || ""];
      })));
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

  // =====================================================================
  //  DEPOIMENTOS (aparecem no site: js/ui.js)
  // =====================================================================
  var ONDE = [["empresas", "Página Para empresas (ao lado do orçamento)"], ["inicio", "Página inicial"], ["ambas", "Nas duas"]];
  var NOME_ONDE = { empresas: "Para empresas", inicio: "Página inicial", ambas: "Nas duas" };
  function abaDepoimentos() {
    var c = card("Prova social", "Depoimentos");
    c.append(el("p", "muted", "O que clientes e atletas disseram sobre a Tardim Produções. Os publicados aparecem no site: na página inicial (seção \"Quem viveu conta\", até 6) e na página Para empresas, ao lado do pedido de orçamento (os 2 mais recentes)."));
    if (S.semDepoimentos) {
      c.append(el("p", "assess-alerta", "Falta criar a tabela de depoimentos no banco: npx wrangler d1 execute tardim --remote --file d1/migracoes/008-depoimentos.sql"));
      corpo.append(c);
      return;
    }
    c.append(acoes(botao("Novo depoimento", "btn btn--red", function () { ir("depoimento/novo"); })));
    if (!S.depoimentos.length) c.append(el("p", "muted", "Nenhum depoimento cadastrado ainda."));
    else {
      c.append(tabela(["Quem", "Depoimento", "Aparece em", "Situação", ""], S.depoimentos.map(function (d) {
        var quem = el("div"); quem.append(el("strong", null, d.nome));
        if (d.cargo) quem.append(el("small", "muted", " · " + d.cargo));
        var txt = el("span", "painel-detalhe", d.texto);
        txt.title = d.texto;
        return [quem, txt, NOME_ONDE[d.onde] || d.onde,
          d.publicado ? situacao("Publicado", "is-pub") : situacao("Oculto", "is-rasc"),
          acoes(botao("Editar", null, function () { ir("depoimento/" + enc(d.id)); }),
            botao("Excluir", "orc__email painel-perigo", function () { excluirDepoimento(d); }))];
      }), S.depoimentos.map(function (d) { return d.id; })));
    }
    corpo.append(c);
  }

  function formDepoimento(d) {
    corpo.innerHTML = "";
    corpo.append(trilha("depoimentos", d ? "Editar depoimento" : "Novo depoimento"));
    var c = card(d ? "Editar depoimento" : "Novo depoimento", "Depoimento");
    var novo = !d;
    d = d || { onde: "empresas", publicado: true };
    var f = el("form", "assess-grid"); f.noValidate = true;
    var texto = entrada("textarea", d.texto, { maxLength: 600, rows: 5, required: true, placeholder: "Ex.: A Tardim cuidou de tudo, das licenças à chegada. Foi a nossa melhor edição." });
    var nome = entrada("text", d.nome, { maxLength: 120, required: true, placeholder: "Ex.: Maria Souza" });
    var cargo = entrada("text", d.cargo, { maxLength: 160, placeholder: "Ex.: Diretora de eventos · CREA-MG" });
    var onde = escolha(ONDE, d.onde);
    var publicado = marcador("Publicado (aparece no site)", d.publicado);
    var pl = el("div", "assess-grid__full"); pl.append(publicado);
    f.append(campo("Depoimento", texto, "Até 600 caracteres, sem aspas (o site coloca). Use só com a autorização de quem falou.", true),
      campo("Nome de quem falou", nome), campo("Cargo e instituição", cargo, "Opcional. Para atleta, pode ser a prova: \"Atleta · Volta Noturna da Lagoa\"."),
      campo("Aparece em", onde), pl);
    var salvar = el("button", "btn btn--red btn--lg", "Salvar depoimento"); salvar.type = "submit";
    f.append(barraForm(salvar, botao("Cancelar", null, function () { cancelar("depoimentos"); })));
    c.append(f);
    corpo.append(c);
    vigia(f);
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!texto.value.trim()) return aviso("Escreva o depoimento.", true);
      if (!nome.value.trim()) return aviso("Informe o nome de quem falou.", true);
      var linha = { texto: texto.value.trim(), nome: nome.value.trim(), cargo: cargo.value.trim(), onde: onde.value, publicado: publicado.caixa.checked };
      salvar.disabled = true;
      var q = novo ? api("POST", "depoimentos", linha) : api("PUT", "depoimentos/" + encodeURIComponent(d.id), linha);
      q.then(function (salvo) {
        S.depoimentos = [salvo].concat(S.depoimentos.filter(function (x) { return x.id !== salvo.id; }));
        destaque = salvo.id;
        voltarPara("depoimentos");
        aviso(salvo.publicado ? "Depoimento salvo e já no site (pode levar até 1 minuto para aparecer)." : "Depoimento salvo como oculto: ele não aparece no site.");
      }).catch(function (err) { salvar.disabled = false; falha(err); });
    });
  }

  function excluirDepoimento(d) {
    pergunta("Excluir o depoimento de " + d.nome + "?", "Ele sai do site e do painel.", "Excluir depoimento").then(function (sim) {
      if (!sim) return;
      api("DELETE", "depoimentos/" + encodeURIComponent(d.id)).then(function () {
        S.depoimentos = S.depoimentos.filter(function (x) { return x.id !== d.id; });
        redesenha();
        aviso("Depoimento excluído.");
      }).catch(falha);
    });
  }

  // =====================================================================
  //  PROPOSTAS (orçamento para o cliente: itens, somas e impressão em PDF)
  // =====================================================================
  // "R$ 1.000,00", "1000", "2,5" -> número
  function numBR(s) {
    var t = String(s == null ? "" : s).replace(/[^\d.,-]/g, "");
    if (t.indexOf(",") >= 0) t = t.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
    return Number(t) || 0;
  }
  // 155273 -> "cento e cinquenta e cinco mil, duzentos e setenta e três reais"
  function extenso(valor) {
    var U = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
    var D = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
    var C = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
    function ate999(n) {
      if (n === 100) return "cem";
      var p = [];
      if (n >= 100) { p.push(C[Math.floor(n / 100)]); n %= 100; }
      if (n >= 20) { p.push(D[Math.floor(n / 10)]); n %= 10; }
      if (n > 0) p.push(U[n]);
      return p.join(" e ");
    }
    function inteiro(n) {
      if (n === 0) return "zero";
      var g = [], mi = Math.floor(n / 1e6), mil = Math.floor((n % 1e6) / 1000), r = n % 1000;
      if (mi) g.push({ t: ate999(mi) + (mi === 1 ? " milhão" : " milhões"), v: mi });
      if (mil) g.push({ t: (mil === 1 ? "" : ate999(mil) + " ") + "mil", v: mil });
      if (r) g.push({ t: ate999(r), v: r });
      if (g.length === 1) return g[0].t;
      var ult = g.pop();
      // "e" antes do último grupo quando ele é menor que 100 ou centena exata: "dois mil e um", "mil e duzentos"
      var liga = ult.v < 100 || ult.v % 100 === 0 ? " e " : ", ";
      return g.map(function (x) { return x.t; }).join(", ") + liga + ult.t;
    }
    var v = Math.round((Number(valor) || 0) * 100), re = Math.floor(v / 100), ce = v % 100;
    var txt = inteiro(re) + (re % 1e6 === 0 && re > 0 ? " de" : "") + (re === 1 ? " real" : " reais");
    if (ce) txt += " e " + inteiro(ce) + (ce === 1 ? " centavo" : " centavos");
    return txt;
  }
  // Texto dos itens (uma linha: categoria | descrição | quantidade | valor unitário [| variável]) -> lista + linhas que não entendi
  // "variável" no fim = a quantidade acompanha o nº de participantes (kit, medalha, água); só o simulador interno usa
  function itensDe(texto) {
    var itens = [], erros = [], cat = "";
    linhas(texto).forEach(function (l, n) {
      var p = l.split("|").map(function (x) { return x.trim(); });
      var pp = p.length > 3 && /^vari[aá]ve(l|is)$/i.test(p[p.length - 1]);
      if (pp) p.pop();
      if (p.length === 3) p.unshift(cat);
      if (p.length !== 4 || !p[1]) { erros.push(n + 1); return; }
      cat = p[0] || cat || "Itens";
      var qtd = numBR(p[2]), unit = numBR(p[3]);
      if (!(qtd > 0) || !/\d/.test(p[3])) { erros.push(n + 1); return; }
      var it = { cat: cat, desc: p[1], qtd: qtd, unit: unit };
      if (pp) it.pp = true;
      itens.push(it);
    });
    return { itens: itens, erros: erros };
  }
  function somaItens(itens) {
    var cats = [], total = 0;
    itens.forEach(function (i) {
      var c = cats.filter(function (x) { return x.nome === i.cat; })[0];
      if (!c) { c = { nome: i.cat, itens: [], total: 0 }; cats.push(c); }
      var t = Math.round(i.qtd * i.unit * 100) / 100;
      c.itens.push(i); c.total = Math.round((c.total + t) * 100) / 100; total += t;
    });
    return { cats: cats, total: Math.round(total * 100) / 100 };
  }
  function qtdTxt(n) { return Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 }); }

  // ---------- Minutário: itens padrão das propostas (tabela minutario) ----------
  function carregaMinutario() {
    if (S.minutario) return Promise.resolve(S.minutario);
    return api("GET", "minutario").then(function (d) { S.minutario = d; return d; });
  }
  function chaveItem(desc) { return String(desc || "").replace(/\s+/g, " ").trim().toLowerCase(); }
  // Nome curto do item para as listas: o começo da descrição, até o primeiro corte natural
  function tituloItem(desc) {
    var t = String(desc || "").trim();
    var c = t.split(/ - |\. |, | \(|: /)[0];
    if (c.length < 14) c = t;
    return c.length > 72 ? c.slice(0, 70).replace(/\s+\S*$/, "") + "…" : c;
  }
  // Célula "nome curto + começo do resto"; a descrição inteira aparece ao passar o mouse
  function celulaItem(desc) {
    var d = el("div", "proposta-itens__desc");
    var t = tituloItem(desc);
    d.append(el("strong", null, t));
    var resto = String(desc || "").trim().slice(t.replace(/…$/, "").length).replace(/^[\s.,:(-]+/, "");
    if (resto) d.append(el("small", null, resto));
    d.title = desc || "";
    return d;
  }
  // Formulário de um item (proposta ou minutário). Devolve { cat, desc, qtd, unit, pp } ou null se cancelar.
  function dialogoItem(titulo, it, cats) {
    it = it || {};
    return new Promise(function (ok) {
      var res = null;
      var d = el("dialog", "painel-dialogo painel-dialogo--largo");
      var f = el("form"); f.method = "dialog"; f.noValidate = true;
      var lista = el("datalist"); lista.id = "cats-" + Date.now();
      (cats || []).forEach(function (c) { var o = el("option"); o.value = c; lista.append(o); });
      var cat = entrada("text", it.cat || "", { maxLength: 80, placeholder: "Ex.: Estrutura do evento" });
      cat.setAttribute("list", lista.id);
      var desc = entrada("textarea", it.desc || "", { rows: 6, maxLength: 2000 });
      var qtd = entrada("text", it.qtd ? qtdTxt(it.qtd) : "1", { inputMode: "decimal" });
      var unit = entrada("text", it.unit ? reais(it.unit) : "", { inputMode: "decimal", placeholder: "R$ 0,00" });
      var pp = marcador("Variável: a quantidade acompanha o número de participantes (kit, medalha, hidratação)", it.pp);
      var erro = el("p", "assess-alerta"); erro.hidden = true;
      var dupla = el("div", "painel-dialogo__dupla"); dupla.append(campo("Quantidade", qtd), campo("Valor unitário", unit));
      var bNao = el("button", "btn btn--line", "Cancelar"); bNao.value = "nao";
      var bSim = el("button", "btn btn--red", "Salvar item"); bSim.type = "button";
      bSim.addEventListener("click", function () {
        var q = numBR(qtd.value), texto = desc.value.replace(/\s*\r?\n\s*/g, " ").replace(/\|/g, "/").trim();
        var msg = !texto ? "Escreva a descrição do item." : (!(q > 0) ? "A quantidade precisa ser maior que zero." : "");
        if (msg) { erro.textContent = msg; erro.hidden = false; return; }
        res = { cat: cat.value.replace(/\|/g, "/").trim() || "Itens", desc: texto, qtd: q, unit: numBR(unit.value), pp: pp.caixa.checked };
        d.close();
      });
      var linha = el("div", "painel-dialogo__acoes"); linha.append(bNao, bSim);
      f.append(el("h2", null, titulo), campo("Categoria", cat), lista, campo("Descrição completa (sai na proposta)", desc), dupla, pp, erro, linha);
      d.append(f); document.body.append(d);
      d.addEventListener("close", function () { d.remove(); ok(res); });
      d.showModal();
      (it.desc ? qtd : cat).focus();
    });
  }
  // Lista do minutário para marcar o que entra na proposta. Devolve as linhas escolhidas ([] se cancelar).
  function escolheDoMinutario() {
    return carregaMinutario().then(function (min) {
      return new Promise(function (ok) {
        var res = [];
        var d = el("dialog", "painel-dialogo painel-dialogo--largo");
        var f = el("form"); f.method = "dialog";
        var busca = entrada("search", "", { placeholder: "Buscar: tenda, staff, medalha..." });
        busca.setAttribute("aria-label", "Buscar no minutário");
        var caixa = el("div", "minutario-lista");
        var marcados = {};
        var bSim = el("button", "btn btn--red", "Adicionar"); bSim.type = "button";
        var conta = function () {
          var n = Object.keys(marcados).length;
          bSim.textContent = n ? "Adicionar " + n + (n === 1 ? " item" : " itens") : "Adicionar";
          bSim.disabled = !n;
        };
        var desenha = function () {
          caixa.innerHTML = "";
          var q = chaveItem(busca.value), cat = null, achou = 0;
          min.forEach(function (m) {
            if (q && chaveItem(m.categoria + " " + m.descricao).indexOf(q) < 0) return;
            achou++;
            if (m.categoria !== cat) { cat = m.categoria; caixa.append(el("h3", null, cat || "Itens")); }
            var l = el("label", "minutario-lista__item");
            var c = entrada("checkbox"); c.checked = !!marcados[m.id];
            c.addEventListener("change", function () { if (c.checked) marcados[m.id] = m; else delete marcados[m.id]; conta(); });
            l.append(c, celulaItem(m.descricao), el("span", "minutario-lista__valor", reais((m.dados || {}).unit)));
            caixa.append(l);
          });
          if (!achou) caixa.append(el("p", "muted", min.length ? "Nenhum item com esse texto." : "O minutário ainda está vazio. Abra uma proposta pronta e use \"Guardar estes itens no minutário\"."));
        };
        busca.addEventListener("input", desenha);
        busca.addEventListener("keydown", function (e) { if (e.key === "Enter") e.preventDefault(); });
        bSim.addEventListener("click", function () { res = min.filter(function (m) { return marcados[m.id]; }); d.close(); });
        var bNao = el("button", "btn btn--line", "Cancelar"); bNao.value = "nao";
        var linha = el("div", "painel-dialogo__acoes"); linha.append(bNao, bSim);
        f.append(el("h2", null, "Adicionar do minutário"), busca, caixa, linha);
        d.append(f); document.body.append(d);
        d.addEventListener("close", function () { d.remove(); ok(res); });
        desenha(); conta();
        d.showModal();
        busca.focus();
      });
    });
  }

  function telaMinutario() {
    corpo.append(trilha("propostas", "Minutário"));
    var c = card("Comercial", "Minutário");
    c.append(el("p", "muted", "Os itens padrão das propostas, com a descrição completa, o valor unitário e a quantidade de referência. Na proposta, \"Adicionar do minutário\" traz o item pronto e você só ajusta a quantidade. Mudar um item aqui não altera as propostas já salvas."));
    var lugar = el("div");
    var cats = function () { var l = []; (S.minutario || []).forEach(function (m) { if (l.indexOf(m.categoria) < 0) l.push(m.categoria); }); return l; };
    var linhaDe = function (r, antigo) {
      var da = (antigo && antigo.dados) || {};
      return { categoria: r.cat, descricao: r.desc, dados: { unit: r.unit, qtd: r.qtd, pp: !!r.pp, base: Number(da.base) || 0 } };
    };
    var ordena = function () { S.minutario.sort(function (a, b) { return String(a.categoria).localeCompare(String(b.categoria), "pt-BR", { sensitivity: "base" }); }); };
    var desenha = function () {
      lugar.innerHTML = "";
      if (!S.minutario.length) { lugar.append(el("p", "muted", "Nenhum item ainda. Cadastre com \"Novo item\" ou abra uma proposta pronta e use \"Guardar estes itens no minutário\".")); return; }
      cats().forEach(function (cat) {
        var itens = S.minutario.filter(function (m) { return m.categoria === cat; });
        lugar.append(el("h3", "minutario-cat", (cat || "Itens") + " (" + itens.length + ")"));
        lugar.append(tabela(["Item", "Qtd. de referência", "Valor unitário", "Variável", ""], itens.map(function (m) {
          var dd = m.dados || {};
          return [celulaItem(m.descricao), qtdTxt(dd.qtd || 1) + (dd.pp && dd.base ? " para " + Number(dd.base).toLocaleString("pt-BR") + " participantes" : ""), reais(dd.unit), dd.pp ? "Sim" : "",
            acoes(botao("Editar", null, function () {
              dialogoItem("Editar item do minutário", { cat: m.categoria, desc: m.descricao, qtd: dd.qtd || 1, unit: dd.unit, pp: dd.pp }, cats()).then(function (r) {
                if (!r) return;
                api("PUT", "minutario/" + encodeURIComponent(m.id), linhaDe(r, m)).then(function (s) {
                  S.minutario = S.minutario.map(function (x) { return x.id === s.id ? s : x; }); ordena(); desenha(); aviso("Item salvo.");
                }).catch(falha);
              });
            }), botao("Excluir", "orc__email painel-perigo", function () {
              pergunta("Excluir este item do minutário?", tituloItem(m.descricao) + ". As propostas já salvas não mudam.", "Excluir item").then(function (sim) {
                if (!sim) return;
                api("DELETE", "minutario/" + encodeURIComponent(m.id)).then(function () {
                  S.minutario = S.minutario.filter(function (x) { return x.id !== m.id; }); desenha(); aviso("Item excluído.");
                }).catch(falha);
              });
            }))];
        }), itens.map(function (m) { return m.id; })));
      });
    };
    c.append(acoes(botao("Novo item", "btn btn--red", function () {
      dialogoItem("Novo item do minutário", null, cats()).then(function (r) {
        if (!r) return;
        api("POST", "minutario", linhaDe(r)).then(function (s) { S.minutario.push(s); ordena(); desenha(); aviso("Item salvo no minutário."); }).catch(falha);
      });
    }), botao("Voltar para as propostas", null, function () { ir("propostas"); })));
    var p = el("p", "muted", "Carregando...");
    c.append(p, lugar);
    corpo.append(c);
    carregaMinutario().then(function () { p.remove(); desenha(); }).catch(function (e) {
      p.textContent = "Não consegui ler o minutário. Se a tabela ainda não existe no banco: npx wrangler d1 execute tardim --remote --file d1/migracoes/011-minutario.sql";
      p.className = "assess-alerta";
      falha(e);
    });
  }

  function abaPropostas() {
    var c = card("Comercial", "Propostas");
    c.append(el("p", "muted", "Cada proposta vai do orçamento ao contrato assinado em cinco passos: montar, enviar ao cliente, registrar a resposta, gerar o contrato e registrar a assinatura. Abra a proposta para ver o próximo passo."));
    c.append(acoes(botao("Nova proposta", "btn btn--red", function () { ir("proposta/novo"); }),
      botao("Minutário (itens padrão)", null, function () { ir("minutario"); }),
      botao("Empresa e modelo do contrato", null, function () { ir("modelo-contrato"); })));
    corpo.append(c);
    var p = el("p", "muted", "Carregando..."); c.append(p);
    var desenha = function () {
      p.remove();
      if (!S.propostas.length) { c.append(el("p", "muted", "Nenhuma proposta ainda. Comece por \"Nova proposta\".")); return; }
      c.append(tabela(["Nº", "Cliente", "Evento", "Total", "Situação", ""], S.propostas.map(function (x) {
        var d = x.dados || {}, sit = SIT_ETAPA[etapaDe(x)];
        return [x.numero || "—", el("strong", null, x.cliente), x.evento || "", reais(somaItens(d.itens || []).total), situacao(sit[0], sit[1]),
          acoes(botao("Abrir", "btn btn--line btn--sm", function () { ir("proposta/" + enc(x.id)); }),
            botao("Duplicar", null, function () { ir("proposta/novo?de=" + enc(x.id)); }),
            botao("Excluir", "orc__email painel-perigo", function () { excluirProposta(x); }))];
      }), S.propostas.map(function (x) { return x.id; })));
    };
    if (S.propostas) desenha();
    else api("GET", "propostas").then(function (d) { S.propostas = d; desenha(); }).catch(function (e) {
      p.textContent = "Não consegui ler as propostas. Se a tabela ainda não existe no banco: npx wrangler d1 execute tardim --remote --file d1/migracoes/010-propostas.sql";
      p.className = "assess-alerta";
      falha(e);
    });
  }

  // item = proposta em edição; modelo = proposta de onde se duplica (leva os itens, não o cliente)
  function formProposta(item, modelo) {
    corpo.innerHTML = "";
    corpo.append(trilha("propostas", item ? "Editar proposta" : (modelo ? "Duplicar proposta" : "Nova proposta")));
    var c = card(item ? "Editar proposta" : "Nova proposta", item ? item.cliente : "Proposta comercial");
    var d = JSON.parse(JSON.stringify((item || modelo || {}).dados || {}));
    var cl = d.cliente || {}, ev = d.evento || {};
    var hojeIso = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    var f = el("form", "assess-grid"); f.noValidate = true;
    var maior = (S.propostas || []).reduce(function (m, x) { return Math.max(m, parseInt(x.numero, 10) || 0); }, 0);
    var numero = entrada("text", item ? item.numero : (maior ? String(maior + 1) : ""), { maxLength: 20 });
    var data = entrada("date", item ? d.data : hojeIso);
    var validade = entrada("date", item ? d.validade : "");
    var emitente = entrada("text", d.emitente, { maxLength: 200, placeholder: "Ex.: Nome do responsável · telefone · e-mail" });
    var cNome = entrada("text", modelo ? "" : cl.nome, { maxLength: 160, required: true });
    var cCnpj = entrada("text", modelo ? "" : cl.cnpj, { maxLength: 20 });
    var cEnd = entrada("text", modelo ? "" : cl.endereco, { maxLength: 200 });
    var cRep = entrada("text", modelo ? "" : cl.representante, { maxLength: 160, placeholder: "Nome e cargo de quem assina" });
    var eNome = entrada("text", modelo ? "" : ev.nome, { maxLength: 200 });
    var eData = entrada("date", modelo ? "" : ev.data);
    var eLocal = entrada("text", modelo ? "" : ev.local, { maxLength: 200 });
    var ePart = entrada("number", ev.participantes || "", { min: 0, step: 1 });
    var itens = entrada("textarea", (d.itens || []).map(function (i) { return [i.cat, i.desc, qtdTxt(i.qtd), reais(i.unit)].concat(i.pp ? ["variável"] : []).join(" | "); }).join("\n"),
      { rows: 16, placeholder: "Estrutura do evento | Pórtico de largada/chegada em Box Truss 6,0m x 4,0m | 1 | R$ 1.000,00\nEstrutura do evento | Tenda 4,0m x 4,0m piramidal | 7 | R$ 380,00\nSonorização | Sonorização do palco com DJ e técnico | 1 | R$ 2.800,00" });
    var obs = entrada("textarea", d.obs, { rows: 4, maxLength: 3000, placeholder: "Uma observação por linha: validade, forma de pagamento, o que não está incluso..." });
    var resumo = el("div", "proposta-resumo assess-grid__full");
    resumo.setAttribute("role", "status");
    // Simulador interno: custo, arrecadação e resultado para outros números de participantes (não sai na proposta)
    var sm = d.sim || {};
    var sPat = entrada("text", sm.patrocinio ? reais(sm.patrocinio) : "", { placeholder: "R$ 0,00", inputMode: "decimal" });
    var sIns = entrada("text", sm.inscricao ? reais(sm.inscricao) : "", { placeholder: "R$ 100,00", inputMode: "decimal" });
    var sImp = entrada("number", sm.imposto == null ? "" : sm.imposto, { min: 0, max: 100, step: 0.5, placeholder: "6" });
    var sFx = entrada("text", sm.faixas || "", { maxLength: 200, placeholder: "1000, 2000, 3000, 5000" });
    var simBox = el("div", "proposta-sim assess-grid__full");
    var marcar = botao("Marcar como variáveis os itens com quantidade igual ou maior que o nº de participantes", null, function () {
      var base = parseInt(ePart.value, 10) || 0;
      if (!base) return aviso("Informe o número de participantes do evento primeiro.", true);
      var n = 0;
      itens.value = itens.value.split(/\r?\n/).map(function (l) {
        var r = itensDe(l);
        if (r.itens.length !== 1 || r.itens[0].pp || r.itens[0].qtd < base) return l;
        n++;
        return l.replace(/\s*$/, "") + " | variável";
      }).join("\n");
      calcula();
      sincroniza();
      sujo = true;
      aviso(n ? n + (n === 1 ? " item marcado" : " itens marcados") + " como variável. Confira e ajuste à mão o que for preciso." : "Nenhum item novo com quantidade igual ou maior que " + base + ".");
    });
    function simula(lista) {
      simBox.innerHTML = "";
      var base = parseInt(ePart.value, 10) || 0;
      var faixas = sFx.value.split(/[;,\s]+/).map(function (x) { return parseInt(x.replace(/\D/g, ""), 10) || 0; }).filter(function (x) { return x > 0; });
      if (!base || !lista.length) { simBox.append(el("p", "muted", "Informe o número de participantes do evento e os itens para simular.")); return; }
      if (faixas.indexOf(base) < 0) faixas.unshift(base);
      faixas = faixas.filter(function (x, i) { return faixas.indexOf(x) === i; }).sort(function (a, b) { return a - b; }).slice(0, 20);
      var variaveis = lista.filter(function (i) { return i.pp; }).length;
      var pat = numBR(sPat.value), ins = numBR(sIns.value), imp = Math.min(Math.max(Number(sImp.value) || 0, 0), 100);
      var custo = function (n) { return valorParaParticipantes(lista, base, n); };
      simBox.append(tabela(["Participantes", "Valor do evento", "Custo por participante", "Arrecadação", "Resultado bruto", "Resultado líquido", "Inscrição de equilíbrio"], faixas.map(function (n) {
        var c = custo(n), arr = pat + ins * n, bruto = arr - c, liq = bruto > 0 ? bruto * (1 - imp / 100) : bruto;
        var eq = (c - pat) / n;
        var rb = el("span", bruto < 0 ? "proposta-sim__neg" : null, ins ? reais(bruto) : "—");
        return [el("strong", null, n.toLocaleString("pt-BR") + (n === base ? " (proposta)" : "")), reais(c), reais(c / n),
          ins ? reais(arr) : "—", rb, ins ? reais(liq) : "—", reais(Math.max(eq, 0))];
      })));
      simBox.append(el("p", "muted", (variaveis ? variaveis + (variaveis === 1 ? " item variável" : " itens variáveis") + " (quantidade proporcional aos participantes, arredondada para cima); os demais ficam fixos." : "Nenhum item está marcado como variável: o valor do evento fica igual em todas as faixas. Marque com \"| variável\" no fim da linha.") +
        " Arrecadação = patrocínio + inscrição × participantes. Resultado líquido = bruto menos " + String(imp).replace(".", ",") + "% de imposto. Inscrição de equilíbrio = (valor do evento − patrocínio) ÷ participantes."));
    }
    [sPat, sIns, sImp, sFx, ePart].forEach(function (x) { x.addEventListener("input", function () { calcula(); }); });
    function calcula() {
      var r = itensDe(itens.value), s = somaItens(r.itens);
      resumo.innerHTML = "";
      if (r.erros.length) resumo.append(el("p", "assess-alerta", "Não entendi " + (r.erros.length === 1 ? "a linha " : "as linhas ") + r.erros.join(", ") + ". Cada linha precisa de: categoria | descrição | quantidade | valor unitário."));
      if (s.cats.length) {
        var ul = el("ul");
        s.cats.forEach(function (x) { var li = el("li"); li.append(el("span", null, x.nome + " (" + x.itens.length + (x.itens.length === 1 ? " item)" : " itens)")), el("b", null, reais(x.total))); ul.append(li); });
        var tot = el("li", "proposta-resumo__total"); tot.append(el("span", null, "Total geral"), el("b", null, reais(s.total))); ul.append(tot);
        resumo.append(ul, el("p", "muted", extenso(s.total)));
      }
      simula(r.itens);
      return { r: r, s: s };
    }
    itens.addEventListener("input", function () { calcula(); sincroniza(); });

    // Tabela de itens: M é a lista em edição; o campo de texto (escondido em "Colar ou editar como texto")
    // continua sendo o que o resumo, o simulador e o Salvar leem
    var M = [];
    var editor = el("div", "proposta-itens assess-grid__full");
    var arred = function (x) { return Math.round(x * 100) / 100; };
    var catsDe = function () { var l = []; M.forEach(function (i) { if (l.indexOf(i.cat) < 0) l.push(i.cat); }); return l; };
    function grava(redesenha) {
      itens.value = M.map(function (i) { return [i.cat, i.desc, qtdTxt(i.qtd), reais(i.unit)].concat(i.pp ? ["variável"] : []).join(" | "); }).join("\n");
      calcula();
      sujo = true;
      if (redesenha) desenhaItens();
    }
    function sincroniza() {
      M = itensDe(itens.value).itens.map(function (i) { return { cat: i.cat, desc: i.desc, qtd: i.qtd, unit: i.unit, pp: !!i.pp }; });
      desenhaItens();
    }
    function desenhaItens() {
      editor.innerHTML = "";
      // Agrupa por categoria, na ordem em que aparecem (a mesma da proposta impressa)
      var cats = catsDe();
      M = cats.reduce(function (l, c) { return l.concat(M.filter(function (i) { return i.cat === c; })); }, []);
      if (!M.length) { editor.append(el("p", "muted", "Nenhum item ainda. Use \"Adicionar do minutário\" ou \"Item avulso\".")); return; }
      var w = el("div", "painel-tab"), t = el("table"), th = el("tr"), tb = el("tbody"), n = 0;
      ["Nº", "Item", "Qtd.", "Valor unitário", "Total", "Variável", ""].forEach(function (h) { th.append(el("th", null, h)); });
      var thead = el("thead"); thead.append(th);
      cats.forEach(function (c) {
        var trc = el("tr", "proposta-itens__cat"), thc = el("th", null, c);
        thc.colSpan = 7; trc.append(thc); tb.append(trc);
        M.filter(function (i) { return i.cat === c; }).forEach(function (i) {
          n++;
          var tr = el("tr");
          var q = entrada("text", qtdTxt(i.qtd), { inputMode: "decimal" });
          var u = entrada("text", reais(i.unit), { inputMode: "decimal" });
          var v = entrada("checkbox"); v.checked = !!i.pp;
          q.setAttribute("aria-label", "Quantidade do item " + n);
          u.setAttribute("aria-label", "Valor unitário do item " + n);
          v.setAttribute("aria-label", "Item " + n + " varia com o número de participantes");
          var tot = el("td", "proposta-itens__n", reais(arred(i.qtd * i.unit)));
          q.addEventListener("input", function () { var x = numBR(q.value); if (x > 0) { i.qtd = x; tot.textContent = reais(arred(i.qtd * i.unit)); grava(); } });
          u.addEventListener("input", function () { i.unit = numBR(u.value); tot.textContent = reais(arred(i.qtd * i.unit)); grava(); });
          q.addEventListener("blur", function () { q.value = qtdTxt(i.qtd); });
          u.addEventListener("blur", function () { u.value = reais(i.unit); });
          v.addEventListener("change", function () { i.pp = v.checked; grava(); });
          [q, u].forEach(function (x) { x.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); x.blur(); } }); });
          var cel = function (cls, filho) { var td = el("td", cls); td.append(filho); return td; };
          tr.append(el("td", "proposta-itens__n", String(n)), cel(null, celulaItem(i.desc)), cel("proposta-itens__q", q), cel("proposta-itens__u", u), tot, cel("proposta-itens__v", v),
            cel(null, acoes(botao("Editar", null, function () {
              dialogoItem("Editar item", i, catsDe()).then(function (r) { if (!r) return; i.cat = r.cat; i.desc = r.desc; i.qtd = r.qtd; i.unit = r.unit; i.pp = r.pp; grava(true); });
            }), botao("Remover", "orc__email painel-perigo", function () { M.splice(M.indexOf(i), 1); grava(true); }))));
          tb.append(tr);
        });
      });
      t.append(thead, tb); w.append(t); editor.append(w);
    }
    var doMinutario = botao("Adicionar do minutário", "btn btn--line", function () {
      escolheDoMinutario().then(function (sel) {
        if (!sel.length) return;
        var base = parseInt(ePart.value, 10) || 0;
        sel.forEach(function (m) {
          var dd = m.dados || {}, q = Number(dd.qtd) || 1;
          // Item variável: ajusta a quantidade de referência ao número de participantes desta proposta
          if (dd.pp && dd.base > 0 && base > 0) q = Math.ceil(q * base / dd.base);
          M.push({ cat: m.categoria || "Itens", desc: m.descricao, qtd: q, unit: Number(dd.unit) || 0, pp: !!dd.pp });
        });
        grava(true);
        aviso(sel.length + (sel.length === 1 ? " item adicionado." : " itens adicionados.") + " Confira as quantidades.");
      }).catch(falha);
    });
    var avulso = botao("Item avulso", null, function () {
      var cs = catsDe();
      dialogoItem("Item avulso", { cat: cs[cs.length - 1] || "" }, cs).then(function (r) { if (!r) return; M.push(r); grava(true); });
    });
    var guardar = botao("Guardar estes itens no minutário", null, function () {
      if (!M.length) return aviso("Inclua pelo menos um item primeiro.", true);
      pergunta("Guardar os itens desta proposta no minutário?", "Os itens que ainda não estão lá entram como padrão; os que já estão ficam com o valor e a quantidade desta proposta.", "Guardar no minutário").then(function (sim) {
        if (!sim) return;
        guardar.disabled = true;
        var base = parseInt(ePart.value, 10) || 0, novos = 0, mudados = 0;
        carregaMinutario().then(function () {
          return M.reduce(function (fila, i) {
            return fila.then(function () {
              var linha = { categoria: i.cat, descricao: i.desc, dados: { unit: i.unit, qtd: i.qtd, pp: !!i.pp, base: base } };
              var ja = S.minutario.filter(function (m) { return chaveItem(m.descricao) === chaveItem(i.desc); })[0];
              if (!ja) return api("POST", "minutario", linha).then(function (s) { S.minutario.push(s); novos++; });
              if (JSON.stringify([ja.categoria, ja.dados]) === JSON.stringify([linha.categoria, linha.dados])) return null;
              return api("PUT", "minutario/" + encodeURIComponent(ja.id), linha).then(function (s) { S.minutario = S.minutario.map(function (x) { return x.id === s.id ? s : x; }); mudados++; });
            });
          }, Promise.resolve());
        }).then(function () {
          guardar.disabled = false;
          aviso("Minutário atualizado: " + novos + (novos === 1 ? " item novo" : " itens novos") + " e " + mudados + (mudados === 1 ? " atualizado." : " atualizados."));
        }).catch(function (e) { guardar.disabled = false; S.minutario = null; falha(e); });
      });
    });
    var comoTexto = el("details", "proposta-texto assess-grid__full");
    comoTexto.append(el("summary", null, "Colar ou editar como texto"),
      campo("Uma linha por item: categoria | descrição | quantidade | valor unitário (com \"| variável\" no fim, se a quantidade acompanha os participantes)", itens, null, true));
    sincroniza();
    var sec = function (t, sub) { var x = el("div", "assess-grid__full convite-sec"); x.append(el("h3", null, t)); if (sub) x.append(el("p", "muted", sub)); return x; };
    f.append(campo("Número da proposta", numero), campo("Data da proposta", data), campo("Válida até", validade),
      campo("Responsável e contato (sai no cabeçalho)", emitente),
      sec("Cliente"), campo("Nome ou razão social", cNome), campo("CNPJ ou CPF", cCnpj), campo("Endereço", cEnd), campo("Representante", cRep),
      sec("Evento"), campo("Nome do evento", eNome), campo("Data do evento", eData), campo("Local", eLocal), campo("Participantes", ePart),
      sec("Itens", "Traga os itens do minutário e ajuste a quantidade e o valor de cada um. O painel calcula o total de cada linha, de cada categoria e o geral."),
      editor, (function () { var x = acoes(doMinutario, avulso, guardar); x.classList.add("assess-grid__full"); return x; })(), comoTexto, resumo,
      sec("Simulador por participantes", "Uso interno: não aparece na proposta impressa nem no site. Mostra como o valor do evento e o resultado mudam com mais ou menos inscritos. Itens com \"| variável\" no fim da linha (kit, medalha, hidratação) acompanham o número de participantes."),
      campo("Patrocínios (R$)", sPat), campo("Valor da inscrição (R$)", sIns), campo("Imposto sobre o resultado (%)", sImp), campo("Faixas de participantes", sFx, "Separadas por vírgula."),
      (function () { var x = el("div", "assess-grid__full"); x.append(marcar); return x; })(), simBox,
      campo("Observações", obs, null, true));
    var salvar = el("button", "btn btn--red btn--lg", "Salvar proposta"); salvar.type = "submit";
    var volta = item ? "proposta/" + enc(item.id) : "propostas";
    f.append(barraForm(salvar, botao("Cancelar", null, function () { cancelar(volta); })));
    var etapa = item ? etapaDe(item) : "rascunho";
    if (etapa === "assinado") {
      c.append(el("p", "assess-alerta", "O contrato desta proposta já foi assinado, então ela não muda mais. Para um acréscimo ou mudança, use \"Duplicar\" e faça uma proposta de aditivo."));
      salvar.disabled = true;
    } else if (etapa === "contrato") {
      c.append(el("p", "assess-alerta", "O contrato desta proposta já foi gerado. Se mudar itens ou valores, gere o PDF do contrato de novo no passo 4 antes de mandar assinar."));
    }
    c.append(f);
    corpo.append(c);
    calcula();
    vigia(f);
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var k = calcula();
      if (!cNome.value.trim()) return aviso("Informe o nome do cliente.", true);
      if (k.r.erros.length) return aviso("Corrija as linhas dos itens que não foram entendidas antes de salvar.", true);
      if (!k.r.itens.length) return aviso("Inclua pelo menos um item.", true);
      var linha = {
        numero: numero.value.trim(), cliente: cNome.value.trim(), evento: eNome.value.trim(),
        dados: {
          data: data.value, validade: validade.value, emitente: emitente.value.trim(),
          cliente: { nome: cNome.value.trim(), cnpj: cCnpj.value.trim(), endereco: cEnd.value.trim(), representante: cRep.value.trim() },
          evento: { nome: eNome.value.trim(), data: eData.value, local: eLocal.value.trim(), participantes: parseInt(ePart.value, 10) || 0 },
          itens: k.r.itens, obs: obs.value.trim(),
          sim: { patrocinio: numBR(sPat.value), inscricao: numBR(sIns.value), imposto: sImp.value === "" ? null : Number(sImp.value) || 0, faixas: sFx.value.trim() },
        },
      };
      // Editando: o andamento (etapa, datas e dados do contrato) continua o mesmo; duplicando, começa do zero
      if (item) ["etapa", "marcos", "contrato"].forEach(function (k) { if (d[k] !== undefined) linha.dados[k] = d[k]; });
      salvar.disabled = true;
      var q = item ? api("PUT", "propostas/" + encodeURIComponent(item.id), linha) : api("POST", "propostas", linha);
      q.then(function (salva) {
        S.propostas = [salva].concat((S.propostas || []).filter(function (x) { return x.id !== salva.id; }));
        voltarPara("proposta/" + enc(salva.id));
        aviso("Proposta salva. Total: " + reais(k.s.total) + ".");
      }).catch(function (err) { salvar.disabled = false; falha(err); });
    });
  }

  function excluirProposta(x) {
    pergunta("Excluir a proposta" + (x.numero ? " nº " + x.numero : "") + " de " + x.cliente + "?", "Ela sai do painel. Um PDF já salvo ou enviado continua existindo.", "Excluir proposta").then(function (sim) {
      if (!sim) return;
      api("DELETE", "propostas/" + encodeURIComponent(x.id)).then(function () {
        S.propostas = S.propostas.filter(function (y) { return y.id !== x.id; });
        redesenha();
        aviso("Proposta excluída.");
      }).catch(falha);
    });
  }

  // =====================================================================
  //  DO ORÇAMENTO AO CONTRATO ASSINADO (andamento de cada proposta)
  //  dados.etapa: rascunho → enviada → aprovada (ou recusada) → contrato → assinado
  //  dados.marcos: data de cada etapa · dados.contrato: número, empresa, contratante, pagamento...
  // =====================================================================
  var ORDEM_ETAPA = { rascunho: 0, enviada: 1, aprovada: 2, recusada: 2, contrato: 3, assinado: 4 };
  var SIT_ETAPA = { rascunho: ["Em montagem", "is-rasc"], enviada: ["Enviada ao cliente", "is-env"], aprovada: ["Aprovada", "is-pub"],
    recusada: ["Recusada", "is-nao"], contrato: ["Contrato para assinar", "is-env"], assinado: ["Contrato assinado", "is-ok"] };
  var PASSOS = ["Montar a proposta", "Enviar ao cliente", "Resposta do cliente", "Gerar o contrato", "Assinatura"];
  function etapaDe(x) { var e = ((x && x.dados) || {}).etapa; return ORDEM_ETAPA[e] != null ? e : "rascunho"; }
  function hojeIso() { var t = new Date(); return new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function escHtml(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]; }); }
  function secao(t, sub) { var x = el("div", "assess-grid__full convite-sec"); x.append(el("h3", null, t)); if (sub) x.append(el("p", "muted", sub)); return x; }
  function linhaCheia(n) { n.classList.add("assess-grid__full"); return n; }
  // Valor do evento para n participantes: itens "variáveis" crescem na proporção (arredondando para cima); os demais ficam fixos
  function valorParaParticipantes(itens, base, n) {
    return Math.round(itens.reduce(function (t, i) { return t + (i.pp && base ? Math.ceil(i.qtd * n / base) : i.qtd) * i.unit; }, 0) * 100) / 100;
  }
  // Faixas do Anexo II: as do simulador da proposta, mais o número da própria proposta
  function faixasDe(d) {
    var base = Number((d.evento || {}).participantes) || 0;
    var l = String((d.sim || {}).faixas || "").split(/[;,\s]+/).map(function (x) { return parseInt(x.replace(/\D/g, ""), 10) || 0; }).filter(function (x) { return x > 0; });
    if (base && l.indexOf(base) < 0) l.push(base);
    return l.filter(function (x, i) { return l.indexOf(x) === i; }).sort(function (a, b) { return a - b; }).slice(0, 20);
  }

  function carregaConfig() {
    if (S.config) return Promise.resolve(S.config);
    return api("GET", "config/contrato").then(function (c) { S.config = c || {}; return S.config; });
  }
  // Grava o "dados" da proposta (e, se vier, o nome do cliente da lista); o servidor mantém o resto
  function salvaDados(x, mudancas, topo) {
    var corpoPut = Object.assign({ dados: Object.assign({}, x.dados || {}, mudancas) }, topo || {});
    return api("PUT", "propostas/" + encodeURIComponent(x.id), corpoPut).then(function (s) {
      S.propostas = (S.propostas || []).map(function (y) { return y.id === s.id ? s : y; });
      return s;
    });
  }
  function marcaEtapa(x, etapa, data, extra, topo) {
    var marcos = Object.assign({}, (x.dados || {}).marcos);
    marcos[etapa] = data || hojeIso();
    return salvaDados(x, Object.assign({ etapa: etapa, marcos: marcos }, extra || {}), topo);
  }
  function voltaEtapa(x, para, extra) {
    var marcos = Object.assign({}, (x.dados || {}).marcos);
    Object.keys(ORDEM_ETAPA).forEach(function (e) { if (ORDEM_ETAPA[e] > ORDEM_ETAPA[para]) delete marcos[e]; });
    return salvaDados(x, Object.assign({ etapa: para, marcos: marcos }, extra || {}));
  }
  function depois(msg) { return function () { sujo = false; redesenha(); aviso(msg); }; }
  function botaoDesfazer(x, para, rotulo, extra) {
    return botao(rotulo, "orc__email", function () {
      pergunta(rotulo + "?", "A proposta volta para o passo anterior. Nada mais é apagado.", rotulo).then(function (sim) {
        if (sim) voltaEtapa(x, para, extra).then(depois("Pronto, voltou um passo.")).catch(falha);
      });
    });
  }
  function dataInline(rotulo, input) {
    var l = el("label", "andamento-data");
    l.append(el("span", null, rotulo), input);
    return l;
  }
  // Próximo número de contrato do ano: maior "NN/AAAA" já usado + 1
  function proximoContrato() {
    var ano = String(new Date().getFullYear()), maior = 0;
    (S.propostas || []).forEach(function (p) {
      var m = /^\s*(\d+)\s*\/\s*(\d{4})/.exec(String((((p.dados || {}).contrato) || {}).numero || ""));
      if (m && m[2] === ano) maior = Math.max(maior, Number(m[1]));
    });
    return (maior + 1) + "/" + ano;
  }

  function telaAndamento(x) {
    var d = x.dados || {}, ev = d.evento || {}, mc = d.marcos || {}, ct = d.contrato || {};
    var s = somaItens(d.itens || []), e = etapaDe(x), recusada = e === "recusada";
    // Passo atual: 0 a 4; 5 = tudo feito
    var atual = e === "assinado" ? 5 : (recusada ? 2 : ORDEM_ETAPA[e] + 1);
    var titulo = "Proposta" + (x.numero ? " nº " + x.numero : "");
    corpo.append(trilha("propostas", titulo));
    var c = card(titulo, x.cliente);
    c.append(el("p", "andamento-resumo", [ev.nome || x.evento, ev.data ? quando(ev.data) : "", ev.participantes ? Number(ev.participantes).toLocaleString("pt-BR") + " participantes" : ""].filter(Boolean).join(" · ")));
    var tot = el("p", "andamento-total");
    tot.append(el("strong", null, reais(s.total)), el("span", null, " · " + extenso(s.total)));
    c.append(tot);

    var barra = el("ol", "andamento-barra");
    barra.setAttribute("aria-label", "Andamento");
    PASSOS.forEach(function (n, i) {
      var li = el("li", recusada && i === 2 ? "is-nao" : (i < atual ? "is-feito" : (i === atual ? "is-atual" : "")), n);
      if (i === atual) li.setAttribute("aria-current", "step");
      barra.append(li);
    });
    c.append(barra);
    if (e === "assinado") c.append(el("p", "andamento-fim", "Contrato assinado em " + curta(mc.assinado) + ". Esta proposta está concluída."));
    if (recusada) c.append(el("p", "assess-alerta", "O cliente recusou esta proposta em " + curta(mc.recusada) + "."));

    var passo = function (i, status) {
      var estado = recusada && i === 2 ? "is-nao" : (recusada && i > 2 ? "is-espera" : (i < atual ? "is-feito" : (i === atual ? "is-atual" : "is-espera")));
      var sec = el("section", "andamento-passo " + estado);
      var num = el("span", "andamento-passo__n", estado === "is-feito" ? "✓" : (estado === "is-nao" ? "✕" : String(i + 1)));
      num.setAttribute("aria-hidden", "true");
      var cab = el("div", "andamento-passo__cab");
      cab.append(el("h3", null, (i + 1) + ". " + PASSOS[i]));
      cab.append(el("p", "andamento-passo__st", status || (i === atual ? "Próximo passo" : "")));
      var miolo = el("div", "andamento-passo__corpo");
      sec.append(num, cab, miolo);
      c.append(sec);
      return miolo;
    };

    // 1. Montar a proposta
    var m0 = passo(0, (d.itens || []).length + " itens · " + reais(s.total) + (d.validade ? " · válida até " + curta(d.validade) : ""));
    if (e === "assinado") m0.append(el("p", "muted", "Com o contrato assinado, a proposta fica travada. Para um acréscimo, use \"Duplicar\" e faça uma proposta de aditivo."));
    m0.append(acoes(e !== "assinado" ? botao("Editar itens e valores", "btn btn--line", function () { ir("proposta/" + enc(x.id) + "/editar"); }) : null,
      botao("Ver PDF da proposta", null, function () { imprimeProposta(x); }),
      botao("Duplicar", null, function () { ir("proposta/novo?de=" + enc(x.id)); })));

    // 2. Enviar ao cliente
    var m1 = passo(1, mc.enviada ? "Enviada em " + curta(mc.enviada) : "");
    if (atual === 1) {
      var dEnv = entrada("date", hojeIso());
      m1.append(el("p", null, "Baixe o PDF da proposta e mande ao cliente por e-mail ou WhatsApp. Depois, registre o envio."),
        acoes(botao("Baixar PDF da proposta", "btn btn--line", function () { imprimeProposta(x); }), dataInline("Enviada em", dEnv),
          botao("Registrar envio", "btn btn--red", function () {
            marcaEtapa(x, "enviada", dEnv.value).then(depois("Envio registrado. Agora, aguarde a resposta do cliente.")).catch(falha);
          })));
    } else if (e === "enviada") m1.append(acoes(botaoDesfazer(x, "rascunho", "Desfazer envio")));

    // 3. Resposta do cliente
    var m2 = passo(2, mc.aprovada ? "Aprovada em " + curta(mc.aprovada) : (mc.recusada ? "Recusada em " + curta(mc.recusada) : ""));
    if (e === "enviada") {
      var dResp = entrada("date", hojeIso());
      m2.append(el("p", null, "Quando o cliente responder, registre aqui. Se ele pedir mudanças, edite a proposta no passo 1 e mande de novo."),
        acoes(dataInline("Em", dResp),
          botao("Cliente aprovou", "btn btn--red", function () {
            marcaEtapa(x, "aprovada", dResp.value).then(depois("Aprovação registrada. Próximo passo: gerar o contrato.")).catch(falha);
          }),
          botao("Cliente recusou", "orc__email painel-perigo", function () {
            pergunta("Registrar que o cliente recusou?", "A proposta sai do andamento. Dá para desfazer depois.", "Registrar recusa").then(function (sim) {
              if (sim) marcaEtapa(x, "recusada", dResp.value).then(depois("Recusa registrada.")).catch(falha);
            });
          })));
    } else if (recusada) {
      m2.append(el("p", null, "Para tentar de novo com outra versão, use \"Duplicar\" no passo 1."), acoes(botaoDesfazer(x, "enviada", "Desfazer recusa")));
    } else if (e === "aprovada") m2.append(acoes(botaoDesfazer(x, "enviada", "Desfazer aprovação")));

    // 4. Gerar o contrato
    var m3 = passo(3, mc.contrato ? "Contrato nº " + (ct.numero || "—") + " gerado em " + curta(mc.contrato) : (recusada || atual >= 3 ? "" : "Depois que o cliente aprovar"));
    if (e === "aprovada") formContrato(x, m3);
    else if (e === "contrato") {
      var caixa = el("div");
      m3.append(acoes(botao("Baixar PDF do contrato", "btn btn--line", function () { imprimeContrato(x); }),
        botao("Alterar dados do contrato", null, function () { caixa.innerHTML = ""; formContrato(x, caixa); })), caixa);
    }

    // 5. Assinatura
    var m4 = passo(4, mc.assinado ? "Assinado em " + curta(mc.assinado) : (recusada || atual >= 4 ? "" : "Depois de gerar o contrato"));
    if (e === "contrato") formAssinatura(x, m4);
    else if (e === "assinado") {
      var a = null;
      if (ct.arquivo_assinado) { a = el("a", "btn btn--line", "Baixar o contrato assinado"); a.href = "api/admin/propostas/" + enc(x.id) + "/assinado"; }
      m4.append(acoes(a, /^https:\/\//.test(ct.link_assinado || "") ? linkExt("Abrir o link do contrato assinado ↗", ct.link_assinado) : null,
        botao("Ver o contrato gerado pelo painel", null, function () { imprimeContrato(x); }),
        botao("Desfazer registro da assinatura", "orc__email painel-perigo", function () {
          pergunta("Desfazer o registro da assinatura?", "O PDF assinado guardado no painel será apagado. Cópias salvas no computador ou no Drive continuam existindo.", "Desfazer registro").then(function (sim) {
            if (!sim) return;
            api("DELETE", "propostas/" + encodeURIComponent(x.id) + "/assinado").catch(function () { return null; })
              .then(function () { return voltaEtapa(x, "contrato", { contrato: Object.assign({}, ct, { arquivo_assinado: "", link_assinado: "" }) }); })
              .then(depois("Registro da assinatura desfeito.")).catch(falha);
          });
        })));
    }
    corpo.append(c);
  }

  var PAGAMENTOS = [
    ["50% na assinatura e 50% após o evento", "O CONTRATANTE pagará 50% (cinquenta por cento) do valor global em até 5 (cinco) dias úteis após a assinatura deste contrato e os 50% (cinquenta por cento) restantes em até 5 (cinco) dias úteis após a realização do evento."],
    ["Tudo após o evento", "O CONTRATANTE pagará o valor global em até 5 (cinco) dias úteis após a realização do evento."],
    ["Inscrições e patrocínios", "O valor global será custeado pela arrecadação das inscrições e pelos patrocínios do evento, recebidos pela CONTRATADA. Ao final do evento, a CONTRATADA apresentará o fechamento financeiro emitido pela plataforma de inscrições e o relatório das inscrições feitas fora dela (equipes, grupos, patrocinadores e cortesias), e o CONTRATANTE pagará, em até 5 (cinco) dias úteis, a diferença entre o valor global e o total arrecadado, se houver."],
  ];

  // Passo 4: o que falta para o contrato (o resto vem da proposta)
  function formContrato(x, lugar) {
    var carregando = el("p", "muted", "Carregando os dados da empresa...");
    lugar.append(carregando);
    carregaConfig().then(function (cfg) {
      carregando.remove();
      var empresas = cfg.empresas || [];
      if (!empresas.length) {
        lugar.append(el("p", "assess-alerta", "Antes do primeiro contrato, cadastre os dados da sua empresa: razão social, CNPJ e quem assina. É uma vez só."),
          acoes(botao("Cadastrar os dados da empresa", "btn btn--red", function () { ir("modelo-contrato"); })));
        return;
      }
      var d = x.dados || {}, cl = d.cliente || {}, ct = d.contrato || {}, ctt = ct.contratante || {}, s = somaItens(d.itens || []);
      var escolhida = 0;
      empresas.forEach(function (em, i) { if (ct.empresa && em.cnpj === ct.empresa.cnpj) escolhida = i; });
      var f = el("form", "assess-grid"); f.noValidate = true;
      var numero = entrada("text", ct.numero || proximoContrato(), { maxLength: 30 });
      var emp = escolha(empresas.map(function (em, i) { return [String(i), em.razao + (em.cnpj ? " · CNPJ " + em.cnpj : "")]; }), String(escolhida));
      var nome = entrada("text", ctt.nome || cl.nome || x.cliente, { maxLength: 160 });
      var doc = entrada("text", ctt.cnpj || cl.cnpj, { maxLength: 20 });
      var end = entrada("text", ctt.endereco || cl.endereco, { maxLength: 200, placeholder: "Rua, número, bairro, cidade/UF" });
      var rep = entrada("text", ctt.rep_nome || cl.representante, { maxLength: 160 });
      var cargo = entrada("text", ctt.rep_cargo, { maxLength: 80, placeholder: "Ex.: Presidente, Diretor" });
      var cpf = entrada("text", ctt.rep_cpf, { maxLength: 20 });
      var rg = entrada("text", ctt.rep_rg, { maxLength: 30 });
      var pag = entrada("textarea", ct.pagamento || PAGAMENTOS[0][1], { rows: 4, maxLength: 2000 });
      var vig = entrada("number", ct.vigencia || 12, { min: 1, max: 60, step: 1 });
      var temVar = (d.itens || []).some(function (i) { return i.pp; });
      var anexo2 = marcador("Incluir o Anexo II: valor do evento para outros números de participantes (" + faixasDe(d).map(function (n) { return n.toLocaleString("pt-BR"); }).join(", ") + ")", ct.anexo2);
      var cond = entrada("textarea", ct.condicoes, { rows: 3, maxLength: 4000, placeholder: "Opcional. Uma por linha. Ex.: entrega dos kits na sede do contratante nos 2 dias úteis antes do evento." });
      var modelos = el("div", "painel-acoes-linha assess-grid__full");
      modelos.append(el("span", "muted", "Preencher com:"));
      PAGAMENTOS.forEach(function (p) { modelos.append(botao(p[0], null, function () { pag.value = p[1]; sujo = true; })); });
      var valor = el("p", "andamento-valor assess-grid__full");
      valor.append(el("strong", null, "Valor global: " + reais(s.total)), el("span", null, " (" + extenso(s.total) + "). Vem da proposta; para mudar, edite os itens no passo 1."));
      var gerar = el("button", "btn btn--red btn--lg", "Salvar e gerar o contrato"); gerar.type = "submit";
      [valor,
        campo("Número do contrato", numero), campo("Empresa que assina (contratada)", emp),
        secao("Contratante", "Quem contrata e quem assina por ele."),
        campo("Nome ou razão social", nome), campo("CNPJ ou CPF", doc), campo("Endereço", end, null, true),
        campo("Quem assina pelo contratante", rep), campo("Cargo", cargo), campo("CPF de quem assina", cpf), campo("RG de quem assina (opcional)", rg),
        secao("Pagamento e prazos"), campo("Forma de pagamento", pag, null, true), modelos, campo("Vigência (meses)", vig),
        temVar ? linhaCheia(anexo2) : null, campo("Condições específicas deste contrato (opcional)", cond, null, true),
        linhaCheia(acoes(gerar))].filter(Boolean).forEach(function (n) { f.append(n); });
      lugar.append(f);
      vigia(f);
      f.addEventListener("submit", function (evt) {
        evt.preventDefault();
        var falta = [[numero, "o número do contrato"], [nome, "o nome do contratante"], [doc, "o CNPJ ou CPF do contratante"], [rep, "quem assina pelo contratante"]]
          .filter(function (p) { return !p[0].value.trim(); }).map(function (p) { return p[1]; });
        if (falta.length) return aviso("Falta preencher " + falta.join(", ") + ".", true);
        var novo = {
          numero: numero.value.trim(), empresa: Object.assign({}, empresas[Number(emp.value)] || empresas[0]),
          contratante: { nome: nome.value.trim(), cnpj: doc.value.trim(), endereco: end.value.trim(), rep_nome: rep.value.trim(), rep_cargo: cargo.value.trim(), rep_cpf: cpf.value.trim(), rep_rg: rg.value.trim() },
          pagamento: pag.value.trim(), vigencia: Math.min(Math.max(parseInt(vig.value, 10) || 12, 1), 60),
          anexo2: temVar && anexo2.caixa.checked, condicoes: cond.value.trim(),
          arquivo_assinado: ct.arquivo_assinado || "", link_assinado: ct.link_assinado || "",
        };
        // O cliente da proposta fica igual ao do contrato (a próxima proposta impressa já sai completa)
        var cliente = Object.assign({}, cl, { nome: novo.contratante.nome, cnpj: novo.contratante.cnpj, endereco: novo.contratante.endereco,
          representante: [novo.contratante.rep_nome, novo.contratante.rep_cargo].filter(Boolean).join(", ") });
        var w = window.open("", "_blank"); // abre já, no clique, para o navegador não bloquear a janela
        gerar.disabled = true;
        var q = etapaDe(x) === "aprovada" ? marcaEtapa(x, "contrato", null, { contrato: novo, cliente: cliente }, { cliente: novo.contratante.nome })
          : salvaDados(x, { contrato: novo, cliente: cliente }, { cliente: novo.contratante.nome });
        q.then(function (salva) {
          imprimeContrato(salva, w);
          depois("Contrato nº " + novo.numero + " gerado. Salve em PDF e mande assinar (passo 5).")();
        }).catch(function (err) { gerar.disabled = false; if (w) w.close(); falha(err); });
      });
    }).catch(function (e) {
      carregando.textContent = "Não consegui ler os dados da empresa. Se a tabela ainda não existe no banco: npx wrangler d1 execute tardim --remote --file d1/migracoes/012-contratos.sql";
      carregando.className = "assess-alerta";
      falha(e);
    });
  }

  // Passo 5: como assinar e registro do contrato assinado
  function formAssinatura(x, lugar) {
    var ct = (x.dados || {}).contrato || {};
    var ol = el("ol", "andamento-lista");
    ["Baixe o PDF do contrato e salve no computador.",
      "Mande para assinatura. Sem custo: a Tardim e o cliente assinam o mesmo PDF no gov.br (assinador.iti.br), cada um com a conta gov.br nível prata ou ouro, um depois do outro. Se o cliente usar outro sistema de assinatura, siga o dele.",
      "Com o PDF assinado pelos dois, registre aqui embaixo."].forEach(function (t) { ol.append(el("li", null, t)); });
    lugar.append(ol, acoes(botao("Baixar PDF do contrato", "btn btn--line", function () { imprimeContrato(x); }),
      linkExt("Abrir o assinador do gov.br ↗", "https://assinador.iti.br/")));
    var f = el("form", "assess-grid"); f.noValidate = true;
    var data = entrada("date", hojeIso());
    var arq = entrada("file"); arq.accept = "application/pdf,.pdf";
    var link = entrada("url", ct.link_assinado || "", { maxLength: 500, placeholder: "https://drive.google.com/..." });
    var reg = el("button", "btn btn--red btn--lg", "Registrar contrato assinado"); reg.type = "submit";
    f.append(campo("Data da assinatura (a última)", data), campo("PDF assinado (até 1,9 MB)", arq),
      campo("Ou o link de onde o PDF assinado está guardado", link, "Drive, OneDrive ou o sistema de assinatura. Pode usar os dois.", true), linhaCheia(acoes(reg)));
    lugar.append(f);
    vigia(f);
    f.addEventListener("submit", function (evt) {
      evt.preventDefault();
      var file = arq.files && arq.files[0], url = link.value.trim();
      if (!file && !url) return aviso("Anexe o PDF assinado ou cole o link de onde ele está guardado.", true);
      if (url && !/^https:\/\/\S+$/.test(url)) return aviso("O link precisa começar com https://.", true);
      if (file && !/\.pdf$/i.test(file.name) && file.type !== "application/pdf") return aviso("O arquivo precisa ser um PDF.", true);
      if (file && file.size > 1900000) return aviso("Esse PDF tem mais de 1,9 MB. Guarde no Drive ou no OneDrive e cole o link.", true);
      reg.disabled = true;
      (file ? api("PUT", "propostas/" + encodeURIComponent(x.id) + "/assinado?nome=" + encodeURIComponent(file.name), file, "application/pdf") : Promise.resolve())
        .then(function () {
          return marcaEtapa(x, "assinado", data.value, { contrato: Object.assign({}, ct, { arquivo_assinado: file ? file.name : (ct.arquivo_assinado || ""), link_assinado: url }) });
        })
        .then(depois("Contrato assinado registrado. Proposta concluída."))
        .catch(function (e) { reg.disabled = false; falha(e); });
    });
  }

  // Modelo padrão do contrato. Linhas com CLÁUSULA viram título e são numeradas sozinhas;
  // [SE ANEXO II] e [SE CONDIÇÕES] só entram quando o contrato tem o anexo ou as condições.
  var MODELO_CONTRATO = [
    "CLÁUSULA – DO OBJETO",
    "O presente contrato tem por objeto a prestação, pela CONTRATADA, de serviços de produção, organização e execução do evento {{EVENTO}}, a ser realizado em {{DATA_EVENTO}}, em {{LOCAL}}, para até {{PARTICIPANTES}} participantes, compreendendo o planejamento, a estrutura, os materiais, a mão de obra e o apoio logístico descritos no Anexo I, que faz parte deste contrato.",
    "CLÁUSULA – DO REGIME DE EXECUÇÃO",
    "Os serviços serão executados em regime de empreitada por preço global, conforme as especificações e as quantidades do Anexo I.",
    "CLÁUSULA – DAS OBRIGAÇÕES DA CONTRATADA",
    "São obrigações da CONTRATADA:",
    "a) executar os serviços descritos no Anexo I com qualidade, nos prazos combinados e de acordo com as normas técnicas e de segurança aplicáveis;",
    "b) providenciar as autorizações, licenças e alvarás necessários à realização do evento, quando previstos no Anexo I;",
    "c) manter equipe qualificada e identificada durante a montagem, a realização e a desmontagem do evento, respondendo pelos encargos trabalhistas, previdenciários e fiscais do seu pessoal;",
    "d) informar ao CONTRATANTE, por escrito, qualquer fato que possa comprometer a realização do evento;",
    "e) apresentar, em até 5 (cinco) dias úteis após o evento, relatório com o número de inscritos e de participantes.",
    "CLÁUSULA – DAS OBRIGAÇÕES DO CONTRATANTE",
    "São obrigações do CONTRATANTE:",
    "a) fornecer à CONTRATADA as informações, a marca e os materiais de sua responsabilidade necessários à execução dos serviços;",
    "b) aprovar, em até 5 (cinco) dias úteis, as artes, o regulamento e o percurso apresentados pela CONTRATADA;",
    "c) efetuar os pagamentos nas condições deste contrato;",
    "d) indicar um responsável para acompanhar a execução do contrato.",
    "CLÁUSULA – DO PREÇO",
    "Pelos serviços objeto deste contrato, o CONTRATANTE pagará à CONTRATADA o valor global de {{VALOR}}, já incluídos todos os custos, materiais, mão de obra, transportes, tributos e encargos necessários à execução dos serviços descritos no Anexo I.",
    "[SE ANEXO II] Se o número de participantes for diferente do previsto, o valor global será ajustado conforme a tabela do Anexo II, aplicando-se regra de três simples para as quantidades entre as faixas.",
    "CLÁUSULA – DO PAGAMENTO",
    "{{PAGAMENTO}}",
    "O pagamento será feito mediante nota fiscal emitida pela CONTRATADA, por transferência ou boleto bancário, em conta de titularidade da CONTRATADA. O atraso sujeitará o valor devido a multa de 2% (dois por cento) e juros de 1% (um por cento) ao mês, calculados pro rata die.",
    "CLÁUSULA – DO ADIAMENTO E DO CANCELAMENTO",
    "Se o evento for adiado ou cancelado por caso fortuito ou força maior, como condições climáticas que coloquem os participantes em risco ou determinação de autoridade pública, as partes combinarão nova data, mantidos os valores deste contrato. Não sendo possível nova data, o CONTRATANTE pagará os custos já comprovadamente realizados pela CONTRATADA até o cancelamento.",
    "Se o CONTRATANTE cancelar o evento por iniciativa própria, sem justo motivo, pagará os custos comprovadamente realizados pela CONTRATADA, acrescidos de multa de 10% (dez por cento) do valor global.",
    "CLÁUSULA – DA RESCISÃO",
    "O descumprimento de qualquer cláusula deste contrato permite à parte prejudicada rescindi-lo, mediante notificação por escrito, sem prejuízo da reparação das perdas e danos comprovados. A parte que der causa à rescisão pagará à outra multa de 10% (dez por cento) do valor global, sem prejuízo do pagamento dos serviços já executados.",
    "CLÁUSULA – DA VIGÊNCIA",
    "Este contrato vigora por {{VIGENCIA}}, contados da data de sua assinatura, podendo ser prorrogado por termo aditivo.",
    "CLÁUSULA – DA PROTEÇÃO DE DADOS PESSOAIS",
    "As partes tratarão os dados pessoais dos participantes do evento somente para a execução deste contrato, em conformidade com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais), adotando medidas de segurança para protegê-los e não os compartilhando para outra finalidade.",
    "[SE CONDIÇÕES] CLÁUSULA – DAS CONDIÇÕES ESPECÍFICAS",
    "[SE CONDIÇÕES] {{CONDICOES}}",
    "CLÁUSULA – DAS DISPOSIÇÕES GERAIS",
    "As alterações deste contrato só valerão se feitas por termo aditivo assinado pelas partes. A tolerância de uma parte quanto ao descumprimento de qualquer obrigação não significa renúncia ao direito de exigi-la.",
    "As partes reconhecem a validade da assinatura eletrônica deste contrato, nos termos da Medida Provisória nº 2.200-2/2001 e da Lei nº 14.063/2020.",
    "CLÁUSULA – DO FORO",
    "Fica eleito o foro da comarca de {{FORO}} para resolver as questões oriundas deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja.",
    "E, por estarem de acordo, as partes assinam este contrato eletronicamente.",
  ].join("\n");

  function telaModeloContrato() {
    corpo.append(trilha("propostas", "Empresa e modelo do contrato"));
    var c = card("Contratos", "Empresa e modelo do contrato");
    c.append(el("p", "muted", "Preencha uma vez. Todo contrato usa estes dados e este texto; cada contrato guarda a empresa escolhida no momento em que foi gerado."));
    var carregando = el("p", "muted", "Carregando...");
    c.append(carregando);
    corpo.append(c);
    carregaConfig().then(function (cfg) {
      carregando.remove();
      var f = el("form", "assess-grid"); f.noValidate = true;
      var lista = el("div", "assess-grid__full modelo-empresas"), blocos = [];
      var addEmpresa = function (e) {
        e = e || {};
        var b = el("fieldset", "modelo-empresa");
        var fs = {
          razao: entrada("text", e.razao, { maxLength: 160 }), cnpj: entrada("text", e.cnpj, { maxLength: 20 }),
          endereco: entrada("text", e.endereco, { maxLength: 200, placeholder: "Rua, número, bairro, cidade/UF, CEP" }),
          rep_nome: entrada("text", e.rep_nome, { maxLength: 160 }), rep_cargo: entrada("text", e.rep_cargo, { maxLength: 80, placeholder: "Ex.: Diretor" }),
          rep_cpf: entrada("text", e.rep_cpf, { maxLength: 20 }), rep_rg: entrada("text", e.rep_rg, { maxLength: 30 }),
        };
        var grade = el("div", "assess-grid");
        grade.append(campo("Razão social", fs.razao), campo("CNPJ", fs.cnpj), campo("Endereço", fs.endereco, null, true),
          campo("Quem assina pela empresa", fs.rep_nome), campo("Cargo", fs.rep_cargo), campo("CPF de quem assina", fs.rep_cpf), campo("RG de quem assina", fs.rep_rg));
        var item = { fs: fs };
        b.append(el("legend", null, "Empresa"), grade, acoes(botao("Remover esta empresa", "orc__email painel-perigo", function () {
          blocos.splice(blocos.indexOf(item), 1); b.remove(); sujo = true;
        })));
        lista.append(b);
        blocos.push(item);
      };
      (cfg.empresas && cfg.empresas.length ? cfg.empresas : [{ razao: site.razaoSocial || "", cnpj: site.cnpj || "" }]).forEach(addEmpresa);
      var foro = entrada("text", cfg.foro || "Belo Horizonte/MG", { maxLength: 80 });
      var modelo = entrada("textarea", cfg.modelo || MODELO_CONTRATO, { rows: 24, maxLength: 60000 });
      var ajuda = el("ul", "assess-grid__full modelo-ajuda");
      ["Uma linha por parágrafo. Linhas que começam com CLÁUSULA viram título e são numeradas sozinhas (PRIMEIRA, SEGUNDA...).",
        "O painel preenche: {{CONTRATANTE}}, {{CONTRATADA}}, {{EVENTO}}, {{DATA_EVENTO}}, {{LOCAL}}, {{PARTICIPANTES}}, {{VALOR}} (em algarismos e por extenso), {{PAGAMENTO}}, {{VIGENCIA}}, {{FORO}} e {{CONDICOES}}.",
        "Linhas que começam com [SE ANEXO II] só entram quando o contrato tem o Anexo II; as que começam com [SE CONDIÇÕES], só quando há condições específicas.",
        "A qualificação das partes, as assinaturas e os anexos o painel monta sozinho.",
        "O modelo padrão é um ponto de partida: peça ao advogado da empresa para revisar antes do primeiro uso."].forEach(function (t) { ajuda.append(el("li", null, t)); });
      var salvar = el("button", "btn btn--red btn--lg", "Salvar"); salvar.type = "submit";
      f.append(secao("Sua empresa (contratada)", "Se a Tardim assina por mais de uma empresa, cadastre todas; em cada contrato você escolhe qual."), lista,
        linhaCheia(acoes(botao("Adicionar outra empresa", null, function () { addEmpresa(); sujo = true; }))),
        secao("Texto do contrato"), campo("Cidade do foro", foro), ajuda, campo("Cláusulas", modelo, null, true),
        linhaCheia(acoes(botao("Voltar ao modelo padrão", null, function () {
          pergunta("Voltar ao modelo padrão?", "O texto das cláusulas volta ao original do painel. Só muda depois de Salvar.", "Voltar ao padrão").then(function (sim) {
            if (sim) { modelo.value = MODELO_CONTRATO; sujo = true; }
          });
        }))),
        barraForm(salvar, botao("Cancelar", null, function () { cancelar("propostas"); })));
      c.append(f);
      vigia(f);
      f.addEventListener("submit", function (evt) {
        evt.preventDefault();
        var empresas = blocos.map(function (b) { var o = {}; Object.keys(b.fs).forEach(function (k) { o[k] = b.fs[k].value.trim(); }); return o; })
          .filter(function (o) { return o.razao; });
        if (!empresas.length) return aviso("Cadastre pelo menos uma empresa, com a razão social.", true);
        var texto = modelo.value.replace(/\r/g, "").trim();
        salvar.disabled = true;
        // Texto igual ao padrão não é guardado: assim as melhorias do modelo padrão chegam sozinhas
        api("PUT", "config/contrato", { empresas: empresas, foro: foro.value.trim() || "Belo Horizonte/MG", modelo: texto === MODELO_CONTRATO ? "" : texto }).then(function (cfgNova) {
          S.config = cfgNova;
          voltarPara("propostas");
          aviso("Dados do contrato salvos.");
        }).catch(function (e) { salvar.disabled = false; falha(e); });
      });
    }).catch(function (e) {
      carregando.textContent = "Não consegui ler os dados do contrato. Se a tabela ainda não existe no banco: npx wrangler d1 execute tardim --remote --file d1/migracoes/012-contratos.sql";
      carregando.className = "assess-alerta";
      falha(e);
    });
  }

  // Tabela de itens com subtotais por categoria e total geral (proposta e Anexo I do contrato)
  function htmlItens(s) {
    var h = escHtml, n = 0;
    var corpoTab = s.cats.map(function (c) {
      return '<tr class="cat"><th colspan="5">' + h(c.nome) + "</th></tr>" + c.itens.map(function (i) {
        n++;
        return "<tr><td>" + n + "</td><td>" + h(i.desc) + '</td><td class="n">' + qtdTxt(i.qtd) + '</td><td class="n">' + reais(i.unit) + '</td><td class="n">' + reais(Math.round(i.qtd * i.unit * 100) / 100) + "</td></tr>";
      }).join("") + '<tr class="sub"><td colspan="4">Total de ' + h(c.nome) + '</td><td class="n">' + reais(c.total) + "</td></tr>";
    }).join("");
    return '<table><thead><tr><th>Item</th><th>Descrição</th><th class="n">Qtd.</th><th class="n">Valor unitário</th><th class="n">Valor total</th></tr></thead><tbody>' + corpoTab + "</tbody></table>" +
      '<div class="total"><span>Total geral</span><span>' + reais(s.total) + '</span></div><p class="ext">' + h(extenso(s.total)) + "</p>";
  }
  var CSS_DOC = "body{font:13px/1.45 Arial,Helvetica,sans-serif;color:#1c2233;margin:28px}h1{font-size:19px;margin:0 0 2px;color:#24325a}h2{font-size:14px;margin:18px 0 6px;color:#24325a}" +
    "table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #c9cdd6;padding:5px 7px;vertical-align:top;text-align:left}" +
    "thead th{background:#24325a;color:#fff}.cat th{background:#eef0f5}.sub td{font-weight:bold;background:#fafafa}.n{text-align:right;white-space:nowrap}" +
    ".total{margin-top:12px;padding:10px 12px;border:2px solid #24325a;display:flex;justify-content:space-between;font-size:16px;font-weight:bold}" +
    ".ext{margin:4px 0 0;color:#5b6275}tr{break-inside:avoid}@media print{body{margin:0}.nao{display:none}}";

  function ordinal(n) {
    var U = ["PRIMEIRA", "SEGUNDA", "TERCEIRA", "QUARTA", "QUINTA", "SEXTA", "SÉTIMA", "OITAVA", "NONA"];
    if (n < 10) return U[n - 1];
    var dez = Math.floor(n / 10), un = n % 10, D = ["", "DÉCIMA", "VIGÉSIMA", "TRIGÉSIMA"][dez] || String(n);
    return un ? D + " " + U[un - 1] : D;
  }
  function htmlContrato(x, cfg) {
    var d = x.dados || {}, ev = d.evento || {}, ct = d.contrato || {}, ctt = ct.contratante || {}, emp = ct.empresa || {};
    var s = somaItens(d.itens || []), h = escHtml;
    var foro = cfg.foro || "Belo Horizonte/MG", cidade = foro.split(/[\/,]/)[0].trim();
    var meses = Number(ct.vigencia) || 12;
    var docTipo = function (doc) { return String(doc || "").replace(/\D/g, "").length === 11 ? "CPF" : "CNPJ"; };
    var parte = function (nome, doc, endereco, rep, cargo, cpf, rg, papel, fem) {
      var t = "<b>" + h(String(nome || "").toUpperCase()) + "</b>";
      if (doc) t += ", inscrit" + (fem ? "a" : "o") + " no " + docTipo(doc) + " sob o nº " + h(doc);
      if (endereco) t += ", com sede em " + h(endereco);
      if (rep) {
        t += ", neste ato representad" + (fem ? "a" : "o") + " por " + h(rep) + (cargo ? ", " + h(cargo) : "");
        if (rg) t += ", portador(a) da carteira de identidade nº " + h(rg);
        if (cpf) t += (rg ? " e" : ",") + " inscrito(a) no CPF sob o nº " + h(cpf);
      }
      return t + ", doravante denominad" + (fem ? "a" : "o") + " <b>" + papel + "</b>";
    };
    var campos = {
      CONTRATANTE: ctt.nome, CONTRATADA: emp.razao, EVENTO: ev.nome || x.evento || "", NUMERO: ct.numero,
      DATA_EVENTO: ev.data ? quando(ev.data) : "data a definir", LOCAL: ev.local || "local a definir",
      PARTICIPANTES: ev.participantes ? Number(ev.participantes).toLocaleString("pt-BR") : "—",
      VALOR: reais(s.total) + " (" + extenso(s.total) + ")", PAGAMENTO: ct.pagamento || "", FORO: foro,
      VIGENCIA: meses + " (" + extenso(meses).replace(/ rea(l|is)$/, "") + ") " + (meses === 1 ? "mês" : "meses"), CONDICOES: ct.condicoes || "",
    };
    var n = 0;
    var clausulas = String((cfg.modelo && cfg.modelo.trim()) ? cfg.modelo : MODELO_CONTRATO).split(/\r?\n/).map(function (l) {
      l = l.trim();
      if (/^\[SE ANEXO II\]/i.test(l)) { if (!ct.anexo2) return ""; l = l.replace(/^\[SE ANEXO II\]\s*/i, ""); }
      if (/^\[SE CONDI[CÇ][OÕ]ES\]/i.test(l)) { if (!ct.condicoes) return ""; l = l.replace(/^\[SE CONDI[CÇ][OÕ]ES\]\s*/i, ""); }
      if (!l) return "";
      if (/^CL[AÁ]USULA\b/i.test(l)) {
        n++;
        var resto = l.replace(/^CL[AÁ]USULA\s*/i, "").replace(/^(–|-|—)\s*/, "");
        return "<h3>CLÁUSULA " + ordinal(n) + (resto ? " – " + h(resto) : "") + "</h3>";
      }
      var texto = l.replace(/\{\{\s*([A-Z_]+)\s*\}\}/g, function (m, k) { return k in campos ? campos[k] : m; });
      return texto.split(/\r?\n/).filter(function (t) { return t.trim(); }).map(function (t) {
        return "<p" + (/^[a-z]\)\s/.test(t.trim()) ? ' class="al"' : "") + ">" + h(t.trim()) + "</p>";
      }).join("");
    }).join("");
    var assina = function (nome, rep, cargo, papel) {
      return '<div><span class="linha"></span><b>' + h(String(nome || "").toUpperCase()) + "</b><br>" + h(rep || "") + (cargo ? "<br>" + h(cargo) : "") + "<br><small>" + papel + "</small></div>";
    };
    var fecho = '<p class="local">' + h(cidade) + ", data da última assinatura eletrônica.</p>" +
      '<div class="assinaturas">' + assina(ctt.nome, ctt.rep_nome, ctt.rep_cargo, "CONTRATANTE") + assina(emp.razao, emp.rep_nome, emp.rep_cargo, "CONTRATADA") + "</div>";
    var ref = "<p class=\"ref\">Contrato nº " + h(ct.numero) + " · " + h(campos.EVENTO) + " · " + h(campos.PARTICIPANTES) + " participantes</p>";
    var anexo2 = "";
    if (ct.anexo2) {
      var base = Number(ev.participantes) || 0;
      anexo2 = '<section class="anexo"><h2>ANEXO II – VALOR DO EVENTO POR NÚMERO DE PARTICIPANTES</h2>' + ref +
        '<table><thead><tr><th>Participantes</th><th class="n">Valor do evento</th></tr></thead><tbody>' +
        faixasDe(d).map(function (k) { return "<tr><td>" + k.toLocaleString("pt-BR") + (k === base ? " (previsto neste contrato)" : "") + '</td><td class="n">' + reais(valorParaParticipantes(d.itens || [], base, k)) + "</td></tr>"; }).join("") +
        "</tbody></table><p>Para quantidades entre as faixas, aplica-se regra de três simples entre os valores das faixas vizinhas.</p>" + fecho + "</section>";
    }
    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Contrato ' + h(ct.numero) + " · " + h(ctt.nome) + "</title><style>" + CSS_DOC +
      "h1{text-align:center;font-size:17px;margin:0 0 8px}.ementa{margin:0 0 18px 40%;text-align:justify;font-size:12px;color:#3b4256}" +
      "p{text-align:justify;margin:0 0 8px}.al{padding-left:22px}h3{font-size:13px;margin:16px 0 6px;color:#24325a}.ref{color:#5b6275;text-align:left}" +
      ".local{margin-top:28px}.assinaturas{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:56px;text-align:center;break-inside:avoid}" +
      ".assinaturas .linha{display:block;border-top:1px solid #1c2233;margin-bottom:6px}.anexo{break-before:page;page-break-before:always;padding-top:4px}" +
      "@media screen{body{max-width:860px;margin:28px auto}}" +
      "</style></head><body>" +
      '<p class="nao"><button class="imprimir">Imprimir ou salvar em PDF</button></p>' +
      "<h1>CONTRATO DE PRESTAÇÃO DE SERVIÇOS Nº " + h(ct.numero) + "</h1>" +
      '<p class="ementa">Contrato que entre si celebram ' + h(ctt.nome) + " e " + h(emp.razao) + ", para a produção, a organização e a execução do evento " + h(campos.EVENTO) + ".</p>" +
      "<p>" + parte(ctt.nome, ctt.cnpj, ctt.endereco, ctt.rep_nome, ctt.rep_cargo, ctt.rep_cpf, ctt.rep_rg, "CONTRATANTE", false) + ", e " +
      parte(emp.razao, emp.cnpj, emp.endereco, emp.rep_nome, emp.rep_cargo, emp.rep_cpf, emp.rep_rg, "CONTRATADA", true) +
      ", resolvem celebrar o presente contrato de prestação de serviços, que se regerá pelas cláusulas e condições seguintes:</p>" +
      clausulas + fecho +
      '<section class="anexo"><h2>ANEXO I – PLANILHA DE ITENS E VALORES</h2>' + ref + htmlItens(s) + fecho + "</section>" + anexo2 +
      "</body></html>";
  }
  // Abre o contrato numa janela para imprimir ou salvar em PDF. "w" = janela já aberta no clique (evita o bloqueio do navegador)
  // Botão "Imprimir" das janelas de contrato e proposta: listener em vez de onclick (o CSP do site bloqueia
  // código inline, e a janela aberta daqui herda o CSP)
  function botaoImprimir(w) {
    var b = w.document.querySelector(".imprimir");
    if (b) b.addEventListener("click", function () { w.print(); });
  }

  function imprimeContrato(x, w) {
    w = w || window.open("", "_blank");
    if (!w) return aviso("O navegador bloqueou a janela do contrato. Libere as janelas deste site e tente de novo.", true);
    w.document.write('<p style="font:16px Arial,sans-serif;margin:32px">Gerando o contrato...</p>');
    w.document.close();
    carregaConfig().then(function (cfg) {
      w.document.open();
      w.document.write(htmlContrato(x, cfg));
      w.document.close();
      botaoImprimir(w);
    }).catch(function (e) { w.close(); falha(e); });
  }

  function imprimeProposta(x) {
    var d = x.dados || {}, cl = d.cliente || {}, ev = d.evento || {}, s = somaItens(d.itens || []);
    var h = escHtml;
    var dl = function (pares) { return pares.filter(function (p) { return p[1]; }).map(function (p) { return "<dt>" + p[0] + "</dt><dd>" + h(p[1]) + "</dd>"; }).join(""); };
    var html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Proposta ' + h(x.numero) + " · " + h(x.cliente) + "</title><style>" + CSS_DOC +
      ".top{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #d6505b;padding-bottom:10px}.top p{margin:0;color:#5b6275}" +
      "dl{display:grid;grid-template-columns:150px 1fr;gap:2px 12px;margin:0}dt{font-weight:bold}dd{margin:0}" +
      ".ass{margin-top:56px;width:300px;border-top:1px solid #1c2233;padding-top:4px}</style></head><body>" +
      '<p class="nao"><button class="imprimir">Imprimir ou salvar em PDF</button></p>' +
      '<div class="top"><div><h1>' + h(site.razaoSocial || "Tardim Produções") + "</h1><p>" + h([site.cnpj ? "CNPJ " + site.cnpj : "", d.emitente].filter(Boolean).join(" · ")) + "</p></div>" +
      "<div><h1>Proposta comercial" + (x.numero ? " nº " + h(x.numero) : "") + "</h1><p>" + h([d.data ? "Emitida em " + curta(d.data) : "", d.validade ? "válida até " + curta(d.validade) : ""].filter(Boolean).join(" · ")) + "</p></div></div>" +
      "<h2>Cliente</h2><dl>" + dl([["Nome", cl.nome], ["CNPJ/CPF", cl.cnpj], ["Endereço", cl.endereco], ["Representante", cl.representante]]) + "</dl>" +
      "<h2>Evento</h2><dl>" + dl([["Evento", ev.nome], ["Data", ev.data ? quando(ev.data) : ""], ["Local", ev.local], ["Participantes", ev.participantes ? Number(ev.participantes).toLocaleString("pt-BR") : ""]]) + "</dl>" +
      htmlItens(s) +
      (d.obs ? "<h2>Observações</h2><ol>" + linhas(d.obs).map(function (o) { return "<li>" + h(o) + "</li>"; }).join("") + "</ol>" : "") +
      '<p style="margin-top:24px">' + h((site.cidade || "Belo Horizonte, MG").split(",")[0]) + (d.data ? ", " + quando(d.data) : "") + '.</p><div class="ass">' + h(site.razaoSocial || "Tardim Produções") + "</div></body></html>";
    var w = window.open("", "_blank");
    if (!w) return aviso("O navegador bloqueou a janela da proposta. Libere as janelas deste site e tente de novo.", true);
    w.document.write(html);
    w.document.close();
    botaoImprimir(w);
  }

  // =====================================================================
  //  MEDIÇÃO (totais do site: js/ui.js -> functions/api/evento.js)
  // =====================================================================
  var diasMedicao = "30";
  function abaMedicao() {
    var c = card("Resultados do site", "Medição");
    c.append(el("p", "muted", "Quantas vezes cada página foi aberta e quantos toques os botões receberam. São só totais por dia, sem identificar ninguém. \"Visitas\" conta as páginas das provas e a página Para empresas; os cliques feitos no calendário da página inicial entram na linha da prova."));
    var periodo = escolha([["7", "Últimos 7 dias"], ["30", "Últimos 30 dias"], ["90", "Últimos 90 dias"], ["365", "Último ano"]], diasMedicao);
    var filtros = el("div", "painel-filtros");
    filtros.append(campo("Período", periodo));
    var area = el("div");
    c.append(filtros, area);
    corpo.append(c);
    function busca() {
      diasMedicao = periodo.value;
      area.innerHTML = "";
      area.append(el("p", "muted", "Carregando..."));
      api("GET", "medicao?dias=" + diasMedicao).then(function (linhasM) {
        area.innerHTML = "";
        if (!linhasM.length) { area.append(el("p", "muted", "Nada medido neste período ainda.")); return; }
        var porRef = {};
        linhasM.forEach(function (l) { (porRef[l.ref] = porRef[l.ref] || {})[l.evento] = Number(l.n) || 0; });
        var refs = Object.keys(porRef).sort(function (a, b) {
          return (porRef[b].visita || 0) + (porRef[b].inscricao || 0) - (porRef[a].visita || 0) - (porRef[a].inscricao || 0);
        });
        var num = function (n) { return n ? Number(n).toLocaleString("pt-BR") : "—"; };
        area.append(tabela(["Página", "Visitas", "Cliques em inscrição", "Taxa", "WhatsApp", "Orçamentos enviados", "Agenda", "Compartilhar"], refs.map(function (r) {
          var m = porRef[r], pv = provaPorId(r);
          var taxa = m.visita && m.inscricao ? (Math.min(m.inscricao / m.visita, 1) * 100).toFixed(1).replace(".", ",") + "%" : "—";
          return [el("strong", null, pv ? pv.nome : r), num(m.visita), num(m.inscricao), taxa, num(m.whatsapp), num(m.orcamento), num(m.agenda), num(m.compartilhar)];
        })));
      }).catch(function (e) {
        area.innerHTML = "";
        area.append(el("p", "assess-alerta", "Não consegui ler a medição. Se a tabela ainda não existe no banco: npx wrangler d1 execute tardim --remote --file d1/migracoes/009-medicao-faq.sql"));
        falha(e);
      });
    }
    periodo.addEventListener("change", busca);
    busca();
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
