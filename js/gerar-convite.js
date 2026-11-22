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

  var res = el("section", "assess-card");
  res.hidden = true;
  app.append(res);

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var nome = equipe.value.replace(/\s+/g, " ").trim();
    if (!nome) { erro.textContent = "Informe o nome da assessoria ou equipe."; erro.hidden = false; equipe.focus(); return; }
    erro.hidden = true;
    var ev = provas[Number(sel.value)];
    var codigo = CONVITE.gera({ p: ev.id, e: nome, d: prazo.value, m: limite.value });
    var base = location.href.split("#")[0].split("?")[0].replace(/[^\/]*$/, "");
    var link = base + "assessorias.html?c=" + codigo;
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
    res.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  var nota = el("p", "muted assess-nota", "Guarde o endereço desta página só para a Tardim Produções. Cada link vale para uma assessoria e uma prova. Para cancelar um link antes do prazo, será preciso o painel de administração (próxima etapa).");
  app.append(nota);
})();
