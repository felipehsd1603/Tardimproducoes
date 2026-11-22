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
    ".bento__item", ".creds li", ".event-sec", ".slide", ".inst > div", ".trust__stat",
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
      if (!alvo || reduz) return;
      var inicio = null;
      var dur = 1100;
      function passo(t) {
        if (inicio === null) inicio = t;
        var p = Math.min(1, (t - inicio) / dur);
        var suave = 1 - Math.pow(1 - p, 3);
        el.textContent = formata(alvo * suave);
        if (p < 1) requestAnimationFrame(passo);
        else el.textContent = formata(alvo);
      }
      requestAnimationFrame(passo);
    });
  }, { threshold: 0.6 });
  numeros.forEach(function (n) { obsNum.observe(n); });
})();
