(function () {
  "use strict";

  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

  // "AAAA-MM-DD" -> Date local no fim do dia (a prova continua "próxima" no próprio dia)
  function parseData(str, fimDoDia) {
    if (!str) return null;
    const [a, m, d] = str.split("-").map(Number);
    return fimDoDia ? new Date(a, m - 1, d, 23, 59, 59) : new Date(a, m - 1, d);
  }

  function horaLargada(ev) {
    const base = parseData(ev.data, false);
    const match = /(\d{1,2})h(\d{2})?/.exec(ev.hora || "");
    if (match) base.setHours(Number(match[1]), Number(match[2] || 0));
    else base.setHours(7, 0);
    return base;
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  const agora = new Date();
  const eventos = (typeof EVENTOS !== "undefined" ? EVENTOS : []).slice();

  const proximos = eventos
    .filter((e) => !e.data || parseData(e.data, true) >= agora)
    .sort((a, b) => {
      if (!a.data) return 1;
      if (!b.data) return -1;
      return a.data.localeCompare(b.data);
    });

  const passados = eventos
    .filter((e) => e.data && parseData(e.data, true) < agora)
    .sort((a, b) => b.data.localeCompare(a.data));

  // ---------- Próximas corridas ----------
  const listaProx = document.getElementById("proximos");
  proximos.forEach((ev) => {
    const card = el("article", "event theme-" + (ev.tema || "azul"));

    const date = el("div", "event__date");
    if (ev.data) {
      const d = parseData(ev.data);
      date.append(el("b", null, String(d.getDate()).padStart(2, "0")), el("span", null, MESES[d.getMonth()] + " " + d.getFullYear()));
    } else {
      date.append(el("b", null, "Em"), el("span", null, "breve"));
    }

    const body = el("div", "event__body");
    body.append(el("h3", null, ev.nome));

    const meta = el("ul", "event__meta");
    if (ev.local) meta.append(el("li", "meta-local", ev.local));
    if (ev.hora) meta.append(el("li", "meta-hora", "Largada " + ev.hora));
    body.append(meta);

    if (ev.distancias && ev.distancias.length) {
      const tags = el("div", "tags");
      ev.distancias.forEach((t) => tags.append(el("span", "tag", t)));
      body.append(tags);
    }
    if (ev.destaque) body.append(el("p", "event__highlight", ev.destaque));

    const link = el("a", "btn btn--light", "Inscreva-se");
    link.href = ev.inscricao || (typeof SITE !== "undefined" ? SITE.linktree : "#");
    link.target = "_blank";
    link.rel = "noopener";
    body.append(link);

    card.append(date, body);
    listaProx.append(card);
  });
  document.getElementById("proximos-vazio").hidden = proximos.length > 0;

  // ---------- Eventos realizados ----------
  const listaPass = document.getElementById("passados");
  passados.forEach((ev) => {
    const card = el("article", "past-card theme-" + (ev.tema || "azul"));
    card.append(el("span", "past-card__year", String(parseData(ev.data).getFullYear())));
    card.append(el("h3", null, ev.nome));
    if (ev.local) card.append(el("p", null, ev.local));
    listaPass.append(card);
  });

  // ---------- Contagem regressiva ----------
  const proxComData = proximos.find((e) => e.data && horaLargada(e) > agora);
  const cd = document.getElementById("countdown");
  if (proxComData) {
    cd.hidden = false;
    document.getElementById("countdown-name").textContent = proxComData.nome;
    const alvo = horaLargada(proxComData).getTime();
    const out = {
      d: document.getElementById("cd-d"),
      h: document.getElementById("cd-h"),
      m: document.getElementById("cd-m"),
      s: document.getElementById("cd-s"),
    };
    const tick = () => {
      let diff = Math.max(0, alvo - Date.now()) / 1000;
      const d = Math.floor(diff / 86400); diff -= d * 86400;
      const h = Math.floor(diff / 3600); diff -= h * 3600;
      const m = Math.floor(diff / 60);
      const s = Math.floor(diff - m * 60);
      out.d.textContent = String(d).padStart(2, "0");
      out.h.textContent = String(h).padStart(2, "0");
      out.m.textContent = String(m).padStart(2, "0");
      out.s.textContent = String(s).padStart(2, "0");
    };
    tick();
    setInterval(tick, 1000);
  }

  // ---------- Contatos ----------
  if (typeof SITE !== "undefined") {
    if (SITE.whatsapp) {
      const url = "https://wa.me/" + SITE.whatsapp + "?text=" + encodeURIComponent("Olá! Vim pelo site da Tardim Produções.");
      ["whatsapp-link", "whatsapp-float"].forEach((id) => {
        const a = document.getElementById(id);
        a.href = url;
        a.hidden = false;
      });
    }
    if (SITE.email) {
      const mail = document.getElementById("email-link");
      mail.href = "mailto:" + SITE.email;
      mail.querySelector("span").lastChild.textContent = SITE.email;
    }
  }

  // ---------- Menu mobile ----------
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.getElementById("menu");
  toggle.addEventListener("click", () => {
    const aberto = document.body.classList.toggle("menu-open");
    toggle.setAttribute("aria-expanded", String(aberto));
  });
  nav.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      document.body.classList.remove("menu-open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });

  // ---------- Topo com sombra ao rolar ----------
  const topbar = document.querySelector(".topbar");
  const onScroll = () => topbar.classList.toggle("is-scrolled", window.scrollY > 10);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  document.getElementById("ano").textContent = new Date().getFullYear();
})();
