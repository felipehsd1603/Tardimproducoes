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
    return window.DEMO ? "prova.html?id=" + encodeURIComponent(id || "") + "&demo=1" : "prova-" + id + ".html";
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

  // ---------- Calendário: próximas provas e edições anteriores, com filtros ----------
  var lista = document.getElementById("proximas");
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function semAcento(s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function linkTrabalho(id) {
    return window.DEMO ? "evento.html?id=" + encodeURIComponent(id || "") + "&demo=1" : "trabalho-" + id + ".html";
  }
  function dataLonga(d) {
    var dia = DIAS[d.getDay()];
    return cap(dia.slice(0, 3)) + ", " + d.getDate() + " de " + MESES[d.getMonth()] + " de " + d.getFullYear();
  }

  // Próximas provas
  var itensProx = proximas.map(function (ev) {
    var d = data(ev.data);
    return { tipo: "prox", ev: ev, nome: ev.nome, d: d, ano: d.getFullYear(), mes: d.getMonth(),
      dist: distancias(ev), busca: ev.nome + " " + (ev.local || "") };
  });

  // Edições anteriores: cada edição/etapa das corridas do portfólio (serviços de incêndio ficam de fora)
  var itensReal = [];
  (typeof REALIZADAS !== "undefined" ? REALIZADAS : []).forEach(function (r) {
    if (r.icone === "incendio" || (r.area && r.area !== "Eventos esportivos")) return;
    var eds = r.edicoes && r.edicoes.length ? r.edicoes : [{ rotulo: r.nome, data: r.data || r.ano || "", local: r.local }];
    eds.forEach(function (ed) {
      var s = String(ed.data || "");
      var m = /^(\d{4})(?:-(\d{2})-(\d{2}))?$/.exec(s);
      var d = m && m[2] ? data(s) : null;
      if (d && d > hoje) return;
      var local = ed.local || "";
      if (ed.cidade && semAcento(local.toLowerCase()).indexOf(semAcento(ed.cidade.toLowerCase())) < 0) local = local ? local + ", " + ed.cidade : ed.cidade;
      // "Etapa Contagem", "3ª edição"... ganham o nome da corrida no título
      var rot = ed.rotulo || "";
      var parcial = !rot || /^(etapa\b|\d+\s*[ªºa°o]?\s*(edição|etapa|campeonato))/i.test(rot);
      var nome = parcial ? r.nome : rot;
      var sub = parcial && rot ? rot : "";
      itensReal.push({ tipo: "real", r: r, ed: ed, nome: nome, sub: sub, d: d, chave: s,
        ano: m ? Number(m[1]) : null, mes: d ? d.getMonth() : null, local: local, dist: [],
        busca: nome + " " + r.nome + " " + local + " " + (r.cliente || "") });
    });
  });
  itensReal.sort(function (a, b) { return b.chave.localeCompare(a.chave); });

  function cardProx(it) {
    var ev = it.ev, d = it.d;
    var item = el("article", "race race-card");
    var detalhe = linkProva(ev.id);
    var thumb = el("a", "race-card__thumb");
    thumb.href = detalhe;
    thumb.setAttribute("aria-label", "Ver detalhes: " + ev.nome);
    thumb.tabIndex = -1;
    if (ev.poster) {
      var img = el("img");
      img.src = ev.poster; img.alt = ""; img.loading = "lazy";
      thumb.append(img);
    } else {
      thumb.classList.add("race-card__thumb--date");
      thumb.append(el("b", null, String(d.getDate())), el("span", null, MESES[d.getMonth()].slice(0, 3)));
    }
    item.append(thumb);

    var corpo = el("div", "race-card__body");
    var titulo = el("h4", "race-card__name");
    var tl = el("a", null, ev.nome);
    tl.href = detalhe;
    titulo.append(tl);
    corpo.append(titulo);
    var quando = el("p", "race-card__date", dataLonga(d) + (ev.hora ? " · " + ev.hora : ""));
    if (ev.demo) quando.append(" ", el("span", "tag-demo", "Exemplo"));
    corpo.append(quando);
    var percursos = Array.isArray(ev.percursos) ? ev.percursos : (ev.percursos ? [ev.percursos] : []);
    if (percursos.length) corpo.append(el("p", "race-card__dist", percursos.join(" • ")));
    if (ev.local) corpo.append(el("p", "race-card__place", ev.local));

    var acoes = el("div", "race-card__actions");
    var a = el("a", "btn btn--red btn--sm", "Inscreva-se ↗");
    a.href = ev.inscricao || linkPadrao;
    a.target = "_blank";
    a.rel = "noopener";
    a.setAttribute("aria-label", "Inscreva-se na " + ev.nome + " (abre em nova aba)");
    var ver = el("a", "race-card__more", "Saber mais");
    ver.href = detalhe;
    ver.setAttribute("aria-label", "Saber mais sobre a " + ev.nome);
    acoes.append(a, ver);
    corpo.append(acoes);
    item.append(corpo);
    return item;
  }

  function cardReal(it) {
    var r = it.r, d = it.d;
    var item = el("article", "race race-card race-card--past");
    var detalhe = linkTrabalho(r.id);
    var thumb = el("a", "race-card__thumb");
    thumb.href = detalhe;
    thumb.setAttribute("aria-label", "Ver no portfólio: " + it.nome);
    thumb.tabIndex = -1;
    if (r.logo) {
      thumb.classList.add("race-card__thumb--logo");
      var img = el("img");
      img.src = r.logo; img.alt = ""; img.loading = "lazy";
      thumb.append(img);
    } else {
      thumb.classList.add("race-card__thumb--date");
      if (d) thumb.append(el("b", null, String(d.getDate())), el("span", null, MESES[d.getMonth()].slice(0, 3) + " " + d.getFullYear()));
      else thumb.append(el("b", null, it.ano ? String(it.ano) : "—"));
    }
    item.append(thumb);

    var corpo = el("div", "race-card__body");
    var titulo = el("h4", "race-card__name");
    var tl = el("a", null, it.nome);
    tl.href = detalhe;
    titulo.append(tl);
    corpo.append(titulo);
    var quando = el("p", "race-card__date");
    quando.append(el("span", "tag-past", "Realizada"), " ", d ? dataLonga(d) : (it.ano ? "Em " + it.ano : "Data não informada"));
    if (r.demo) quando.append(" ", el("span", "tag-demo", "Exemplo"));
    if (it.sub) corpo.append(el("p", "race-card__dist", it.sub));
    corpo.append(quando);
    if (it.local) corpo.append(el("p", "race-card__place", it.local));
    if (it.ed && it.ed.obs) corpo.append(el("p", "race-card__obs", it.ed.obs));
    var acoes = el("div", "race-card__actions");
    var ver = el("a", "race-card__more", "Ver no portfólio →");
    ver.href = detalhe;
    ver.setAttribute("aria-label", "Ver " + r.nome + " no portfólio");
    acoes.append(ver);
    corpo.append(acoes);
    item.append(corpo);
    return item;
  }

  // Barra de filtros
  var POR_PAGINA = 12;
  var estado = { aba: itensProx.length ? "prox" : "real", q: "", ano: "", mes: "", dist: "", limite: POR_PAGINA };
  var barra = el("div", "cal-tools");

  var abas = el("div", "cal-tabs");
  abas.setAttribute("role", "group");
  abas.setAttribute("aria-label", "Mostrar provas");
  [["prox", "Próximas", itensProx.length], ["real", "Edições anteriores", itensReal.length]].forEach(function (t) {
    var b = el("button", "cal-tab");
    b.type = "button";
    b.setAttribute("data-v", t[0]);
    b.append(t[1] + " ", el("span", "cal-tab__n", String(t[2])));
    b.addEventListener("click", function () {
      if (estado.aba === t[0]) return;
      estado.aba = t[0]; estado.ano = ""; estado.mes = ""; estado.dist = ""; estado.limite = POR_PAGINA;
      render();
    });
    abas.append(b);
  });
  barra.append(abas);

  var linha = el("div", "cal-filters");
  var busca = el("label", "cal-search");
  busca.append(el("span", "sr-only", "Buscar provas por nome ou local"));
  var campo = el("input");
  campo.type = "search";
  campo.placeholder = "Buscar por nome ou local…";
  campo.autocomplete = "off";
  busca.append(campo);
  linha.append(busca);

  function seletor(rotulo) {
    var w = el("label", "cal-select");
    w.append(el("span", "sr-only", rotulo));
    var s = el("select");
    w.append(s);
    linha.append(w);
    return s;
  }
  var selAno = seletor("Filtrar por ano");
  var selMes = seletor("Filtrar por mês");
  var limpar = el("button", "cal-clear", "Limpar filtros");
  limpar.type = "button";
  linha.append(limpar);
  barra.append(linha);

  var filtroDist = el("div", "dist-filter");
  filtroDist.setAttribute("role", "group");
  filtroDist.setAttribute("aria-label", "Filtrar provas por distância");
  barra.append(filtroDist);

  var resumo = el("p", "cal-count");
  resumo.setAttribute("aria-live", "polite");
  barra.append(resumo);

  var aviso = el("p", "muted dist-filter__empty", "Nenhuma prova encontrada com esses filtros.");
  var mais = el("button", "btn btn--ghost cal-more");
  mais.type = "button";
  mais.addEventListener("click", function () { estado.limite += POR_PAGINA; render(); });

  lista.parentNode.insertBefore(barra, lista);
  lista.parentNode.insertBefore(aviso, lista.nextSibling);
  lista.parentNode.insertBefore(mais, aviso.nextSibling);

  function opcoes(sel, valores, todos, atual) {
    sel.innerHTML = "";
    var o = el("option", null, todos);
    o.value = "";
    sel.append(o);
    valores.forEach(function (v) {
      var op = el("option", null, v[1]);
      op.value = v[0];
      sel.append(op);
    });
    sel.value = atual;
  }

  function render() {
    var itens = estado.aba === "prox" ? itensProx : itensReal;
    abas.querySelectorAll("button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-v") === estado.aba));
    });

    // Anos e meses disponíveis na aba (meses dentro do ano escolhido)
    var anos = {};
    itens.forEach(function (it) { if (it.ano) anos[it.ano] = true; });
    var listaAnos = Object.keys(anos).sort(function (a, b) { return estado.aba === "prox" ? a - b : b - a; });
    if (estado.ano && !anos[estado.ano]) estado.ano = "";
    opcoes(selAno, listaAnos.map(function (a) { return [a, a]; }), "Todos os anos", estado.ano);
    var meses = {};
    itens.forEach(function (it) { if (it.mes !== null && (!estado.ano || String(it.ano) === estado.ano)) meses[it.mes] = true; });
    if (estado.mes !== "" && !meses[estado.mes]) estado.mes = "";
    opcoes(selMes, Object.keys(meses).sort(function (a, b) { return a - b; }).map(function (m) { return [m, cap(MESES[m])]; }), "Todos os meses", estado.mes);
    selAno.parentNode.hidden = listaAnos.length < 2;
    selMes.parentNode.hidden = Object.keys(meses).length < 2;

    // Distâncias (só nas próximas, com 2 ou mais distâncias diferentes)
    var todas = {};
    itens.forEach(function (it) { it.dist.forEach(function (k) { todas[k] = true; }); });
    var chaves = Object.keys(todas).sort(function (a, b) { return parseFloat(a.replace(",", ".")) - parseFloat(b.replace(",", ".")); });
    filtroDist.innerHTML = "";
    filtroDist.hidden = chaves.length < 2;
    if (chaves.length >= 2) {
      [""].concat(chaves).forEach(function (k) {
        var b = el("button", "dist-chip", k === "" ? "Todas as distâncias" : k + " km");
        b.type = "button";
        b.setAttribute("aria-pressed", String(k === estado.dist));
        b.addEventListener("click", function () { estado.dist = k; estado.limite = POR_PAGINA; render(); });
        filtroDist.append(b);
      });
    }

    var termo = semAcento(estado.q.trim().toLowerCase());
    var filtrados = itens.filter(function (it) {
      if (estado.ano && String(it.ano) !== estado.ano) return false;
      if (estado.mes !== "" && String(it.mes) !== estado.mes) return false;
      if (estado.dist && it.dist.indexOf(estado.dist) < 0) return false;
      if (termo && semAcento(it.busca.toLowerCase()).indexOf(termo) < 0) return false;
      return true;
    });
    var algumFiltro = !!(termo || estado.ano || estado.mes !== "" || estado.dist);
    limpar.hidden = !algumFiltro;

    // Lista agrupada por mês
    lista.innerHTML = "";
    var grupos = {};
    filtrados.slice(0, estado.limite).forEach(function (it) {
      var chave, titulo;
      if (it.mes !== null) { chave = it.ano + "-" + it.mes; titulo = cap(MESES[it.mes]) + " " + it.ano; }
      else if (it.ano) { chave = it.ano + "-x"; titulo = it.ano + " · mês não informado"; }
      else { chave = "x"; titulo = "Data não informada"; }
      if (!grupos[chave]) {
        var g = el("section", "month-group");
        g.append(el("h3", "month-title", titulo));
        var rr = el("div", "races");
        g.append(rr);
        grupos[chave] = rr;
        lista.append(g);
      }
      grupos[chave].append(it.tipo === "prox" ? cardProx(it) : cardReal(it));
    });

    var vazioProx = estado.aba === "prox" && !itensProx.length;
    document.getElementById("sem-provas").hidden = !vazioProx;
    aviso.hidden = filtrados.length > 0 || vazioProx;
    var n = filtrados.length;
    var palavra = estado.aba === "prox" ? (n === 1 ? "prova aberta" : "provas abertas") : (n === 1 ? "edição realizada" : "edições realizadas");
    resumo.textContent = n ? n + " " + palavra + (n > estado.limite ? " · mostrando " + estado.limite : "") : "";
    var resta = n - estado.limite;
    mais.hidden = resta <= 0;
    mais.textContent = "Ver mais edições (" + resta + ")";
  }

  campo.addEventListener("input", function () { estado.q = campo.value; estado.limite = POR_PAGINA; render(); });
  selAno.addEventListener("change", function () { estado.ano = selAno.value; estado.limite = POR_PAGINA; render(); });
  selMes.addEventListener("change", function () { estado.mes = selMes.value; estado.limite = POR_PAGINA; render(); });
  limpar.addEventListener("click", function () {
    estado.q = ""; campo.value = ""; estado.ano = ""; estado.mes = ""; estado.dist = ""; estado.limite = POR_PAGINA;
    render();
  });
  render();

  // ---------- Card "próxima prova" na abertura ----------
  if (proximas.length) {
    var p = proximas[0];
    var dp = data(p.data);
    var dias = Math.round((dp - hoje) / 86400000);
    var nomeEl = document.getElementById("next-name");
    var nomeLink = el("a", null, p.nome);
    nomeLink.href = linkProva(p.id);
    nomeEl.append(nomeLink);
    // Contagem regressiva ao vivo até a largada
    var caixa = document.getElementById("next-days").parentNode;
    caixa.className = "next-card__clock";
    caixa.setAttribute("aria-label", "Tempo até a largada");
    caixa.innerHTML = "";
    var alvo = data(p.data);
    var mh = /(\d{1,2})h(\d{2})?/.exec(p.hora || "");
    alvo.setHours(mh ? Number(mh[1]) : 7, mh && mh[2] ? Number(mh[2]) : 0, 0, 0);
    var partes = [["d", "dias"], ["h", "horas"], ["m", "min"], ["s", "seg"]].map(function (u) {
      var box = el("span", "clock__box");
      var n = el("b", null, "00");
      box.append(n, el("small", null, u[1]));
      caixa.append(box);
      return n;
    });
    var dois = function (n) { return (n < 10 ? "0" : "") + n; };
    var tique = function () {
      var t = Math.max(0, Math.floor((alvo - new Date()) / 1000));
      if (t === 0) { caixa.innerHTML = "<b class=\"clock__hoje\">É hoje!</b>"; return false; }
      partes[0].textContent = Math.floor(t / 86400);
      partes[1].textContent = dois(Math.floor(t % 86400 / 3600));
      partes[2].textContent = dois(Math.floor(t % 3600 / 60));
      partes[3].textContent = dois(t % 60);
      return true;
    };
    if (tique()) { var relogio = setInterval(function () { if (!tique()) clearInterval(relogio); }, 1000); }
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
  (typeof REALIZADAS !== "undefined" ? REALIZADAS : []).filter(function (r) { return r.logo; }).forEach(function (r) {
    var li = el("li");
    var a = el("a", "logos__link");
    a.href = window.DEMO ? "evento.html?id=" + encodeURIComponent(r.id || "") + "&demo=1" : "trabalho-" + r.id + ".html";
    var img = el("img");
    img.src = r.logo;
    img.alt = "";
    img.loading = "lazy";
    img.width = 300;
    img.height = 300;
    a.append(img, el("span", null, r.nome));
    if (r.ano || r.demo) {
      var sm = el("small", null, r.ano || "");
      if (r.demo) sm.append(" ", el("span", "tag-demo", "Exemplo"));
      a.append(sm);
    }
    li.append(a);
    logos.append(li);
  });
  if (window.DEMO) document.getElementById("ver-portfolio").href = "portfolio.html?demo=1";

  // ---------- Faixa de confiança: números + clientes ----------
  var trustStats = document.getElementById("trust-stats");
  if (trustStats) {
    var reais = (typeof REALIZADAS !== "undefined" ? REALIZADAS : []).filter(function (r) { return !r.demo; });
    var clientesUnicos = {};
    reais.forEach(function (r) { if (r.cliente) clientesUnicos[r.cliente] = true; });
    var orgaos = {};
    reais.forEach(function (r) { if (r.tipo === "Órgão público" && r.cliente) orgaos[r.cliente] = true; });
    var nCorridas = 0, cidades = {};
    reais.forEach(function (r) {
      if (r.icone === "incendio" || r.area === "Prevenção contra incêndio") return;
      (r.edicoes || []).forEach(function (ed) { nCorridas++; if (ed.cidade) cidades[ed.cidade] = true; });
    });
    var itens = [];
    itens.push([nCorridas, "corridas organizadas"]);
    itens.push([Object.keys(cidades).length, "cidades de Minas Gerais"]);
    itens.push([Object.keys(orgaos).length, "órgãos públicos atendidos"]);
    itens.push([Object.keys(clientesUnicos).length, "instituições e empresas atendidas"]);
    itens.forEach(function (it) {
      var d = el("div", "trust__stat");
      var b = el("b", null, "+" + it[0]);
      b.setAttribute("data-count", String(it[0]));
      b.setAttribute("data-prefix", "+");
      d.append(b, el("span", null, it[1]));
      trustStats.append(d);
    });

    // Nomes dos clientes passando (usa a mesma lista do bloco Institucional)
    var nomes = Array.prototype.map.call(document.querySelectorAll(".inst__clients li"), function (li) { return li.textContent; });
    var track = document.getElementById("marquee");
    [0, 1].forEach(function () {
      nomes.forEach(function (n) { track.append(el("span", "marquee__item", n)); });
    });
    document.getElementById("trust-clientes").textContent = "Clientes atendidos: " + nomes.join(", ") + ".";
  }

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

    // Linha discreta com razão social e CNPJ
    var legal = document.getElementById("inst-legal");
    if (legal) legal.textContent = [SITE.razaoSocial, SITE.cnpj ? "CNPJ " + SITE.cnpj : ""].filter(Boolean).join(" · ");
    if (SITE.cnpj) {
      document.getElementById("footer-legal").textContent =
        (SITE.razaoSocial || "Tardim Produções e Eventos Ltda") + " · CNPJ " + SITE.cnpj;
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
