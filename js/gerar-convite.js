/*
 * Área interna: a Tardim Produções gera o link de inscrição coletiva
 * para cada assessoria (prova, equipe, prazo e limite de atletas).
 */
(function () {
  "use strict";
  var app = document.getElementById("convite-app");
  if (!app || !window.CONVITE) return;

  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
    "agosto", "setembro", "outubro", "novembro", "dezembro"];
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function data(str) { var p = str.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function hoje() { var h = new Date(); h.setHours(0, 0, 0, 0); return h; }
  function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function quando(str) { var d = data(str); return d.getDate() + " de " + MESES[d.getMonth()] + " de " + d.getFullYear(); }

  var provas = (typeof PROXIMAS !== "undefined" ? PROXIMAS : [])
    .filter(function (p) { return p.id && p.data && data(p.data) >= hoje(); })
    .sort(function (a, b) { return a.data.localeCompare(b.data); });

  var card = el("section", "assess-card");
  if (!provas.length) {
    card.append(el("h2", null, "Nenhuma prova com data futura"), el("p", "muted", "Cadastre a prova em PROXIMAS (js/eventos.js) para gerar links."));
    app.append(card);
    return;
  }
  card.append(el("p", "assess-card__step", "Novo link"), el("h2", null, "Dados do convite"));
  var form = el("form", "assess-grid");
  form.noValidate = true;
  function campo(rotulo, input, dica, cheio) {
    var l = el("label", "orc__field" + (cheio ? " assess-grid__full" : ""));
    l.append(el("span", null, rotulo), input);
    if (dica) l.append(el("small", "assess-dica", dica));
    return l;
  }
  var sel = el("select");
  provas.forEach(function (p, i) { var o = el("option", null, p.nome + " · " + quando(p.data)); o.value = String(i); sel.append(o); });
  var equipe = el("input"); equipe.placeholder = "Ex.: Equipe Pé na Estrada"; equipe.maxLength = 60; equipe.required = true;
  var prazo = el("input"); prazo.type = "date";
  var limite = el("input"); limite.type = "number"; limite.min = 1; limite.placeholder = "Sem limite"; limite.inputMode = "numeric";
  var zap = el("input"); zap.type = "tel"; zap.placeholder = "(31) 90000-0000";
  form.append(
    campo("Prova", sel, null, true),
    campo("Nome da assessoria ou equipe", equipe, null, true),
    campo("Prazo para enviar (opcional)", prazo, "Depois dessa data o link para de funcionar."),
    campo("Limite de atletas (opcional)", limite),
    campo("WhatsApp do treinador (opcional)", zap, "Para mandar o link direto para ele.", true)
  );
  // ---------- Personalização (tudo opcional) ----------
  function titulo(txt, dica) {
    var d = el("div", "assess-grid__full convite-sec");
    d.append(el("h3", null, txt));
    if (dica) d.append(el("p", "muted", dica));
    return d;
  }
  function numero(ph, passo) { var i = el("input"); i.type = "number"; i.min = 0; i.step = passo || 1; i.placeholder = ph; i.inputMode = "decimal"; return i; }
  var treinador = el("input"); treinador.placeholder = "Ex.: Carla Souza"; treinador.maxLength = 40;
  var prazoAtl = el("input"); prazoAtl.type = "date";
  var usaCor = el("input"); usaCor.type = "checkbox";
  var cor = el("input"); cor.type = "color"; cor.value = "#c2414c"; cor.className = "convite-cor";
  cor.addEventListener("input", function () { usaCor.checked = true; });
  var corBox = el("div", "convite-corbox");
  var corLab = el("label", "assess-toggle"); corLab.append(usaCor, " Usar a cor da equipe");
  corBox.append(cor, corLab);
  var corCampo = el("div", "orc__field"); corCampo.append(el("span", null, "Cor da equipe"), corBox);
  var logo = el("input"); logo.placeholder = "Ex.: pe-na-estrada.png"; logo.maxLength = 60;
  var valor = numero("Ex.: 89,90", 0.01);
  var cortesias = numero("Ex.: 1");
  var pagamento = el("input"); pagamento.placeholder = "Ex.: Pix único até 5 dias antes da prova"; pagamento.maxLength = 80;
  var fx = [0, 1, 2].map(function () { return [numero("Atletas"), numero("% desc.", 0.5)]; });
  var fxBox = el("div", "convite-faixas");
  fx.forEach(function (p, i) {
    var linha = el("div", "convite-faixa");
    p[0].setAttribute("aria-label", "Faixa " + (i + 1) + ": a partir de quantos atletas");
    p[1].setAttribute("aria-label", "Faixa " + (i + 1) + ": desconto em %");
    linha.append(el("span", null, "A partir de"), p[0], el("span", null, "atletas:"), p[1], el("span", null, "%"));
    fxBox.append(linha);
  });
  var fxCampo = el("div", "orc__field assess-grid__full"); fxCampo.append(el("span", null, "Desconto por volume (até 3 faixas)"), fxBox);
  var BENEF = [["t", "Espaço para tenda"], ["k", "Retirada de kits em lote"], ["f", "Foto oficial da equipe"], ["e", "Ponto de encontro"]];
  var benBox = el("div", "convite-benef");
  var benChecks = BENEF.map(function (b) {
    var c = el("input"); c.type = "checkbox"; c.value = b[0];
    var l = el("label", "assess-toggle"); l.append(c, " " + b[1]);
    benBox.append(l);
    return c;
  });
  var benCampo = el("div", "orc__field assess-grid__full"); benCampo.append(el("span", null, "Benefícios no dia da prova"), benBox);
  var kitTxt = el("input"); kitTxt.placeholder = "Ex.: sábado, 9h às 10h, na loja X"; kitTxt.maxLength = 90;
  var encontro = el("input"); encontro.placeholder = "Ex.: ao lado do pórtico, às 6h30"; encontro.maxLength = 90;
  form.append(
    titulo("Personalização", "Tudo aqui é opcional. O que ficar em branco não aparece para a assessoria."),
    campo("Nome do treinador", treinador, "A página cumprimenta pelo primeiro nome."),
    campo("Prazo interno dos atletas", prazoAtl, "Aparece na página da equipe. Em branco, usa o prazo do convite."),
    corCampo,
    campo("Arquivo da logo", logo, "Coloque a imagem em assets/assessorias/ e escreva aqui só o nome do arquivo."),
    titulo("Condição comercial", "A assessoria vê o combinado e o total estimado. Confira sempre o valor ao receber a planilha: o link não é uma proteção forte."),
    campo("Valor por atleta (R$)", valor),
    campo("Cortesias (inscrições grátis)", cortesias),
    fxCampo,
    campo("Forma de pagamento", pagamento, null, true),
    titulo("Dia da prova"),
    benCampo,
    campo("Retirada de kits (dia, horário, local)", kitTxt),
    campo("Ponto de encontro", encontro)
  );

  var gerar = el("button", "btn btn--red btn--lg assess-grid__full", "Gerar link");
  gerar.type = "submit";
  form.append(gerar);
  var erro = el("p", "orc__erro");
  erro.hidden = true;
  card.append(form, erro);
  app.append(card);

  function ajustaPrazo() {
    var ev = provas[Number(sel.value)];
    prazo.min = ymd(hoje());
    prazo.max = ev.data;
    if (prazo.value && prazo.value > ev.data) prazo.value = "";
  }
  sel.addEventListener("change", ajustaPrazo);
  ajustaPrazo();

  // ---------- Cadastro de assessorias (banco do site, Cloudflare D1) ----------
  // A assessoria é cadastrada antes, no painel (admin.html > Parceiros), com logo e cor.
  // Aqui ela só é escolhida: nome, treinador, WhatsApp, cor e logo vêm do cadastro,
  // lido de /api/admin/dados com a sessão do painel. Sem o banco (ex.: abrindo o site
  // direto do computador), a página segue funcionando só com o link.
  var banco = { on: false, lista: [], atual: null };
  var bancoBox = el("div", "assess-grid__full convite-banco");
  form.prepend(bancoBox);

  var campoLogoArq = logo.closest("label");
  var prevLogo = el("img", "convite-logo-prev"); prevLogo.alt = "Logo da assessoria";
  var semLogo = el("span", "muted", "Sem logo no cadastro.");
  var logoLinha = el("div", "convite-logo"); logoLinha.append(prevLogo, semLogo);
  var campoLogoCad = el("div", "orc__field");
  campoLogoCad.append(el("span", null, "Logo da assessoria"), logoLinha,
    el("small", "assess-dica", "A logo e a cor vêm do cadastro. Para trocar, edite a assessoria no painel."));
  campoLogoCad.hidden = true;
  campoLogoArq.after(campoLogoCad);
  function mostraLogo(src) {
    prevLogo.hidden = !src; semLogo.hidden = !!src;
    if (src) prevLogo.src = src; else prevLogo.removeAttribute("src");
  }
  mostraLogo("");

  function linkPainel(texto) { var a = el("a", null, texto); a.href = "admin.html"; a.target = "_blank"; a.rel = "noopener"; return a; }
  function botaoTexto(texto, fn) { var b = el("button", "convite-link-btn", texto); b.type = "button"; b.addEventListener("click", fn); return b; }
  function ligaBanco(sim) {
    banco.on = sim;
    campoLogoArq.hidden = sim; campoLogoCad.hidden = !sim;
    equipe.readOnly = sim; usaCor.disabled = sim; cor.disabled = sim;
    if (!sim) { banco.lista = []; banco.atual = null; }
  }

  var selCad = el("select");
  function carregaCadastro() {
    bancoBox.innerHTML = "";
    bancoBox.append(el("p", "muted", "Carregando o cadastro de assessorias..."));
    return fetch("/api/admin/dados", { credentials: "same-origin", headers: { accept: "application/json" }, cache: "no-store" }).then(function (r) {
      if (r.status === 401 || r.status === 403) { pintaEntrar(); return null; }
      if (!r.ok || !/json/i.test(r.headers.get("content-type") || "")) throw new Error("sem banco");
      return r.json();
    }).then(function (d) {
      if (!d) return;
      ligaBanco(true);
      banco.lista = (d.parceiros || []).filter(function (p) { return (p.tipo === "assessoria" || p.tipo === "equipe") && p.ativo !== false && p.ativo !== 0; })
        .sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome)); });
      pintaCadastro();
    }).catch(function () {
      ligaBanco(false);
      bancoBox.innerHTML = "";
      var p = el("p", "muted");
      p.append("O cadastro de assessorias (com logo e cor) fica no painel de administração e aparece aqui quando a página é aberta no site publicado. Agora o banco não respondeu: o link é gerado normalmente e a logo vai como arquivo em assets/assessorias/. ", botaoTexto("Tentar de novo", carregaCadastro), ".");
      bancoBox.append(p);
    });
  }
  function pintaEntrar() {
    ligaBanco(false);
    bancoBox.innerHTML = "";
    var p = el("p", "muted");
    p.append("Para escolher a assessoria do cadastro, com a logo e a cor dela, ", linkPainel("entre no painel"), " e depois ", botaoTexto("atualize a lista", carregaCadastro), ".");
    bancoBox.append(el("h3", null, "Cadastro de assessorias"), p);
  }
  function pintaCadastro() {
    var antes = banco.atual ? banco.atual.id : "";
    bancoBox.innerHTML = "";
    selCad.innerHTML = "";
    var vazio = el("option", null, banco.lista.length ? "Selecione a assessoria" : "Nenhuma assessoria cadastrada"); vazio.value = ""; selCad.append(vazio);
    banco.lista.forEach(function (p) { var o = el("option", null, p.nome + (p.tipo === "equipe" ? " (equipe)" : "")); o.value = String(p.id); selCad.append(o); });
    selCad.value = banco.lista.some(function (p) { return String(p.id) === String(antes); }) ? String(antes) : "";
    var dica = el("small", "assess-dica");
    dica.append("A assessoria precisa estar cadastrada antes. Não está na lista? ", linkPainel("Cadastre no painel"), " (aba Parceiros, tipo Assessoria) e depois ", botaoTexto("atualize a lista", carregaCadastro), ".");
    var l = el("label", "orc__field assess-grid__full");
    l.append(el("span", null, "Assessoria"), selCad, dica);
    bancoBox.append(el("h3", null, "Cadastro de assessorias"), l);
    aplica();
  }
  function aplica() {
    var p = banco.lista.filter(function (x) { return String(x.id) === selCad.value; })[0] || null;
    banco.atual = p;
    equipe.value = p ? p.nome || "" : "";
    treinador.value = p ? p.responsavel || "" : "";
    zap.value = p ? p.whatsapp || "" : "";
    usaCor.checked = !!p && /^[0-9a-f]{6}$/i.test(String(p.cor || "").replace(/^#/, ""));
    if (usaCor.checked) cor.value = "#" + String(p.cor).replace(/^#/, "").toLowerCase();
    mostraLogo(p ? CONVITE.logoUrl(p.logo) : "");
  }
  selCad.addEventListener("change", aplica);
  carregaCadastro();

  var res = el("section", "assess-card");
  res.hidden = true;
  app.append(res);

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var nome = equipe.value.replace(/\s+/g, " ").trim();
    if (!nome) {
      erro.textContent = banco.on ? "Escolha a assessoria no cadastro. Se ela ainda não existe, cadastre antes no painel." : "Informe o nome da assessoria ou equipe.";
      erro.hidden = false; (banco.on ? selCad : equipe).focus(); return;
    }
    erro.hidden = true;
    var ev = provas[Number(sel.value)];
    var arqLogo = banco.on ? "" : logo.value.trim();
    if (arqLogo && !/^[\w-][\w.-]*\.(png|jpe?g|webp)$/i.test(arqLogo)) {
      erro.textContent = "Logo: escreva só o nome do arquivo, sem espaços nem acentos, terminando em .png, .jpg ou .webp.";
      erro.hidden = false; logo.focus(); return;
    }
    var faixas = fx.map(function (p) { return [Math.floor(Number(p[0].value)), Number(p[1].value)]; })
      .filter(function (f) { return f[0] > 0 && f[1] > 0 && f[1] <= 100; })
      .sort(function (a, b) { return a[0] - b[0]; });
    var numTreinador = zap.value.replace(/\D/g, "");
    if (numTreinador && numTreinador.length <= 11) numTreinador = "55" + numTreinador;
    var dados = {
      p: ev.id, e: nome, d: prazo.value, m: limite.value,
      t: treinador.value.replace(/\s+/g, " ").trim(),
      w: numTreinador,
      c: usaCor.checked ? cor.value.replace("#", "") : "",
      l: arqLogo,
      v: Number(valor.value) > 0 ? Math.round(Number(valor.value) * 100) / 100 : 0,
      f: faixas,
      k: Math.floor(Number(cortesias.value)) > 0 ? Math.floor(Number(cortesias.value)) : 0,
      g: pagamento.value.trim(),
      b: benChecks.filter(function (c) { return c.checked; }).map(function (c) { return c.value; }).join(""),
      kt: kitTxt.value.trim(),
      pe: encontro.value.trim(),
      i: prazoAtl.value,
    };
    if (banco.on) {
      if (!banco.atual) { erro.textContent = "Escolha a assessoria no cadastro. Se ela ainda não existe, cadastre antes no painel."; erro.hidden = false; selCad.focus(); return; }
      dados.l = banco.atual.logo || "";
      dados.c = usaCor.checked ? cor.value.replace("#", "") : "";
      dados.a = banco.atual.id;
    }
    pronto();

    function pronto() {
    var codigo = CONVITE.gera(dados);
    var base = location.href.split("#")[0].split("?")[0].replace(/[^\/]*$/, "");
    var link = base + "assessorias.html?c=" + codigo;
    var linkAtletas = base + "equipe.html?c=" + CONVITE.publico(dados);
    var msg = "Olá! Segue o link da inscrição coletiva da " + nome + " para a " + ev.nome + " (" + quando(ev.data) + "):\n\n" + link +
      "\n\nÉ só baixar o modelo, preencher com os atletas e enviar o arquivo pela página. O site confere tudo antes do envio." +
      (prazo.value ? "\n\nPrazo: até " + quando(prazo.value) + "." : "") +
      (limite.value ? "\nLimite: " + limite.value + " atletas." : "") + "\n\nTardim Produções";

    res.innerHTML = "";
    res.hidden = false;
    res.append(el("p", "assess-card__step", "Link pronto"), el("h2", null, nome));
    res.append(el("p", "muted", ev.nome + " · " + quando(ev.data) + (prazo.value ? " · até " + quando(prazo.value) : "") + (limite.value ? " · até " + limite.value + " atletas" : "")));
    var caixa = el("div", "convite-link");
    var campoLink = el("input");
    campoLink.readOnly = true;
    campoLink.value = link;
    campoLink.setAttribute("aria-label", "Link da assessoria");
    campoLink.addEventListener("focus", function () { campoLink.select(); });
    caixa.append(campoLink);
    res.append(caixa);
    var acoes = el("div", "assess-acoes");
    var copiar = el("button", "btn btn--red", "Copiar link");
    copiar.type = "button";
    copiar.addEventListener("click", function () {
      var feito = function () { copiar.textContent = "Link copiado!"; setTimeout(function () { copiar.textContent = "Copiar link"; }, 2000); };
      if (navigator.clipboard) navigator.clipboard.writeText(link).then(feito, function () { campoLink.select(); document.execCommand("copy"); feito(); });
      else { campoLink.select(); document.execCommand("copy"); feito(); }
    });
    var numero = zap.value.replace(/\D/g, "");
    if (numero && numero.length <= 11) numero = "55" + numero;
    var wa = el("a", "btn btn--wa", numero ? "Enviar para o treinador" : "Enviar no WhatsApp");
    wa.href = "https://wa.me/" + (numero || "") + "?text=" + encodeURIComponent(msg);
    wa.target = "_blank"; wa.rel = "noopener";
    var testar = el("a", "orc__email", "Abrir a página como a assessoria vê");
    testar.href = link; testar.target = "_blank"; testar.rel = "noopener";
    acoes.append(copiar, wa, testar);
    res.append(acoes);
    var pub = el("p", "muted assess-nota");
    var aPub = el("a", null, "Ver a página pública da equipe");
    aPub.href = linkAtletas; aPub.target = "_blank"; aPub.rel = "noopener";
    pub.append("O treinador recebe, dentro da página dele, o link para mandar aos atletas. ", aPub, ".");
    res.append(pub);
    if (link.length > 1800) res.append(el("p", "assess-alerta", "O link ficou longo (" + link.length + " caracteres). Se o WhatsApp cortar, encurte os textos de kit, ponto de encontro e pagamento."));
    res.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  var nota = el("p", "muted assess-nota", "Guarde o endereço desta página só para a Tardim Produções. Cada link vale para uma assessoria e uma prova. Para cancelar um link antes do prazo, será preciso o painel de administração (próxima etapa).");
  app.append(nota);
})();
