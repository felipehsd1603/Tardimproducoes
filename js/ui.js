/*
 * Interface: animações sutis ao rolar, contagem dos números e menu ao rolar.
 * Respeita quem pediu ao sistema para reduzir animações.
 */
(function () {
  "use strict";
  var reduz = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Menu ganha sombra ao rolar ----------
  var topo = document.querySelector(".topbar");
  if (topo) {
    var aoRolar = function () { topo.classList.toggle("is-scrolled", window.scrollY > 8); };
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
  }

  // ---------- Medição (functions/api/evento.js): só soma totais por dia, sem identificar ninguém ----------
  // Conta cliques em [data-medir] (data-ref opcional) e em links do WhatsApp; o painel mostra na aba "Medição".
  var pagina = window.PAGINA_ID || (location.pathname.split("/").pop() || "index").replace(/\.html$/, "") || "index";
  var medeAqui = /^https?:$/.test(location.protocol) && !window.DEMO && !document.getElementById("painel");
  function medir(evento, ref) {
    if (!medeAqui) return;
    ref = String(ref || pagina).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
    if (!ref) return;
    try {
      fetch("/api/evento", { method: "POST", keepalive: true, headers: { "content-type": "application/json" }, body: JSON.stringify({ e: evento, r: ref }) })
        .catch(function () {});
    } catch (e) {}
  }
  window.MEDIR = medir;
  document.addEventListener("click", function (e) {
    var alvo = e.target.closest ? e.target.closest("[data-medir], a[href*='wa.me/']") : null;
    if (!alvo) return;
    medir(alvo.getAttribute("data-medir") || "whatsapp", alvo.getAttribute("data-ref"));
  });
  // Visitas só das páginas onde se decide: cada prova e a página de quem contrata
  if (document.getElementById("prova") || document.getElementById("orc-form")) medir("visita");

  // ---------- Depoimentos cadastrados no painel (chegam pelo js/provas-db.js) ----------
  // <div data-depoimentos="empresas|inicio" data-max="2">: o bloco (ou a seção em volta) fica oculto até ter o que mostrar
  var depo = typeof DEPOIMENTOS !== "undefined" && Array.isArray(DEPOIMENTOS) ? DEPOIMENTOS : [];
  document.querySelectorAll("[data-depoimentos]").forEach(function (box) {
    var onde = box.getAttribute("data-depoimentos");
    var lista = depo.filter(function (d) { return d.onde === onde || d.onde === "ambas"; })
      .slice(0, Number(box.getAttribute("data-max")) || 6);
    if (!lista.length) return;
    lista.forEach(function (d) {
      var fig = document.createElement("figure");
      fig.className = "depo";
      var q = document.createElement("blockquote");
      q.textContent = d.texto;
      var cap = document.createElement("figcaption");
      var n = document.createElement("strong");
      n.textContent = d.nome;
      cap.append(n);
      if (d.cargo) { var s = document.createElement("span"); s.textContent = d.cargo; cap.append(s); }
      fig.append(q, cap);
      box.append(fig);
    });
    var oculto = box.closest("[hidden]");
    if (oculto) oculto.hidden = false;
  });

  if (!("IntersectionObserver" in window)) return;

  // ---------- Elementos aparecem ao entrar na tela ----------
  var seletores = [
    ".block__head", ".carousel-head", ".race-card", ".case-card", ".logos li", ".offers article",
    ".bento__item", ".creds li", ".steps li", ".event-sec", ".slide", ".inst > div", ".trust__stat",
    ".contact__grid > *", ".other-race", ".month-title", ".highlights li", ".testimonial", ".depo",
  ];
  if (!reduz) {
    document.documentElement.classList.add("anim");
    var alvos = document.querySelectorAll(seletores.join(","));
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        obs.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    alvos.forEach(function (el) {
      // Pequeno atraso em sequência entre irmãos (no máximo 5 passos)
      var irmaos = el.parentNode ? Array.prototype.indexOf.call(el.parentNode.children, el) : 0;
      el.style.setProperty("--d", Math.min(irmaos, 5) * 70 + "ms");
      el.classList.add("reveal");
      obs.observe(el);
    });
    // Segurança: se algo não disparar, mostra tudo depois de 3 s
    setTimeout(function () {
      document.querySelectorAll(".reveal:not(.is-in)").forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight) el.classList.add("is-in");
      });
    }, 3000);
  }

  // ---------- Números contam de 0 até o valor ----------
  var numeros = document.querySelectorAll("[data-count], .pf-stat b");
  function formata(n) { return Math.round(n).toLocaleString("pt-BR"); }
  var obsNum = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) {
      if (!e.isIntersecting) return;
      obsNum.unobserve(e.target);
      var el = e.target;
      var alvo = Number(el.getAttribute("data-count") || el.textContent.replace(/\D/g, ""));
      var prefixo = el.getAttribute("data-prefix") || "";
      if (!alvo || reduz) return;
      var inicio = null;
      var dur = 1100;
      function passo(t) {
        if (inicio === null) inicio = t;
        var p = Math.min(1, (t - inicio) / dur);
        var suave = 1 - Math.pow(1 - p, 3);
        el.textContent = prefixo + formata(alvo * suave);
        if (p < 1) requestAnimationFrame(passo);
        else el.textContent = prefixo + formata(alvo);
      }
      requestAnimationFrame(passo);
    });
  }, { threshold: 0.6 });
  numeros.forEach(function (n) { obsNum.observe(n); });
})();

