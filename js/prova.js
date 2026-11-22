(function () {
  "use strict";

  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
    "agosto", "setembro", "outubro", "novembro", "dezembro"];
  var DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

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
  function link(text, href, cls, externo) {
    var a = el("a", cls, text);
    a.href = href;
    if (externo) { a.target = "_blank"; a.rel = "noopener"; }
    return a;
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  var site = typeof SITE !== "undefined" ? SITE : {};
  var provas = typeof PROXIMAS !== "undefined" ? PROXIMAS : [];
  var id = window.PAGINA_ID || new URLSearchParams(location.search).get("id");
  var ev = provas.filter(function (p) { return p.id === id; })[0];
  var raiz = document.getElementById("prova");
  var demoQ = window.DEMO ? "?demo=1" : "";

  function wa(msg) {
    return "https://wa.me/" + (site.whatsapp || "") + "?text=" + encodeURIComponent(msg);
  }

  // ---------- Prova não encontrada ----------
  if (!ev) {
    var vazio = el("section", "block");
    var w = el("div", "wrap");
    w.append(
      el("h1", "page-title", "Prova não encontrada"),
      el("p", "muted", "Essa prova pode ter sido encerrada ou o link mudou."),
      link("Ver calendário de provas", "index.html" + demoQ + "#calendario", "btn btn--red")
    );
    vazio.append(w);
    raiz.append(vazio);
    document.getElementById("wa-float").href = wa("Olá! Vim pelo site da Tardim Produções.");
    document.getElementById("ano").textContent = new Date().getFullYear();
    return;
  }

  var d = data(ev.data);
  var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  var dias = Math.round((d - hoje) / 86400000);
  var inscricao = ev.inscricao || site.linktree || "#";
  var percursos = Array.isArray(ev.percursos) ? ev.percursos : (ev.percursos ? [ev.percursos] : []);
  var quando = cap(DIAS[d.getDay()]) + ", " + d.getDate() + " de " + MESES[d.getMonth()] + " de " + d.getFullYear();

  document.title = ev.nome + " · Tardim Produções";
  var meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", ev.nome + ": " + quando + (ev.local ? ", " + ev.local : "") + ". Inscrições, kit, percursos e programação.");

  // ---------- Topo da prova ----------
  var topo = el("section", "event-hero");
  var tw = el("div", "wrap event-hero__grid");
  var txt = el("div", "event-hero__text");

  // Breadcrumb: Início › Calendário › Prova
  var inicio = "index.html" + demoQ;
  var bc = el("nav", "breadcrumb");
  bc.setAttribute("aria-label", "Você está em");
  var ol = el("ol");
  var li1 = el("li"); li1.append(link("Início", inicio));
  var li2 = el("li"); li2.append(link("Calendário", inicio + "#calendario"));
  var li3 = el("li"); var atual = el("span", null, ev.nome); atual.setAttribute("aria-current", "page"); li3.append(atual);
  ol.append(li1, li2, li3);
  bc.append(ol);
  txt.append(bc);

  var dataLinha = el("p", "event-hero__date", quando + (ev.hora ? " · largada às " + ev.hora : ""));
  if (ev.demo) dataLinha.append(" ", el("span", "tag-demo", "Exemplo"));
  txt.append(dataLinha);
  txt.append(el("h1", null, ev.nome));
  if (ev.local) txt.append(el("p", "event-hero__place", ev.local));

  if (percursos.length) {
    var chips = el("div", "chips");
    percursos.forEach(function (p) { chips.append(el("span", "chip", p)); });
    txt.append(chips);
  }

  if (dias >= 0) {
    var cd = el("p", "event-hero__count");
    if (dias === 0) cd.append(el("b", null, "É hoje!"));
    else if (dias === 1) cd.append(el("b", null, "Amanhã!"));
    else cd.append(el("b", null, String(dias)), " dias para a largada");
    txt.append(cd);
  } else {
    txt.append(el("p", "event-hero__count", "Prova realizada"));
  }

  var acoes = el("div", "actions");
  if (dias >= 0) acoes.append(link("Fazer inscrição", inscricao, "btn btn--red btn--lg", true));

  // Salvar na agenda
  var ymd = ev.data.replace(/-/g, "");
  var fim = new Date(d.getTime() + 86400000);
  var ymdFim = fim.getFullYear() + String(fim.getMonth() + 1).padStart(2, "0") + String(fim.getDate()).padStart(2, "0");
  acoes.append(link("Salvar na agenda",
    "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(ev.nome) +
    "&dates=" + ymd + "/" + ymdFim + "&location=" + encodeURIComponent(ev.local || "") +
    "&details=" + encodeURIComponent((ev.hora ? "Largada " + ev.hora + ". " : "") + "Mais informações: " + location.href),
    "btn btn--white", true));

  // Compartilhar
  var share = el("button", "btn btn--white", "Compartilhar");
  share.type = "button";
  share.addEventListener("click", function () {
    var dados = { title: ev.nome, text: ev.nome + " · " + quando, url: location.href };
    if (navigator.share) {
      navigator.share(dados).catch(function () {});
    } else {
      window.open("https://wa.me/?text=" + encodeURIComponent(dados.text + " " + dados.url), "_blank", "noopener");
    }
  });
  acoes.append(share);
  txt.append(acoes);
  tw.append(txt);

  if (ev.poster) {
    var pi = el("img", "event-hero__poster");
    pi.src = ev.poster;
    pi.alt = "Arte de divulgação: " + ev.nome;
    pi.width = 399; pi.height = 531;
    tw.append(pi);
  }
  topo.append(tw);
  raiz.append(topo);

  // ---------- Navegação interna + seções ----------
  var secoes = [];
  var faltando = [];

  function secao(id, titulo, conteudo) {
    var s = el("section", "event-sec");
    s.id = id;
    s.append(el("h2", null, titulo), conteudo);
    secoes.push({ id: id, titulo: titulo, el: s });
  }

  // Informações
  var info = el("div");
  if (ev.resumo) info.append(el("p", "event-lead", ev.resumo));
  var dl = el("dl", "facts");
  var mapa = ev.local ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(ev.local) : "";
  [["Data", quando], ["Largada", ev.hora], ["Local", ev.local], ["Percursos", percursos.join(" · ")], ["Realização", ev.realizacao]]
    .forEach(function (f) {
      if (!f[1]) return;
      var dd = el("dd", null, f[1]);
      if (f[0] === "Local" && mapa) { dd.append(" "); dd.append(link("Abrir no mapa", mapa, "facts__map", true)); }
      dl.append(el("dt", null, f[0]), dd);
    });
  info.append(dl);
  secao("informacoes", "Informações", info);

  // Valores
  if (ev.valores && ev.valores.length) {
    var tab = el("ul", "prices");
    ev.valores.forEach(function (v) {
      var li = el("li", v.esgotado ? "is-soldout" : null);
      var nome = el("div", "prices__name");
      nome.append(el("strong", null, v.nome));
      if (v.detalhe) nome.append(el("span", null, v.detalhe));
      li.append(nome, el("span", "prices__value", v.esgotado ? "Esgotado" : v.valor));
      tab.append(li);
    });
    var vwrap = el("div");
    vwrap.append(tab);
    if (dias >= 0) vwrap.append(link("Fazer inscrição", inscricao, "btn btn--red", true));
    secao("valores", "Valores", vwrap);
  } else faltando.push("valores");

  // Kit
  var kit = ev.kit || {};
  if ((kit.itens && kit.itens.length) || kit.retirada) {
    var kwrap = el("div");
    if (kit.itens && kit.itens.length) {
      var ul = el("ul", "checklist");
      kit.itens.forEach(function (i) { ul.append(el("li", null, i)); });
      kwrap.append(ul);
    }
    if (kit.retirada) {
      var r = el("p", "kit-pickup");
      r.append(el("strong", null, "Retirada do kit: "), kit.retirada);
      kwrap.append(r);
    } else {
      faltando.push("local e horário de retirada do kit");
    }
    secao("kit", "Kit do atleta", kwrap);
  } else faltando.push("kit do atleta");

  // Programação
  if (ev.programacao && ev.programacao.length) {
    var tl = el("ol", "timeline");
    ev.programacao.forEach(function (p) {
      var li = el("li");
      li.append(el("time", null, p[0]), el("span", null, p[1]));
      tl.append(li);
    });
    secao("programacao", "Programação do dia", tl);
  } else faltando.push("programação do dia");

  // Premiação
  if (ev.premiacao) secao("premiacao", "Premiação", el("p", null, ev.premiacao));

  // Percurso, regulamento, resultados e fotos
  var docs = el("div", "doc-links");
  [["Mapa do percurso", ev.percursoMapa], ["Regulamento", ev.regulamento], ["Resultados", ev.resultados], ["Fotos", ev.fotos]]
    .forEach(function (dct) { if (dct[1]) docs.append(link(dct[0] + " →", dct[1], "doc-link", true)); });
  if (docs.children.length) secao("documentos", "Percurso, regulamento e resultados", docs);
  if (!ev.percursoMapa) faltando.push("mapa do percurso");
  if (!ev.regulamento) faltando.push("regulamento");

  // Dúvidas
  var duv = el("div", "event-help");
  var duvTxt = el("div");
  duvTxt.append(el("h2", null, "Ficou com dúvida?"));
  if (faltando.length) {
    duvTxt.append(el("p", null, "Em breve publicaremos aqui: " + faltando.join(", ") + ". Enquanto isso, fale com a Tardim Produções."));
  } else {
    duvTxt.append(el("p", null, "Fale com a Tardim Produções pelo WhatsApp."));
  }
  var duvBtn = link("", wa("Olá! Tenho uma dúvida sobre a " + ev.nome + "."), "btn btn--wa", true);
  duvBtn.innerHTML = '<svg aria-hidden="true"><use href="#i-whatsapp"/></svg>';
  duvBtn.append("Tirar dúvida no WhatsApp");
  duv.append(duvTxt, duvBtn);

  // Monta: sub-navegação + seções
  var corpo = el("div", "wrap event-body");
  if (secoes.length > 1) {
    var sub = el("nav", "subnav");
    sub.setAttribute("aria-label", "Seções da prova");
    secoes.forEach(function (s) { sub.append(link(s.titulo, "#" + s.id)); });
    var subWrap = el("div", "subnav-wrap");
    subWrap.append(sub);
    raiz.append(subWrap);
  }
  secoes.forEach(function (s) { corpo.append(s.el); });
  corpo.append(duv);
  raiz.append(corpo);

  // Outras provas
  var outras = provas.filter(function (p) { return p.id !== ev.id && p.data && data(p.data) >= hoje; });
  if (outras.length) {
    var os = el("section", "block block--paper");
    var ow = el("div", "wrap");
    ow.append(el("h2", null, "Outras provas"));
    var grid = el("div", "other-races");
    outras.forEach(function (p) {
      var pd = data(p.data);
      var a = el("a", "other-race");
      a.href = window.DEMO ? "prova.html?id=" + encodeURIComponent(p.id) + "&demo=1" : "prova-" + p.id + ".html";
      if (p.poster) { var im = el("img"); im.src = p.poster; im.alt = ""; im.loading = "lazy"; a.append(im); }
      var t = el("div");
      t.append(el("span", null, pd.getDate() + " de " + MESES[pd.getMonth()] + " de " + pd.getFullYear()), el("strong", null, p.nome));
      a.append(t);
      grid.append(a);
    });
    ow.append(grid);
    os.append(ow);
    raiz.append(os);
  }

  // Dados estruturados do breadcrumb
  var base = location.href.replace(/[^/]*$/, "");
  var bld = document.createElement("script");
  bld.type = "application/ld+json";
  bld.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: base + "index.html" },
      { "@type": "ListItem", position: 2, name: "Calendário", item: base + "index.html#calendario" },
      { "@type": "ListItem", position: 3, name: ev.nome },
    ],
  });
  document.head.append(bld);

  // Dados estruturados
  var ld = document.createElement("script");
  ld.type = "application/ld+json";
  ld.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: ev.nome,
    startDate: ev.data,
    description: ev.resumo || undefined,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: { "@type": "Place", name: ev.local, address: ev.local },
    image: ev.poster ? new URL(ev.poster, location.href).href : undefined,
    organizer: { "@type": "Organization", name: "Tardim Produções" },
    url: location.href,
  });
  document.head.append(ld);

  // WhatsApp flutuante com mensagem da prova
  document.getElementById("wa-float").href = wa("Olá! Tenho uma dúvida sobre a " + ev.nome + ".");

  // Menu no celular
  var btn = document.querySelector(".menu-btn");
  btn.addEventListener("click", function () {
    var open = document.body.classList.toggle("menu-open");
    btn.setAttribute("aria-expanded", String(open));
    btn.textContent = open ? "Fechar" : "Menu";
  });

  document.getElementById("ano").textContent = new Date().getFullYear();
})();
