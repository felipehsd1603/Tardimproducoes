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
    var dia = DIAS[d.getDay()];
    quando.append(
      dia.charAt(0).toUpperCase() + dia.slice(1) + ", ",
      el("b", null, d.getDate() + " de " + MESES[d.getMonth()]),
      " de " + d.getFullYear()
    );
    info.append(quando, el("h3", null, ev.nome));

    var dl = el("dl", "race__facts");
    [["Local", ev.local], ["Largada", ev.hora], ["Percursos", ev.percursos]].forEach(function (f) {
      if (!f[1]) return;
      dl.append(el("dt", null, f[0]), el("dd", null, f[1]));
    });
    info.append(dl);
    if (ev.info) info.append(el("p", "race__note", ev.info));

    var acoes = el("div", "race__actions");
    var a = el("a", "btn btn--red", "Fazer inscrição");
    a.href = ev.inscricao || linkPadrao;
    a.target = "_blank";
    a.rel = "noopener";

    // "Salvar na agenda" (Google Agenda)
    var ymd = ev.data.replace(/-/g, "");
    var fim = new Date(d.getTime() + 86400000);
    var ymdFim = fim.getFullYear() + String(fim.getMonth() + 1).padStart(2, "0") + String(fim.getDate()).padStart(2, "0");
    var cal = el("a", "btn btn--line", "Salvar na agenda");
    cal.href = "https://calendar.google.com/calendar/render?action=TEMPLATE" +
      "&text=" + encodeURIComponent(ev.nome) +
      "&dates=" + ymd + "/" + ymdFim +
      "&location=" + encodeURIComponent(ev.local || "") +
      "&details=" + encodeURIComponent((ev.hora ? "Largada " + ev.hora + ". " : "") + "Inscrições: " + (ev.inscricao || linkPadrao));
    cal.target = "_blank";
    cal.rel = "noopener";

    acoes.append(a, cal);
    info.append(acoes);

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
    // WhatsApp: todos os links com data-wa usam o número e a mensagem pronta
    var waLinks = document.querySelectorAll("[data-wa]");
    if (SITE.whatsapp) {
      waLinks.forEach(function (a) {
        a.href = "https://wa.me/" + SITE.whatsapp + "?text=" + encodeURIComponent(a.getAttribute("data-wa"));
      });
      var n = SITE.whatsapp.replace(/^55/, "");
      document.getElementById("wa-number").textContent =
        "(" + n.slice(0, 2) + ") " + n.slice(2, -4) + "-" + n.slice(-4);
    } else {
      waLinks.forEach(function (a) {
        (a.closest("li") || a).hidden = true;
      });
    }

    // Dados da empresa (só mostra o que estiver preenchido)
    var dados = document.getElementById("dados-empresa");
    [["Razão social", SITE.razaoSocial], ["CNPJ", SITE.cnpj], ["Endereço", SITE.endereco],
      ["Cidade", SITE.cidade], ["E-mail", SITE.email]].forEach(function (f) {
      if (!f[1]) return;
      dados.append(el("dt", null, f[0]), el("dd", null, f[1]));
    });
    if (SITE.cnpj) {
      document.getElementById("footer-legal").textContent =
        (SITE.razaoSocial || "Tardim Produções LTDA") + " · CNPJ " + SITE.cnpj + " · " + (SITE.cidade || "");
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

  // ---------- Dados estruturados (Google mostra as provas na busca) ----------
  if (proximas.length) {
    var ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.textContent = JSON.stringify(proximas.map(function (ev) {
      return {
        "@context": "https://schema.org",
        "@type": "SportsEvent",
        name: ev.nome,
        startDate: ev.data,
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        location: { "@type": "Place", name: ev.local, address: ev.local },
        image: ev.poster ? new URL(ev.poster, location.href).href : undefined,
        organizer: { "@type": "Organization", name: "Tardim Produções", url: location.origin + location.pathname },
        url: ev.inscricao || linkPadrao,
      };
    }));
    document.head.append(ld);
  }

  // ---------- Menu destaca a seção atual ----------
  var links = Array.prototype.slice.call(document.querySelectorAll(".nav a"));
  if ("IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (l) {
          l.classList.toggle("is-active", l.getAttribute("href") === "#" + en.target.id);
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    links.forEach(function (l) {
      var s = document.querySelector(l.getAttribute("href"));
      if (s) spy.observe(s);
    });

    // Botão flutuante some quando a seção de contato está na tela
    var flutuante = document.querySelector(".wa-float");
    var contato = document.getElementById("contato");
    if (flutuante && contato) {
      new IntersectionObserver(function (en) {
        flutuante.classList.toggle("is-hidden", en[0].isIntersecting);
      }).observe(contato);
    }
  }

  document.getElementById("ano").textContent = new Date().getFullYear();
})();