/*
 * Barra de "percurso" no topo, título animado na abertura e fotos em tela cheia.
 */
(function () {
  "use strict";
  var reduz = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Barra de percurso: avança conforme a página rola ----------
  var topo = document.querySelector(".topbar");
  if (topo) {
    var barra = document.createElement("div");
    barra.className = "percurso";
    barra.setAttribute("aria-hidden", "true");
    barra.innerHTML = '<div class="percurso__fill"><span class="percurso__runner"><svg viewBox="0 0 24 24"><path d="M13.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3A7.3 7.3 0 0 0 19 13v-2a5.1 5.1 0 0 1-4.4-2.4l-1-1.6a2 2 0 0 0-1.7-1c-.3 0-.5 0-.8.1L6 8.3V13h2V9.6l1.8-.7"/></svg></span></div><span class="percurso__chegada"></span>';
    topo.append(barra);
    var fill = barra.firstChild;
    var atualiza = function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      // O corredor nunca passa da borda da tela
      fill.style.width = "calc(" + (p * 100).toFixed(2) + "% + " + (8 - p * 16).toFixed(1) + "px)";
      barra.classList.toggle("is-on", window.scrollY > 40);
      barra.classList.toggle("is-fim", p > 0.995);
    };
    atualiza();
    window.addEventListener("scroll", atualiza, { passive: true });
    window.addEventListener("resize", atualiza);
  }

  // ---------- Título da abertura aparece palavra por palavra ----------
  var titulo = document.querySelector(".hero h1");
  if (titulo && !reduz) {
    var n = 0;
    var embrulha = function (no) {
      Array.prototype.slice.call(no.childNodes).forEach(function (filho) {
        if (filho.nodeType === 3) {
          var frag = document.createDocumentFragment();
          filho.textContent.split(/(\s+)/).forEach(function (parte) {
            if (!parte) return;
            if (/^\s+$/.test(parte)) { frag.append(document.createTextNode(parte)); return; }
            var w = document.createElement("span");
            w.className = "w";
            w.style.setProperty("--w", n++);
            w.textContent = parte;
            frag.append(w);
          });
          no.replaceChild(frag, filho);
        } else if (filho.nodeType === 1) embrulha(filho);
      });
    };
    embrulha(titulo);
    titulo.classList.add("titulo-anim");
  }

  // ---------- Fotos em tela cheia ----------
  var seletor = ".carousel .slide img, .event-hero__poster, .case-hero__photo, .bento__item--hero > img";
  var fotos = Array.prototype.slice.call(document.querySelectorAll(seletor));
  if (!fotos.length) return;

  var caixa = document.createElement("div");
  caixa.className = "lb";
  caixa.setAttribute("role", "dialog");
  caixa.setAttribute("aria-modal", "true");
  caixa.setAttribute("aria-label", "Foto em tela cheia");
  caixa.hidden = true;
  caixa.innerHTML = '<button type="button" class="lb__fechar" aria-label="Fechar">×</button>' +
    '<button type="button" class="lb__nav lb__prev" aria-label="Foto anterior">←</button>' +
    '<figure class="lb__fig"><img alt="" /><figcaption></figcaption></figure>' +
    '<button type="button" class="lb__nav lb__next" aria-label="Próxima foto">→</button>';
  document.body.append(caixa);
  var img = caixa.querySelector("img"), legenda = caixa.querySelector("figcaption");
  var grupo = [], atual = 0, origem = null;

  function grupoDe(el) {
    var trilho = el.closest(".carousel");
    return trilho ? Array.prototype.slice.call(trilho.querySelectorAll(".slide img")) : [el];
  }
  function mostra(i) {
    atual = (i + grupo.length) % grupo.length;
    var f = grupo[atual];
    img.src = f.currentSrc || f.src;
    img.alt = f.alt || "";
    var cap = f.closest("figure") && f.closest("figure").querySelector("figcaption");
    legenda.textContent = cap ? cap.textContent : (f.alt || "");
    caixa.querySelectorAll(".lb__nav").forEach(function (b) { b.hidden = grupo.length < 2; });
  }
  function abre(el) {
    origem = el;
    grupo = grupoDe(el);
    mostra(grupo.indexOf(el));
    caixa.hidden = false;
    document.documentElement.classList.add("lb-aberto");
    requestAnimationFrame(function () { caixa.classList.add("is-on"); });
    caixa.querySelector(".lb__fechar").focus();
  }
  function fecha() {
    caixa.classList.remove("is-on");
    document.documentElement.classList.remove("lb-aberto");
    setTimeout(function () { caixa.hidden = true; }, reduz ? 0 : 200);
    if (origem) origem.focus();
  }
  fotos.forEach(function (f) {
    f.classList.add("zoomavel");
    f.tabIndex = 0;
    f.setAttribute("role", "button");
    f.setAttribute("aria-label", "Ampliar foto" + (f.alt ? ": " + f.alt : ""));
    f.addEventListener("click", function () { abre(f); });
    f.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abre(f); } });
  });
  caixa.querySelector(".lb__fechar").addEventListener("click", fecha);
  caixa.querySelector(".lb__prev").addEventListener("click", function () { mostra(atual - 1); });
  caixa.querySelector(".lb__next").addEventListener("click", function () { mostra(atual + 1); });
  caixa.addEventListener("click", function (e) { if (e.target === caixa) fecha(); });
  document.addEventListener("keydown", function (e) {
    if (caixa.hidden) return;
    if (e.key === "Escape") fecha();
    else if (e.key === "ArrowLeft") mostra(atual - 1);
    else if (e.key === "ArrowRight") mostra(atual + 1);
  });
  var x0 = null;
  caixa.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  caixa.addEventListener("touchend", function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50 && grupo.length > 1) mostra(atual + (dx < 0 ? 1 : -1));
    x0 = null;
  });
})();

