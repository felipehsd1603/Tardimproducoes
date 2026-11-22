(function () {
  "use strict";

  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
    "agosto", "setembro", "outubro", "novembro", "dezembro"];
  var DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

  function data(str) {
    var p = str.split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  var proximas = (typeof PROXIMAS !== "undefined" ? PROXIMAS : [])
    .filter(function (e) { return e.data && data(e.data) >= hoje; })
    .sort(function (a, b) { return a.data.localeCompare(b.data); });

  var linkPadrao = (typeof SITE !== "undefined" && SITE.linktree) || "#";

  // ---------- Calendário ----------
  var lista = document.getElementById("proximas");
  proximas.forEach(function (ev) {
    var d = data(ev.data);
    var item = el("article", "race");

    if (ev.poster) {
      var img = el("img", "race__poster");
      img.src = ev.poster;
      img.alt = "Arte de divulgação: " + ev.nome;
      img.loading = "lazy";
      item.append(img);
    }

    var info = el("div", "race__info");
    var quando = el("p", "race__date");
    quando.append(el("b", null, d.getDate() + " de " + MESES[d.getMonth()]), " " + d.getFullYear() + " · " + DIAS[d.getDay()]);
    info.append(quando, el("h3", null, ev.nome));

    var dl = el("dl", "race__facts");
    [["Local", ev.local], ["Largada", ev.hora], ["Percursos", ev.percursos]].forEach(function (f) {
      if (!f[1]) return;
      dl.append(el("dt", null, f[0]), el("dd", null, f[1]));
    });
    info.append(dl);
    if (ev.info) info.append(el("p", "race__note", ev.info));

    var a = el("a", "btn btn--red", "Fazer inscrição");
    a.href = ev.inscricao || linkPadrao;
    a.target = "_blank";
    a.rel = "noopener";
    info.append(a);

    item.append(info);
    lista.append(item);
  });
  document.getElementById("sem-provas").hidden = proximas.length > 0;

  // ---------- Faixa "próxima prova" ----------
  if (proximas.length) {
    var p = proximas[0];
    var dp = data(p.data);
    var dias = Math.round((dp - hoje) / 86400000);
    document.getElementById("next-name").textContent = p.nome;
    document.getElementById("next-when").textContent = dp.getDate() + " de " + MESES[dp.getMonth()];
    document.getElementById("next-count").textContent =
      dias === 0 ? "é hoje!" : dias === 1 ? "é amanhã" : "faltam " + dias + " dias";
    document.getElementById("next-link").href = p.inscricao || linkPadrao;
    document.getElementById("next-link").target = "_blank";
    document.getElementById("next").hidden = false;
  }

  // ---------- Provas realizadas ----------
  var logos = document.getElementById("realizadas");
  (typeof REALIZADAS !== "undefined" ? REALIZADAS : []).forEach(function (r) {
    var li = el("li");
    var img = el("img");
    img.src = r.logo;
    img.alt = "Logo " + r.nome;
    img.loading = "lazy";
    img.width = 300;
    img.height = 300;
    li.append(img, el("span", null, r.nome));
    if (r.ano) li.append(el("small", null, r.ano));
    logos.append(li);
  });

  // ---------- Contatos ----------
  if (typeof SITE !== "undefined") {
    if (SITE.whatsapp) {
      var w = document.getElementById("whatsapp-link");
      w.href = "https://wa.me/" + SITE.whatsapp + "?text=" + encodeURIComponent("Olá! Vim pelo site da Tardim Produções.");
      var n = SITE.whatsapp.replace(/^55/, "");
      w.textContent = "(" + n.slice(0, 2) + ") " + n.slice(2, -4) + "-" + n.slice(-4);
      document.getElementById("li-whatsapp").hidden = false;
    }
    if (SITE.email) {
      var m = document.getElementById("email-link");
      m.href = "mailto:" + SITE.email;
      m.textContent = SITE.email;
    }
  }

  // ---------- Menu no celular ----------
  var btn = document.querySelector(".menu-btn");
  btn.addEventListener("click", function () {
    var open = document.body.classList.toggle("menu-open");
    btn.setAttribute("aria-expanded", String(open));
    btn.textContent = open ? "Fechar" : "Menu";
  });
  document.getElementById("menu").addEventListener("click", function (e) {
    if (e.target.tagName === "A") {
      document.body.classList.remove("menu-open");
      btn.setAttribute("aria-expanded", "false");
      btn.textContent = "Menu";
    }
  });

  document.getElementById("ano").textContent = new Date().getFullYear();
})();
