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
  function linkEvento(id) { return window.DEMO ? "evento.html?id=" + encodeURIComponent(id || "") + demo : "trabalho-" + id + ".html"; }
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

  // Área do trabalho: "Eventos esportivos" (padrão) ou "Prevenção contra incêndio"
  function area(ev) { return ev.area || (ev.icone === "incendio" ? "Prevenção contra incêndio" : "Eventos esportivos"); }
  function ehEvento(ev) { return area(ev) === "Eventos esportivos"; }

  // Ícones para trabalhos sem logo
  var ICONES = {
    corrida: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3A7.3 7.3 0 0 0 19 13v-2a5.1 5.1 0 0 1-4.4-2.4l-1-1.6a2 2 0 0 0-1.7-1c-.3 0-.5 0-.8.1L6 8.3V13h2V9.6l1.8-.7"/></svg>',
    incendio: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5.7s.7 2.6.7 4.7c0 2-1.3 3.6-3.3 3.6S7.4 7.4 7.4 5.4l.1-.4A11.4 11.4 0 0 0 4.7 12.5a7.3 7.3 0 0 0 14.6 0C19.3 7.3 16.8 3 13.5.7ZM11.7 19.5c-1.6 0-2.9-1.3-2.9-2.9 0-1.5 1-2.6 2.6-2.9 1.6-.3 3.3-1.1 4.2-2.4.4 1.2.6 2.5.6 3.8 0 2.4-2 4.4-4.5 4.4Z"/></svg>',
  };
  function iconeEvento(ev, cls) {
    var d = el("div", cls + " icon--" + (ev.icone || "corrida"));
    d.innerHTML = ICONES[ev.icone] || ICONES.corrida;
    return d;
  }

  // Card de evento (usado na lista e em "outros eventos")
  function card(ev) {
    var a = el("a", "case-card");
    a.href = linkEvento(ev.id);
    a.setAttribute("data-tipo", ev.tipo || "");
    a.setAttribute("data-area", area(ev));
    var capa = el("div", "case-card__cover" + (ev.capa ? "" : (ev.logo ? " case-card__cover--logo" : " case-card__cover--icon")));
    if (ev.capa || ev.logo) {
      var img = el("img");
      img.src = ev.capa || ev.logo;
      img.alt = "";
      img.loading = "lazy";
      capa.append(img);
    } else {
      capa.append(iconeEvento(ev, "case-icon"));
    }
    if (ev.capa && ev.logo) {
      var badge = el("img", "case-card__badge");
      badge.src = ev.logo; badge.alt = ""; badge.loading = "lazy";
      capa.append(badge);
    }
    capa.append(el("span", "case-card__area" + (ehEvento(ev) ? "" : " case-card__area--alt"), area(ev)));
    a.append(capa);
    var corpo = el("div", "case-card__body");
    var meta = el("p", "case-card__meta", [ev.ano, ev.tipo].filter(Boolean).join(" · "));
    if (ev.demo) meta.append(" ", el("span", "tag-demo", "Exemplo"));
    corpo.append(meta, el("h3", null, ev.nome));
    if (ev.cliente) corpo.append(el("p", "case-card__client", ev.cliente));
    if (ev.participantes) corpo.append(el("p", "case-card__num", numero(ev.participantes) + " participantes"));
    corpo.append(el("span", "case-card__more", "Ver detalhes →"));
    a.append(corpo);
    return a;
  }

  function ctaFinal(nomeEvento, evento) {
    var s = el("section", "contact case-cta");
    var w = el("div", "wrap case-cta__inner");
    var t = el("div");
    t.append(el("h2", null, nomeEvento ? (evento ? "Quer um evento como este?" : "Precisa de um serviço como este?") : "Vamos conversar sobre o seu projeto?"));
    t.append(el("p", null, evento === false ? "Fale com a Tardim Produções sobre projetos e serviços de prevenção e combate a incêndio, brigada e licenciamento." : "Conte sua ideia para a Tardim Produções. Cuidamos do planejamento, das licenças e de toda a produção."));
    var acoes = el("div", "actions");
    acoes.append(botaoWa(nomeEvento ? (evento ? "Quero um evento assim" : "Quero um serviço assim") : "Falar no WhatsApp",
      nomeEvento ? "Olá! Vi o trabalho \"" + nomeEvento + "\" no portfólio da Tardim Produções e quero conversar." :
        "Olá! Vi o portfólio da Tardim Produções e quero conversar sobre um projeto."));
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
    tw.append(el("h1", null, "Portfólio de trabalhos"));
    tw.append(el("p", "event-hero__place", "Eventos esportivos e serviços de prevenção contra incêndio realizados pela Tardim Produções para tribunais, prefeituras, conselhos profissionais, federações e empresas em Minas Gerais."));

    // Números (só aparecem quando há dados)
    var clientes = {};
    var totalPart = 0;
    var comNumero = 0;
    eventos.forEach(function (e) {
      if (e.cliente) clientes[e.cliente] = true;
      if (e.participantes) { totalPart += Number(e.participantes) || 0; comNumero++; }
    });
    // Só mostra o total de participantes quando há números de pelo menos 3 eventos
    if (comNumero < 3) totalPart = 0;
    var stats = el("div", "pf-stats");
    function stat(valor, rotulo) {
      var d = el("div", "pf-stat");
      d.append(el("b", null, valor), el("span", null, rotulo));
      stats.append(d);
    }
    stat(String(eventos.length), "trabalhos realizados");
    var nEv = eventos.filter(ehEvento).length;
    var nOut = eventos.length - nEv;
    if (nEv && nOut) {
      stat(String(nEv), nEv === 1 ? "evento esportivo" : "eventos esportivos");
      stat(String(nOut), nOut === 1 ? "serviço de prevenção contra incêndio" : "serviços e projetos de prevenção contra incêndio");
    }
    var nCli = Object.keys(clientes).length;
    if (nCli) stat(String(nCli), nCli === 1 ? "instituição atendida" : "instituições e empresas atendidas");
    if (totalPart) stat(numero(totalPart), "participantes nos eventos listados");
    tw.append(stats);
    topo.append(tw);
    raizLista.append(topo);

    var corpo = el("section", "block");
    var cw = el("div", "wrap");

    // Filtros: área do trabalho + tipo de cliente
    var grade = el("div", "case-grid");
    var estado = { area: "", tipo: "" };
    var filtros = [];
    function aplicaFiltros() {
      filtros.forEach(function (f) {
        f.el.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-v") === estado[f.chave])); });
      });
      grade.querySelectorAll(".case-card").forEach(function (c) {
        c.hidden = !((estado.area === "" || c.getAttribute("data-area") === estado.area) &&
          (estado.tipo === "" || c.getAttribute("data-tipo") === estado.tipo));
      });
    }
    function linhaFiltro(chave, rotulo, todos, valores) {
      if (valores.length < 2) return;
      var f = el("div", "dist-filter pf-filter" + (chave === "area" ? " pf-filter--area" : ""));
      f.setAttribute("role", "group");
      f.setAttribute("aria-label", rotulo);
      [""].concat(valores).forEach(function (v) {
        var b = el("button", "dist-chip", v || todos);
        b.type = "button";
        b.setAttribute("data-v", v);
        b.addEventListener("click", function () { estado[chave] = v; aplicaFiltros(); });
        f.append(b);
      });
      filtros.push({ chave: chave, el: f });
      cw.append(f);
    }
    function ordenados(campo) {
      var cont = {};
      eventos.forEach(function (e) { var v = campo(e); if (v) cont[v] = (cont[v] || 0) + 1; });
      return Object.keys(cont).sort(function (x, y) {
        if (x === "Outros") return 1;
        if (y === "Outros") return -1;
        return cont[y] - cont[x];
      });
    }
    linhaFiltro("area", "Filtrar por área", "Todas as áreas", ordenados(area));
    linhaFiltro("tipo", "Filtrar por tipo de cliente", "Todos os clientes", ordenados(function (e) { return e.tipo; }));
    setTimeout(aplicaFiltros);
    eventos.forEach(function (e) { grade.append(card(e)); });
    cw.append(grade);
    corpo.append(cw);
    raizLista.append(corpo);
    raizLista.append(ctaFinal(null));
  }

  // ================= Página: estudo de caso do evento =================
  var raizEvento = document.getElementById("evento");
  if (raizEvento) {
    var id = window.PAGINA_ID || new URLSearchParams(location.search).get("id");
    var ev = eventos.filter(function (e) { return e.id === id; })[0];

    if (!ev) {
      var vz = el("section", "block");
      var vw = el("div", "wrap");
      vw.append(el("h1", "page-title", "Trabalho não encontrado"),
        el("p", "muted", "O link pode ter mudado."),
        link("Ver portfólio", "portfolio.html" + demoQ, "btn btn--red"));
      vz.append(vw);
      raizEvento.append(vz);
    } else {
      document.title = ev.nome + " · Portfólio · Tardim Produções";
      var meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute("content", ev.nome + ": " + (ehEvento(ev) ? "evento produzido" : "serviço realizado") + " pela Tardim Produções" + (ev.cliente ? " para " + ev.cliente : "") + ".");

      // Topo
      var hero = el("section", "event-hero");
      var hg = el("div", "wrap event-hero__grid");
      var ht = el("div", "event-hero__text");
      ht.append(breadcrumb([["Início", "index.html" + demoQ], ["Portfólio", "portfolio.html" + demoQ], [ev.nome]]));
      var linha = el("div", "case-title");
      if (ev.logo) { var lg = el("img", "case-title__logo"); lg.src = ev.logo; lg.alt = "Logo " + ev.nome; linha.append(lg); }
      else linha.append(iconeEvento(ev, "case-title__logo case-title__icon"));
      var tt = el("div");
      var sub = el("p", "event-hero__date", [ev.ano, area(ev)].filter(Boolean).join(" · "));
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
      ha.append(botaoWa(ehEvento(ev) ? "Quero um evento assim" : "Quero um serviço assim", "Olá! Vi o trabalho \"" + ev.nome + "\" no portfólio da Tardim Produções e quero conversar.", "btn--lg"));
      ht.append(ha);
      hg.append(ht);
      if (ev.capa) { var cp = el("img", "event-hero__poster case-hero__photo"); cp.src = ev.capa; cp.alt = "Imagem: " + ev.nome; hg.append(cp); }
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
      [["Área", area(ev)], ["Cliente", ev.cliente], ["Tipo de cliente", ev.tipo], [ev.data ? "Data" : "Ano", quando], ["Local", ev.local],
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
      if (!temDetalhe) body.append(el("p", "muted case-soon", "Mais fotos e detalhes deste trabalho serão publicados em breve."));
      raizEvento.append(body);

      // Galeria
      if (ev.fotos && ev.fotos.length) {
        var gal = el("section", "block gallery case-gallery");
        var gw = el("div", "wrap");
        var head = el("div", "carousel-head");
        var hh = el("div"); hh.append(el("h2", null, "Fotos"));
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
        trilho.setAttribute("aria-label", "Fotos: " + ev.nome);
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
        var ohh = el("div"); ohh.append(el("h2", null, "Outros trabalhos"));
        oh.append(ohh, link("Ver portfólio completo →", "portfolio.html" + demoQ, "race-card__more"));
        ow.append(oh);
        var og = el("div", "case-grid");
        outros.forEach(function (e) { og.append(card(e)); });
        ow.append(og);
        os.append(ow);
        raizEvento.append(os);
      }
      raizEvento.append(ctaFinal(ev.nome, ehEvento(ev)));
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
