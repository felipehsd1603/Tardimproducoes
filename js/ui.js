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

  if (!("IntersectionObserver" in window)) return;

  // ---------- Elementos aparecem ao entrar na tela ----------
  var seletores = [
    ".block__head", ".carousel-head", ".race-card", ".case-card", ".logos li", ".offers article",
    ".bento__item", ".creds li", ".steps li", ".event-sec", ".slide", ".inst > div", ".trust__stat",
    ".contact__grid > *", ".other-race", ".month-title", ".highlights li", ".testimonial",
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
      fill.style.width = (p * 100).toFixed(2) + "%";
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
