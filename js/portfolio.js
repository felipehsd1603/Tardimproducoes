(function () {
  "use strict";

  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
    "agosto", "setembro", "outubro", "novembro", "dezembro"];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function link(text, href, cls, externo) {
    var a = el("a", cls, text);
    a.href = href;
    if (externo) { a.target = "_blank"; a.rel = "noopener"; }
    return a;
  }
  function numero(n) { return Number(n).toLocaleString("pt-BR"); }

  var site = typeof SITE !== "undefined" ? SITE : {};
  var eventos = typeof REALIZADAS !== "undefined" ? REALIZADAS : [];
  var demo = window.DEMO ? "&demo=1" : "";
  var demoQ = window.DEMO ? "?demo=1" : "";
  function linkEvento(id) { return "evento.html?id=" + encodeURIComponent(id || "") + demo; }
  function wa(msg) { return "https://wa.me/" + (site.whatsapp || "") + "?text=" + encodeURIComponent(msg); }

  function breadcrumb(itens) {
    var nav = el("nav", "breadcrumb");
    nav.setAttribute("aria-label", "Você está em");
    var ol = el("ol");
    itens.forEach(function (it, i) {
      var li = el("li");
      if (it[1] && i < itens.length - 1) li.append(link(it[0], it[1]));
      else { var s = el("span", null, it[0]); s.setAttribute("aria-current", "page"); li.append(s); }
      ol.append(li);
    });
    nav.append(ol);
    var ld = document.createElement("script");
    ld.type = "application/ld+json";
    var base = location.href.replace(/[^/]*$/, "");
    ld.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: itens.map(function (it, i) {
        var o = { "@type": "ListItem", position: i + 1, name: it[0] };
        if (it[1]) o.item = base + it[1].replace(/\?demo=1|&demo=1/, "");
        return o;
      }),
    });
    document.head.append(ld);
    return nav;
  }

  function botaoWa(texto, msg, cls) {
    var a = link("", wa(msg), "btn btn--wa " + (cls || ""), true);
    a.innerHTML = '<svg aria-hidden="true"><use href="#i-whatsapp"/></svg>';
    a.append(texto);
    return a;
  }

  // Card de evento (usado na lista e em "outros eventos")
  function card(ev) {
    var a = el("a", "case-card");
    a.href = linkEvento(ev.id);
    a.setAttribute("data-tipo", ev.tipo || "");
    var capa = el("div", "case-card__cover" + (ev.capa ? "" : " case-card__cover--logo"));
    var img = el("img");
    img.src = ev.capa || ev.logo;
    img.alt = "";
    img.loading = "lazy";
    capa.append(img);
    if (ev.capa && ev.logo) {
      var badge = el("img", "case-card__badge");
      badge.src = ev.logo; badge.alt = ""; badge.loading = "lazy";
      capa.append(badge);
    }
    a.append(capa);
    var corpo = el("div", "case-card__body");
    var meta = el("p", "case-card__meta", [ev.ano, ev.tipo].filter(Boolean).join(" · "));
    if (ev.demo) meta.append(" ", el("span", "tag-demo", "Exemplo"));
    corpo.append(meta, el("h3", null, ev.nome));
    if (ev.cliente) corpo.append(el("p", "case-card__client", ev.cliente));
    if (ev.participantes) corpo.append(el("p", "case-card__num", numero(ev.participantes) + " participantes"));
    corpo.append(el("span", "case-card__more", "Ver evento →"));
    a.append(corpo);
    return a;
  }

  function ctaFinal(nomeEvento) {
    var s = el("section", "contact case-cta");
    var w = el("div", "wrap case-cta__inner");
    var t = el("div");
    t.append(el("h2", null, nomeEvento ? "Quer um evento como este?" : "Vamos fazer o seu evento?"));
    t.append(el("p", null, "Conte sua ideia para a Tardim Produções. Cuidamos do planejamento, das licenças e de toda a produção da prova."));
    var acoes = el("div", "actions");
    acoes.append(botaoWa(nomeEvento ? "Quero um evento assim" : "Falar no WhatsApp",
      nomeEvento ? "Olá! Vi o evento " + nomeEvento + " no portfólio da Tardim Produções e quero conversar sobre um evento." :
        "Olá! Vi o portfólio da Tardim Produções e quero conversar sobre um evento."));
    if (site.email) acoes.append(link("Enviar e-mail", "mailto:" + site.email, "btn btn--white"));
    w.append(t, acoes);
    s.append(w);
    return s;
  }

  // ================= Página: lista do portfólio =================
  var raizLista = document.getElementById("portfolio");
  if (raizLista) {
    var topo = el("section", "event-hero");
    var tw = el("div", "wrap portfolio-hero");
    tw.append(breadcrumb([["Início", "index.html" + demoQ], ["Portfólio"]]));
    tw.append(el("h1", null, "Portfólio de eventos"));
    tw.append(el("p", "event-hero__place", "Corridas e eventos esportivos produzidos pela Tardim Produções para conselhos profissionais, órgãos públicos, federações e empresas em Minas Gerais."));

    // Números (só aparecem quando há dados)
    var clientes = {};
    var totalPart = 0;
    eventos.forEach(function (e) {
      if (e.cliente) clientes[e.cliente] = true;
      if (e.participantes) totalPart += Number(e.participantes) || 0;
    });
    var stats = el("div", "pf-stats");
    function stat(valor, rotulo) {
      var d = el("div", "pf-stat");
      d.append(el("b", null, valor), el("span", null, rotulo));
      stats.append(d);
    }
    stat(String(eventos.length), "eventos no portfólio");
    var nCli = Object.keys(clientes).length;
    if (nCli) stat(String(nCli), nCli === 1 ? "instituição atendida" : "instituições e empresas atendidas");
    if (totalPart) stat(numero(totalPart), "participantes nos eventos listados");
    tw.append(stats);
    topo.append(tw);
    raizLista.append(topo);

    var corpo = el("section", "block");
    var cw = el("div", "wrap");

    // Filtro por tipo de cliente
    var tipos = [];
    eventos.forEach(function (e) { if (e.tipo && tipos.indexOf(e.tipo) < 0) tipos.push(e.tipo); });
    var grade = el("div", "case-grid");
    if (tipos.length >= 2) {
      var filtro = el("div", "dist-filter pf-filter");
      filtro.setAttribute("role", "group");
      filtro.setAttribute("aria-label", "Filtrar por tipo de cliente");
      var aplica = function (t) {
        filtro.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-v") === t)); });
        grade.querySelectorAll(".case-card").forEach(function (c) { c.hidden = !(t === "" || c.getAttribute("data-tipo") === t); });
      };
      [""].concat(tipos).forEach(function (t) {
        var b = el("button", "dist-chip", t || "Todos");
        b.type = "button";
        b.setAttribute("data-v", t);
        b.addEventListener("click", function () { aplica(t); });
        filtro.append(b);
      });
      cw.append(filtro);
      setTimeout(function () { aplica(""); });
    }
    eventos.forEach(function (e) { grade.append(card(e)); });
    cw.append(grade);
    corpo.append(cw);
    raizLista.append(corpo);
    raizLista.append(ctaFinal(null));
  }

  // ================= Página: estudo de caso do evento =================
  var raizEvento = document.getElementById("evento");
  if (raizEvento) {
    var id = new URLSearchParams(location.search).get("id");
    var ev = eventos.filter(function (e) { return e.id === id; })[0];

    if (!ev) {
      var vz = el("section", "block");
      var vw = el("div", "wrap");
      vw.append(el("h1", "page-title", "Evento não encontrado"),
        el("p", "muted", "O link pode ter mudado."),
        link("Ver portfólio", "portfolio.html" + demoQ, "btn btn--red"));
      vz.append(vw);
      raizEvento.append(vz);
    } else {
      document.title = ev.nome + " · Portfólio · Tardim Produções";
      var meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute("content", ev.nome + ": evento produzido pela Tardim Produções" + (ev.cliente ? " para " + ev.cliente : "") + ".");

      // Topo
      var hero = el("section", "event-hero");
      var hg = el("div", "wrap event-hero__grid");
      var ht = el("div", "event-hero__text");
      ht.append(breadcrumb([["Início", "index.html" + demoQ], ["Portfólio", "portfolio.html" + demoQ], [ev.nome]]));
      var linha = el("div", "case-title");
      if (ev.logo) { var lg = el("img", "case-title__logo"); lg.src = ev.logo; lg.alt = "Logo " + ev.nome; linha.append(lg); }
      var tt = el("div");
      var sub = el("p", "event-hero__date", [ev.ano, ev.tipo].filter(Boolean).join(" · "));
      if (ev.demo) sub.append(" ", el("span", "tag-demo", "Exemplo"));
      tt.append(sub, el("h1", null, ev.nome));
      linha.append(tt);
      ht.append(linha);
      if (ev.descricao) ht.append(el("p", "event-hero__place", ev.descricao));
      if (ev.participantes) {
        var cnt = el("p", "event-hero__count");
        cnt.append(el("b", null, numero(ev.participantes)), " participantes");
        ht.append(cnt);
      }
      var ha = el("div", "actions");
      ha.append(botaoWa("Quero um evento assim", "Olá! Vi o evento " + ev.nome + " no portfólio da Tardim Produções e quero conversar sobre um evento.", "btn--lg"));
      ht.append(ha);
      hg.append(ht);
      if (ev.capa) { var cp = el("img", "event-hero__poster case-hero__photo"); cp.src = ev.capa; cp.alt = "Foto do evento " + ev.nome; hg.append(cp); }
      hero.append(hg);
      raizEvento.append(hero);

      var body = el("div", "wrap event-body");
      function secao(titulo, conteudo) {
        var s = el("section", "event-sec");
        s.append(el("h2", null, titulo), conteudo);
        body.append(s);
      }

      // Ficha técnica
      var dl = el("dl", "facts");
      var quando = ev.data ? (function () { var p = ev.data.split("-").map(Number); return p[2] + " de " + MESES[p[1] - 1] + " de " + p[0]; })() : ev.ano;
      var percursos = Array.isArray(ev.percursos) ? ev.percursos.join(" · ") : ev.percursos;
      [["Cliente", ev.cliente], ["Tipo", ev.tipo], [ev.data ? "Data" : "Ano", quando], ["Local", ev.local],
        ["Percursos", percursos], ["Participantes", ev.participantes ? numero(ev.participantes) : ""]]
        .forEach(function (f) { if (f[1]) dl.append(el("dt", null, f[0]), el("dd", null, f[1])); });
      secao("Ficha técnica", dl);

      if (ev.servicos && ev.servicos.length) {
        var ul = el("ul", "checklist checklist--grid");
        ev.servicos.forEach(function (s) { ul.append(el("li", null, s)); });
        secao("O que a Tardim Produções fez", ul);
      }
      if (ev.destaques && ev.destaques.length) {
        var dlst = el("ul", "highlights");
        ev.destaques.forEach(function (d) { dlst.append(el("li", null, d)); });
        secao("Destaques", dlst);
      }
      if (ev.depoimento && ev.depoimento.texto) {
        var bq = el("figure", "testimonial");
        bq.append(el("blockquote", null, "“" + ev.depoimento.texto + "”"));
        var cap = el("figcaption");
        cap.append(el("strong", null, ev.depoimento.autor || ""));
        if (ev.depoimento.cargo) cap.append(el("span", null, ev.depoimento.cargo));
        bq.append(cap);
        secao("O que o cliente diz", bq);
      }
      var temDetalhe = (ev.servicos && ev.servicos.length) || (ev.destaques && ev.destaques.length) || ev.descricao;
      if (!temDetalhe) body.append(el("p", "muted case-soon", "Mais fotos e detalhes deste evento serão publicados em breve."));
      raizEvento.append(body);

      // Galeria
      if (ev.fotos && ev.fotos.length) {
        var gal = el("section", "block gallery case-gallery");
        var gw = el("div", "wrap");
        var head = el("div", "carousel-head");
        var hh = el("div"); hh.append(el("h2", null, "Fotos do evento"));
        var nav = el("div", "carousel-nav");
        var prev = el("button", "carousel-btn", "←"); prev.type = "button"; prev.setAttribute("aria-label", "Fotos anteriores");
        var next = el("button", "carousel-btn", "→"); next.type = "button"; next.setAttribute("aria-label", "Próximas fotos");
        nav.append(prev, next);
        head.append(hh, nav);
        gw.append(head);
        gal.append(gw);
        var trilho = el("div", "carousel");
        trilho.tabIndex = 0;
        trilho.setAttribute("role", "region");
        trilho.setAttribute("aria-label", "Fotos do evento " + ev.nome);
        ev.fotos.forEach(function (f) {
          var fig = el("figure", "slide");
          var im = el("img"); im.src = f.foto; im.alt = f.legenda || ""; im.loading = "lazy";
          fig.append(im);
          if (f.legenda) fig.append(el("figcaption", null, f.legenda));
          trilho.append(fig);
        });
        gal.append(trilho);
        raizEvento.append(gal);
        var mover = function (dir) {
          var s = trilho.firstElementChild;
          var passo = s ? s.getBoundingClientRect().width + 16 : trilho.clientWidth;
          trilho.scrollBy({ left: dir * passo * Math.max(1, Math.floor(trilho.clientWidth / passo)), behavior: "smooth" });
        };
        var setas = function () {
          prev.disabled = trilho.scrollLeft <= 2;
          next.disabled = trilho.scrollLeft >= trilho.scrollWidth - trilho.clientWidth - 2;
          nav.hidden = trilho.scrollWidth <= trilho.clientWidth + 2;
        };
        prev.addEventListener("click", function () { mover(-1); });
        next.addEventListener("click", function () { mover(1); });
        trilho.addEventListener("scroll", setas, { passive: true });
        window.addEventListener("resize", setas);
        window.addEventListener("load", setas);
        setTimeout(setas);
      }

      // Outros eventos
      var outros = eventos.filter(function (e) { return e.id !== ev.id; }).slice(0, 3);
      if (outros.length) {
        var os = el("section", "block block--paper");
        var ow = el("div", "wrap");
        var oh = el("div", "carousel-head");
        var ohh = el("div"); ohh.append(el("h2", null, "Outros eventos"));
        oh.append(ohh, link("Ver portfólio completo →", "portfolio.html" + demoQ, "race-card__more"));
        ow.append(oh);
        var og = el("div", "case-grid");
        outros.forEach(function (e) { og.append(card(e)); });
        ow.append(og);
        os.append(ow);
        raizEvento.append(os);
      }
      raizEvento.append(ctaFinal(ev.nome));
    }
  }

  // WhatsApp flutuante
  var flut = document.getElementById("wa-float");
  if (flut) flut.href = wa("Olá! Vim pelo portfólio da Tardim Produções.");

  // Menu no celular
  var btn = document.querySelector(".menu-btn");
  if (btn) btn.addEventListener("click", function () {
    var open = document.body.classList.toggle("menu-open");
    btn.setAttribute("aria-expanded", String(open));
    btn.textContent = open ? "Fechar" : "Menu";
  });

  document.getElementById("ano").textContent = new Date().getFullYear();
})();
