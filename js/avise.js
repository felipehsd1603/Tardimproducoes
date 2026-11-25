/*
 * "Inscrições em breve · Me avise": para provas ainda sem link de inscrição.
 * A pessoa deixa nome e e-mail (functions/api/aviso.js) e recebe o link por
 * e-mail quando a Tardim publicar a inscrição (botão no painel).
 * Uso: AVISE.bloco(ev, "btn btn--sm") devolve o elemento pronto.
 */
var AVISE = (function () {
  "use strict";
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function form(ev, ok) {
    var f = el("form", "avise__form");
    f.noValidate = true;
    var nome = el("input"); nome.type = "text"; nome.maxLength = 120; nome.autocomplete = "name"; nome.placeholder = "Seu nome";
    nome.setAttribute("aria-label", "Seu nome");
    var email = el("input"); email.type = "email"; email.maxLength = 120; email.autocomplete = "email"; email.placeholder = "Seu e-mail"; email.required = true;
    email.setAttribute("aria-label", "Seu e-mail");
    var ir = el("button", "btn btn--red btn--sm", "Me avise"); ir.type = "submit";
    var nota = el("p", "avise__nota");
    var priv = el("a", null, "política de privacidade"); priv.href = "privacidade.html"; priv.target = "_blank";
    nota.append("Usamos o e-mail só para este aviso. Veja a ", priv, ".");
    var msg = el("p", "avise__msg"); msg.setAttribute("role", "status"); msg.hidden = true;
    f.append(nome, email, ir, nota, msg);
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      msg.hidden = false; msg.classList.remove("is-erro");
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.value.trim())) { msg.textContent = "Informe um e-mail válido."; msg.classList.add("is-erro"); email.focus(); return; }
      ir.disabled = true; msg.textContent = "Enviando...";
      fetch("api/aviso", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ prova_id: ev.id, nome: nome.value.trim(), email: email.value.trim() }),
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) throw new Error(j.mensagem || "Não deu certo agora. Tente de novo.");
        });
      }).then(function () {
        f.innerHTML = "";
        f.append(el("p", "avise__ok", (ok || "Pronto! Assim que as inscrições abrirem, mandamos o link para ") + email.value.trim() + "."));
      }).catch(function (err) {
        ir.disabled = false;
        msg.textContent = /fetch|network/i.test(err.message) ? "Sem conexão. Tente de novo." : err.message;
        msg.classList.add("is-erro");
      });
    });
    return f;
  }
  // Um botão só: "Inscrições em breve / Me avise quando abrir", que abre o formulário logo abaixo
  // rotulos (opcional): { pequeno, texto, ok } para outros usos, como "Próxima edição" na prova já realizada
  function bloco(ev, cls, rotulos) {
    rotulos = rotulos || {};
    var w = el("div", "avise");
    var linha = el("div", "avise__linha");
    var abre = el("button", (cls || "btn btn--sm") + " btn--embreve avise__abre");
    abre.append(el("small", null, rotulos.pequeno || "Inscrições em breve"), el("span", null, rotulos.texto || "Me avise quando abrir"));
    abre.type = "button";
    abre.setAttribute("aria-expanded", "false");
    abre.setAttribute("aria-label", (rotulos.pequeno || "Inscrições em breve") + ". Me avise quando as inscrições da " + ev.nome + " abrirem");
    linha.append(abre);
    w.append(linha);
    var f = null;
    abre.addEventListener("click", function () {
      if (!f) { f = form(ev, rotulos.ok); w.append(f); }
      var abrir = abre.getAttribute("aria-expanded") !== "true";
      f.hidden = !abrir;
      abre.setAttribute("aria-expanded", String(abrir));
      if (abrir) { var i = f.querySelector("input"); if (i) i.focus(); }
    });
    return w;
  }
  return { bloco: bloco };
})();
