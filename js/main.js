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
  function linkProva(id) {
    return "prova.html?id=" + encodeURIComponent(id || "") + (window.DEMO ? "&demo=1" : "");
  }
  // Distâncias de uma prova, em km (ex.: ["5", "10"]) a partir dos textos dos percursos
  function distancias(ev) {
    var lista = Array.isArray(ev.percursos) ? ev.percursos : [ev.percursos || ""];
    var out = [];
    lista.forEach(function (t) {
      var m = String(t).match(/(\d+(?:[.,]\d+)?)\s*km/i);
      if (m) out.push(m[1].replace(".", ","));
    });
    return out;
  }

  // ---------- Calendário (agrupado por mês, com filtro por distância) ----------
  var lista = document.getElementById("proximas");
  var grupos = {};
  var ordemGrupos = [];
  var todasDist = {};

  proximas.forEach(function (ev) {
    var d = data(ev.data);
    var chave = d.getFullYear() + "-" + d.getMonth();
    if (!grupos[chave]) {
      var g = el("section", "month-group");
      var nomeMes = MESES[d.getMonth()];
      g.append(el("h3", "month-title", nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1) + " " + d.getFullYear()));
      var r = el("div", "races");
      g.append(r);
      grupos[chave] = { el: g, races: r };
      ordemGrupos.push(chave);
    }
    var item = el("article", "race");
    var dist = distancias(ev);
    dist.forEach(function (k) { todasDist[k] = true; });
    item.setAttribute("data-dist", dist.join("|"));
    var detalhe = linkProva(ev.id);

    if (ev.poster) {
      var pl = el("a", "race__poster-link");
      pl.href = detalhe;
      pl.setAttribute("aria-label", "Ver detalhes: " + ev.nome);
      var img = el("img", "race__poster");
      img.src = ev.poster;
      img.alt = "Arte de divulgação: " + ev.nome;
      img.loading = "lazy";
      pl.append(img);
      item.append(pl);
    }

    var info = el("div", "race__info");
    var quando = el("p", "race__date");
    var dia = DIAS[d.getDay()];
    quando.append(
      dia.charAt(0).toUpperCase() + dia.slice(1) + ", ",
      el("b", null, d.getDate() + " de " + MESES[d.getMonth()]),
      " de " + d.getFullYear()
    );
    if (ev.demo) quando.append(" ", el("span", "tag-demo", "Exemplo"));
    var titulo = el("h4");
    var tl = el("a", null, ev.nome);
    tl.href = detalhe;
    titulo.append(tl);
    info.append(quando, titulo);

    var percursos = Array.isArray(ev.percursos) ? ev.percursos.join(" · ") : ev.percursos;
    var dl = el("dl", "race__facts");
    [["Local", ev.local], ["Largada", ev.hora], ["Percursos", percursos]].forEach(function (f) {
      if (!f[1]) return;
      dl.append(el("dt", null, f[0]), el("dd", null, f[1]));
    });
    info.append(dl);
    if (ev.resumo) info.append(el("p", "race__note", ev.resumo));

    var acoes = el("div", "race__actions");
    var a = el("a", "btn btn--red", "Fazer inscrição");
    a.href = ev.inscricao || linkPadrao;
    a.target = "_blank";
    a.rel = "noopener";
    var ver = el("a", "btn btn--line", "Ver detalhes da prova");
    ver.href = detalhe;

    acoes.append(a, ver);
    info.append(acoes);

    item.append(info);
    grupos[chave].races.append(item);
  });
  ordemGrupos.forEach(function (k) { lista.append(grupos[k].el); });
  document.getElementById("sem-provas").hidden = proximas.length > 0;

  // Filtro por distância (aparece com 3+ provas e 2+ distâncias diferentes)
  var chavesDist = Object.keys(todasDist).sort(function (a, b) {
    return parseFloat(a.replace(",", ".")) - parseFloat(b.replace(",", "."));
  });
  if (proximas.length >= 3 && chavesDist.length >= 2) {
    var filtro = el("div", "dist-filter");
    filtro.setAttribute("role", "group");
    filtro.setAttribute("aria-label", "Filtrar provas por distância");
    filtro.append(el("span", "dist-filter__label", "Distância:"));
    var aviso = el("p", "muted dist-filter__empty", "Nenhuma prova com essa distância no momento.");
    aviso.hidden = true;
    function aplica(valor) {
      filtro.querySelectorAll("button").forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.getAttribute("data-v") === valor));
      });
      var visiveis = 0;
      lista.querySelectorAll(".month-group").forEach(function (g) {
        var algum = false;
        g.querySelectorAll(".race").forEach(function (r) {
          var ok = valor === "" || r.getAttribute("data-dist").split("|").indexOf(valor) >= 0;
          r.hidden = !ok;
          if (ok) { algum = true; visiveis++; }
        });
        g.hidden = !algum;
      });
      aviso.hidden = visiveis > 0;
    }
    [""].concat(chavesDist).forEach(function (k) {
      var b = el("button", "dist-chip", k === "" ? "Todas" : k + " km");
      b.type = "button";
      b.setAttribute("data-v", k);
      b.addEventListener("click", function () { aplica(k); });
      filtro.append(b);
    });
    lista.parentNode.insertBefore(filtro, lista);
    lista.parentNode.insertBefore(aviso, lista.nextSibling);
    aplica("");
  }

  // ---------- Card "próxima prova" na abertura ----------
  if (proximas.length) {
    var p = proximas[0];
    var dp = data(p.data);
    var dias = Math.round((dp - hoje) / 86400000);
    var nomeEl = document.getElementById("next-name");
    var nomeLink = el("a", null, p.nome);
    nomeLink.href = linkProva(p.id);
    nomeEl.append(nomeLink);
    var nDias = document.getElementById("next-days");
    var lDias = document.getElementById("next-days-label");
    if (dias === 0) { nDias.textContent = "É hoje!"; lDias.textContent = ""; }
    else if (dias === 1) { nDias.textContent = "Amanhã"; lDias.textContent = ""; }
    else { nDias.textContent = dias; lDias.textContent = "dias para a largada"; }
    var poster = document.getElementById("next-poster");
    if (p.poster) { poster.src = p.poster; poster.alt = "Arte de divulgação: " + p.nome; }
    else { poster.remove(); }
    document.getElementById("next-link").href = p.inscricao || linkPadrao;
    document.getElementById("next-link").target = "_blank";
    document.getElementById("next").hidden = false;
  }

  // ---------- Carrossel das artes das provas (a partir de N provas) ----------
  var minimo = (typeof SITE !== "undefined" && SITE.carrosselMinimo) || 3;
  var comArte = proximas.filter(function (e) { return e.poster; });
  if (comArte.length >= minimo) {
    var trilho = document.getElementById("banners");
    comArte.forEach(function (ev) {
      var dd = data(ev.data);
      var a = el("a", "banner-slide");
      a.href = linkProva(ev.id);
      var im = el("img");
      im.src = ev.poster;
      im.alt = "Arte de divulgação: " + ev.nome;
      im.loading = "lazy";
      var cap = el("span", "banner-slide__cap");
      cap.append(el("b", null, dd.getDate() + " de " + MESES[dd.getMonth()]), el("span", null, ev.nome));
      a.append(im, cap);
      trilho.append(a);
    });
    document.getElementById("banners-wrap").hidden = false;
  }

  // ---------- Galeria de fotos ----------
  var galeria = document.getElementById("galeria");
  (typeof GALERIA !== "undefined" ? GALERIA : []).forEach(function (g) {
    var f = el("figure", "slide");
    var im = el("img");
    im.src = g.foto;
    im.alt = g.alt || g.legenda || "";
    im.loading = "lazy";
    im.width = 399;
    im.height = 462;
    f.append(im);
    if (g.legenda) f.append(el("figcaption", null, g.legenda));
    galeria.append(f);
  });

  // ---------- Setas dos carrosséis (sem rotação automática) ----------
  document.querySelectorAll(".carousel-nav").forEach(function (nav) {
    var trilhoAlvo = document.getElementById(nav.getAttribute("data-for"));
    if (!trilhoAlvo) return;
    var botoes = nav.querySelectorAll(".carousel-btn");
    function atualizaSetas() {
      var max = trilhoAlvo.scrollWidth - trilhoAlvo.clientWidth - 2;
      botoes[0].disabled = trilhoAlvo.scrollLeft <= 2;
      botoes[1].disabled = trilhoAlvo.scrollLeft >= max;
      nav.hidden = trilhoAlvo.scrollWidth <= trilhoAlvo.clientWidth + 2;
    }
    botoes.forEach(function (b) {
      b.addEventListener("click", function () {
        var dir = Number(b.getAttribute("data-dir"));
        var slide = trilhoAlvo.firstElementChild;
        var passo = slide ? slide.getBoundingClientRect().width + 16 : trilhoAlvo.clientWidth * 0.8;
        var visiveis = Math.max(1, Math.floor(trilhoAlvo.clientWidth / passo));
        trilhoAlvo.scrollBy({ left: dir * passo * visiveis, behavior: "smooth" });
      });
    });
    trilhoAlvo.addEventListener("scroll", atualizaSetas, { passive: true });
    window.addEventListener("resize", atualizaSetas);
    window.addEventListener("load", atualizaSetas);
    atualizaSetas();
  });

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

    // Botão flutuante: aparece depois da abertura e some na seção de contato
    var flutuante = document.querySelector(".wa-float");
    var hero = document.querySelector(".hero");
    var contato = document.getElementById("contato");
    if (flutuante && hero && contato) {
      var naAbertura = true, noContato = false;
      var atualiza = function () { flutuante.classList.toggle("is-hidden", naAbertura || noContato); };
      atualiza();
      new IntersectionObserver(function (en) { naAbertura = en[0].isIntersecting; atualiza(); }, { threshold: 0.25 }).observe(hero);
      new IntersectionObserver(function (en) { noContato = en[0].isIntersecting; atualiza(); }).observe(contato);
    }
  }

  document.getElementById("ano").textContent = new Date().getFullYear();
})();