/*
 * Percurso desenhado no passo a passo, chegada no fim da página,
 * micro-interações e moldura das fotos da galeria.
 */
(function () {
  "use strict";
  var reduz = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var CORREDOR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3A7.3 7.3 0 0 0 19 13v-2a5.1 5.1 0 0 1-4.4-2.4l-1-1.6a2 2 0 0 0-1.7-1c-.3 0-.5 0-.8.1L6 8.3V13h2V9.6l1.8-.7"/></svg>';

  // ---------- Percurso: a linha avança pelas etapas enquanto a página rola ----------
  var lista = document.querySelector(".steps");
  if (lista) {
    var caixa = document.createElement("div");
    caixa.className = "steps-route";
    lista.parentNode.insertBefore(caixa, lista);
    caixa.append(lista);
    var estrada = document.createElement("div");
    estrada.className = "steps-route__road";
    estrada.setAttribute("aria-hidden", "true");
    estrada.innerHTML = '<span class="steps-route__fill"><span class="steps-route__runner">' + CORREDOR + "</span></span>";
    caixa.prepend(estrada);
    var largada = document.createElement("span");
    largada.className = "steps-route__tag steps-route__tag--start";
    largada.setAttribute("aria-hidden", "true");
    largada.textContent = "Largada";
    var chegada = document.createElement("span");
    chegada.className = "steps-route__tag steps-route__tag--end";
    chegada.setAttribute("aria-hidden", "true");
    chegada.textContent = "Chegada";
    caixa.append(largada, chegada);

    var fill = estrada.firstChild;
    var etapas = Array.prototype.slice.call(lista.children);
    if (reduz) {
      caixa.classList.add("is-done");
    } else {
      caixa.classList.add("is-js");
      var anda = function () {
        var r = estrada.getBoundingClientRect();
        var alvo = window.innerHeight * 0.62;
        var p = Math.max(0, Math.min(1, (alvo - r.top) / r.height));
        fill.style.height = (p * 100).toFixed(2) + "%";
        var ponta = r.top + r.height * p;
        etapas.forEach(function (li) {
          var b = li.getBoundingClientRect();
          li.classList.toggle("is-on", b.top + 41 <= ponta + 1);
        });
        caixa.classList.toggle("is-done", p >= 0.999);
      };
      anda();
      window.addEventListener("scroll", anda, { passive: true });
      window.addEventListener("resize", anda);
    }
  }

  // ---------- Chegada: confete e recado ao chegar ao fim da página ----------
  var comemorou = false;
  function comemora() {
    if (comemorou || reduz) return;
    comemorou = true;
    var aviso = document.createElement("div");
    aviso.className = "finish-toast";
    aviso.setAttribute("role", "status");
    aviso.innerHTML = '<span class="finish-toast__flag" aria-hidden="true"></span><span><b>Você chegou!</b> Fazendo bem feito!</span>';
    document.body.append(aviso);
    var chuva = document.createElement("div");
    chuva.className = "confete";
    chuva.setAttribute("aria-hidden", "true");
    var cores = ["#d6505b", "#24325a", "#ffd166", "#ffffff", "#ff8a93"];
    for (var i = 0; i < 42; i++) {
      var c = document.createElement("i");
      var ang = (Math.random() * 70 + 190) * Math.PI / 180; // para a esquerda e para baixo
      var dist = 120 + Math.random() * 260;
      c.style.setProperty("--x", (Math.cos(ang) * dist).toFixed(0) + "px");
      c.style.setProperty("--y", (-Math.sin(ang) * dist * 0.9 + 120).toFixed(0) + "px");
      c.style.setProperty("--r", (Math.random() * 720 - 360).toFixed(0) + "deg");
      c.style.setProperty("--d", (Math.random() * 0.15).toFixed(2) + "s");
      c.style.background = cores[i % cores.length];
      chuva.append(c);
    }
    document.body.append(chuva);
    requestAnimationFrame(function () { aviso.classList.add("is-on"); });
    setTimeout(function () { aviso.classList.remove("is-on"); }, 2800);
    setTimeout(function () { aviso.remove(); chuva.remove(); }, 3400);
  }
  var noFim = function () {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (max > 400 && window.scrollY >= max - 4) comemora();
  };
  window.addEventListener("scroll", noFim, { passive: true });

  // ---------- Setas que deslizam nos links "… →" ----------
  function setas(raiz) {
    (raiz.querySelectorAll ? raiz.querySelectorAll("a, span.case-card__more") : []).forEach(function (a) {
      if (a.querySelector(".seta")) return;
      var t = a.lastChild;
      if (!t || t.nodeType !== 3 || !/\s→\s*$/.test(t.textContent)) return;
      t.textContent = t.textContent.replace(/\s→\s*$/, " ");
      var s = document.createElement("span");
      s.className = "seta";
      s.setAttribute("aria-hidden", "true");
      s.textContent = "→";
      a.append(s);
    });
  }
  setas(document);
  if ("MutationObserver" in window) {
    new MutationObserver(function (lista) {
      lista.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) setas(n.parentNode || n); }); });
    }).observe(document.body, { childList: true, subtree: true });
  }

  // ---------- Moldura das fotos da galeria (zoom suave sem vazar) ----------
  document.querySelectorAll(".gallery .slide img").forEach(function (img) {
    var m = document.createElement("span");
    m.className = "slide__frame";
    img.parentNode.insertBefore(m, img);
    m.append(img);
  });

  // ---------- Só no computador: brilho que segue o mouse e botões "magnéticos" ----------
  var mouse = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (!mouse || reduz) return;

  function brilho(el) {
    if (el.classList.contains("spot")) return;
    el.classList.add("spot");
    var g = document.createElement("span");
    g.className = "spot__glow";
    g.setAttribute("aria-hidden", "true");
    el.append(g);
    el.addEventListener("pointermove", function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty("--mx", (e.clientX - r.left).toFixed(0) + "px");
      el.style.setProperty("--my", (e.clientY - r.top).toFixed(0) + "px");
    });
  }
  var SPOT = ".bento__item:not(.bento__item--hero), .steps li, .case-card, .race-card, .trust__stat";
  document.querySelectorAll(SPOT).forEach(brilho);
  if ("MutationObserver" in window) {
    new MutationObserver(function (lista) {
      lista.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (n.nodeType !== 1) return;
          if (n.matches && n.matches(SPOT)) brilho(n);
          if (n.querySelectorAll) n.querySelectorAll(SPOT).forEach(brilho);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  document.querySelectorAll(".btn--lg, .nav__cta, .wa-float, .carousel-btn").forEach(function (b) {
    b.classList.add("magnet");
    b.addEventListener("pointermove", function (e) {
      var r = b.getBoundingClientRect();
      var dx = (e.clientX - (r.left + r.width / 2)) * 0.18;
      var dy = (e.clientY - (r.top + r.height / 2)) * 0.25;
      b.style.translate = Math.max(-6, Math.min(6, dx)).toFixed(1) + "px " + Math.max(-4, Math.min(4, dy)).toFixed(1) + "px";
    });
    b.addEventListener("pointerleave", function () { b.style.translate = ""; });
  });
})();
