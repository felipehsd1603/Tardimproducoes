/*
 * Extras das provas:
 *  - previsão do tempo para a largada (até 15 dias antes, pelo Open-Meteo)
 *  - card "Eu vou correr!" para stories e WhatsApp (página da prova)
 *  - calculadora de ritmo (página da prova)
 */
(function () {
  "use strict";

  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
    "agosto", "setembro", "outubro", "novembro", "dezembro"];
  var DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  var provas = typeof PROXIMAS !== "undefined" ? PROXIMAS : [];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function data(str) {
    var p = str.split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  function hoje() { var h = new Date(); h.setHours(0, 0, 0, 0); return h; }
  function diasAte(ev) { return Math.round((data(ev.data) - hoje()) / 86400000); }
  function horaLargada(ev) {
    var m = /(\d{1,2})h(\d{2})?/.exec(ev.hora || "");
    return m ? Number(m[1]) : 7;
  }

  // ---------- Previsão do tempo ----------
  // Coordenadas por cidade; a prova pode informar as suas em "coords: [lat, lon]".
  var CIDADES = [
    [/contagem/i, -19.93, -44.05], [/betim/i, -19.97, -44.2], [/nova lima/i, -19.98, -43.85],
    [/juiz de fora/i, -21.76, -43.35], [/uberl[aâ]ndia/i, -18.92, -48.28], [/montes claros/i, -16.73, -43.86],
    [/valadares/i, -18.85, -41.95], [/po[cç]os de caldas/i, -21.79, -46.56], [/patos de minas/i, -18.58, -46.52],
  ];
  function coords(ev) {
    if (ev.coords) return ev.coords;
    var txt = (ev.cidade || "") + " " + (ev.local || "");
    for (var i = 0; i < CIDADES.length; i++) if (CIDADES[i][0].test(txt)) return [CIDADES[i][1], CIDADES[i][2]];
    return [-19.92, -43.94]; // Belo Horizonte
  }
  var ICONES = {
    sol: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
    nuvem: '<path d="M7 18h10a4 4 0 0 0 .6-8A6 6 0 0 0 6.2 9.5 4.3 4.3 0 0 0 7 18Z"/>',
    chuva: '<path d="M7 15h10a4 4 0 0 0 .6-8A6 6 0 0 0 6.2 6.5 4.3 4.3 0 0 0 7 15Z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
    raio: '<path d="M7 15h10a4 4 0 0 0 .6-8A6 6 0 0 0 6.2 6.5 4.3 4.3 0 0 0 7 15Z"/><path d="m12 15-2 4h3l-2 4"/>',
  };
  function tempo(codigo) {
    if (codigo === 0) return ["sol", "Céu limpo"];
    if (codigo <= 2) return ["sol", "Poucas nuvens"];
    if (codigo === 3) return ["nuvem", "Nublado"];
    if (codigo <= 48) return ["nuvem", "Neblina"];
    if (codigo <= 57) return ["chuva", "Garoa"];
    if (codigo <= 67) return ["chuva", "Chuva"];
    if (codigo <= 82) return ["chuva", "Pancadas de chuva"];
    return ["raio", "Tempestade"];
  }
  function previsao(ev, destino, claro) {
    var dias = diasAte(ev);
    if (!destino || dias < 0 || dias > 15 || !window.fetch) return;
    var c = coords(ev);
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + c[0] + "&longitude=" + c[1] +
      "&hourly=temperature_2m,precipitation_probability,weather_code&timezone=America%2FSao_Paulo" +
      "&start_date=" + ev.data + "&end_date=" + ev.data;
    fetch(url).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.hourly || !j.hourly.time) return;
      var h = horaLargada(ev);
      var i = j.hourly.time.indexOf(ev.data + "T" + (h < 10 ? "0" : "") + h + ":00");
      if (i < 0) return;
      var t = Math.round(j.hourly.temperature_2m[i]);
      var chuva = j.hourly.precipitation_probability ? j.hourly.precipitation_probability[i] : null;
      var w = tempo(j.hourly.weather_code[i]);
      var box = el("p", "clima" + (claro ? " clima--claro" : ""));
      box.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONES[w[0]] + "</svg>";
      var txt = el("span");
      txt.append(el("b", null, t + "°C"), " " + w[1] + (chuva != null ? " · " + chuva + "% de chance de chuva" : ""));
      txt.append(el("small", null, "Previsão para a largada, às " + h + "h · Open-Meteo"));
      box.append(txt);
      destino.append(box);
    }).catch(function () {});
  }

  // Card da próxima prova na página inicial
  var proxima = provas.filter(function (p) { return p.data && diasAte(p) >= 0; })
    .sort(function (a, b) { return a.data.localeCompare(b.data); })[0];
  var corpoCard = document.querySelector("#next .next-card__body");
  if (proxima && corpoCard) {
    var lugar = el("div", "clima-slot");
    var btnCard = corpoCard.querySelector(".next-card__btn");
    corpoCard.insertBefore(lugar, btnCard);
    previsao(proxima, lugar, true);
  }

  // ---------- Página da prova ----------
  var raiz = document.getElementById("prova");
  if (!raiz) return;
  var id = window.PAGINA_ID || new URLSearchParams(location.search).get("id");
  var ev = provas.filter(function (p) { return p.id === id; })[0];
  if (!ev || !ev.data) return;
  var futura = diasAte(ev) >= 0;

  var heroTxt = raiz.querySelector(".event-hero__text");
  if (heroTxt && futura) {
    var slot = el("div", "clima-slot");
    var acoes = heroTxt.querySelector(".actions");
    heroTxt.insertBefore(slot, acoes);
    previsao(ev, slot, false);
  }

  var corpo = raiz.querySelector(".event-body");
  var ajuda = raiz.querySelector(".event-help");
  var sub = raiz.querySelector(".subnav");
  function novaSecao(sid, titulo) {
    var s = el("section", "event-sec");
    s.id = sid;
    s.append(el("h2", null, titulo));
    if (corpo) corpo.insertBefore(s, ajuda);
    if (sub) {
      var a = el("a", null, titulo);
      a.href = "#" + sid;
      sub.append(a);
    }
    return s;
  }
  var d = data(ev.data);
  var quando = DIAS[d.getDay()].charAt(0).toUpperCase() + DIAS[d.getDay()].slice(1) + ", " + d.getDate() + " de " + MESES[d.getMonth()] + (ev.hora ? " · " + ev.hora : "");

  // ---------- Card "Eu vou correr!" ----------
  if (futura && corpo && window.HTMLCanvasElement) {
    var sc = novaSecao("card", "Eu vou correr!");
    sc.append(el("p", "muted", "Crie um card com o seu nome para postar nos stories ou mandar no WhatsApp e chamar a galera."));
    var form = el("form", "story-form");
    var lab = el("label", "story-form__field");
    lab.append(el("span", "sr-only", "Seu nome"));
    var nome = el("input");
    nome.name = "nome";
    nome.placeholder = "Seu nome";
    nome.maxLength = 28;
    nome.autocomplete = "given-name";
    nome.required = true;
    lab.append(nome);
    var gerar = el("button", "btn btn--red", "Criar meu card");
    gerar.type = "submit";
    form.append(lab, gerar);
    sc.append(form);
    var saida = el("div", "story-out");
    saida.hidden = true;
    var prev = el("img", "story-out__img");
    prev.alt = "Prévia do card para stories";
    var botoes = el("div", "story-out__actions");
    var baixar = el("a", "btn btn--red", "Baixar imagem");
    var compartilhar = el("button", "btn btn--line", "Compartilhar");
    compartilhar.type = "button";
    botoes.append(baixar, compartilhar);
    saida.append(prev, botoes);
    sc.append(saida);

    var blobAtual = null;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var n = nome.value.trim();
      if (!n) { nome.focus(); return; }
      gerar.disabled = true;
      desenhaCard(n).then(function (blob) {
        gerar.disabled = false;
        if (!blob) return;
        blobAtual = blob;
        if (prev.src) URL.revokeObjectURL(prev.src);
        var u = URL.createObjectURL(blob);
        prev.src = u;
        baixar.href = u;
        baixar.download = "eu-vou-correr-" + ev.id + ".png";
        var arquivo = new File([blob], baixar.download, { type: "image/png" });
        compartilhar.hidden = !(navigator.canShare && navigator.canShare({ files: [arquivo] }));
        saida.hidden = false;
      }).catch(function () { gerar.disabled = false; });
    });
    compartilhar.addEventListener("click", function () {
      if (!blobAtual) return;
      var arquivo = new File([blobAtual], "eu-vou-correr-" + ev.id + ".png", { type: "image/png" });
      navigator.share({ files: [arquivo], title: ev.nome, text: "Eu vou correr a " + ev.nome + "! " + location.href }).catch(function () {});
    });
  }

  function carrega(src) {
    return new Promise(function (ok) {
      if (!src) return ok(null);
      var i = new Image();
      i.onload = function () { ok(i); };
      i.onerror = function () { ok(null); };
      if (/^https?:/i.test(src)) i.crossOrigin = "anonymous"; // imagem do banco: precisa disso para o card poder ser salvo
      i.src = src;
    });
  }
  function cabe(ctx, texto, fonte, max, tamanho) {
    var t = tamanho;
    ctx.font = fonte.replace("{t}", t);
    while (ctx.measureText(texto).width > max && t > 30) { t -= 4; ctx.font = fonte.replace("{t}", t); }
    return t;
  }
  function quebra(ctx, texto, max) {
    var palavras = texto.split(" "), linhas = [], atual = "";
    palavras.forEach(function (p) {
      var teste = atual ? atual + " " + p : p;
      if (ctx.measureText(teste).width > max && atual) { linhas.push(atual); atual = p; } else atual = teste;
    });
    if (atual) linhas.push(atual);
    return linhas;
  }
  // Quem chega pela página da equipe (equipe.html) leva o nome e a logo da assessoria para o card
  var qsEquipe = new URLSearchParams(location.search);
  var equipeNome = (qsEquipe.get("equipe") || "").replace(/\s+/g, " ").trim().slice(0, 40);
  var equipeLogo = (function (l) {
    if (/^assessorias\/[\w-][\w.-]*\.(png|jpe?g|webp)$/i.test(l)) return "arquivos/" + l;
    return /^[\w-][\w.-]*\.(png|jpe?g|webp)$/i.test(l) ? "assets/assessorias/" + l : "";
  })(qsEquipe.get("logo") || "");
  function desenhaCard(nomeTxt) {
    var W = 1080, H = 1920;
    var fontes = document.fonts ? Promise.all([
      document.fonts.load('italic 800 100px "Barlow Condensed"'),
      document.fonts.load('700 40px "Barlow"'),
      document.fonts.load('600 40px "Barlow"'),
    ]) : Promise.resolve();
    return fontes.then(function () {
      return Promise.all([carrega(ev.poster), carrega("assets/logo-tardim.webp"), carrega(equipeNome ? equipeLogo : "")]);
    }).then(function (imgs) {
      var arte = imgs[0], logo = imgs[1], logoEq = imgs[2];
      var cv = document.createElement("canvas");
      cv.width = W; cv.height = H;
      var c = cv.getContext("2d");
      // Fundo
      var g = c.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#24325a"); g.addColorStop(1, "#111a33");
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      var luz = c.createRadialGradient(150, 300, 0, 150, 300, 900);
      luz.addColorStop(0, "rgba(214,80,91,0.45)"); luz.addColorStop(1, "rgba(214,80,91,0)");
      c.fillStyle = luz; c.fillRect(0, 0, W, H);
      // Faixa quadriculada no rodapé
      var q = 30;
      for (var y = H - 2 * q; y < H; y += q) for (var x = 0; x < W; x += q) {
        c.fillStyle = ((x + y) / q) % 2 ? "#ffffff" : "#18223f";
        c.fillRect(x, y, q, q);
      }
      // Topo
      c.fillStyle = "#ff8a93";
      c.font = '700 44px "Barlow"';
      c.textAlign = "center";
      c.fillText("EU VOU CORRER!", W / 2, 150);
      // Nome
      c.fillStyle = "#ffffff";
      var t = cabe(c, nomeTxt.toUpperCase(), 'italic 800 {t}px "Barlow Condensed"', W - 140, 170);
      c.fillText(nomeTxt.toUpperCase(), W / 2, 150 + t * 0.95);
      var topoFim = 150 + t * 0.95 + 50;
      // Arte da prova
      var arteFim = topoFim;
      if (arte) {
        var aw = 640, ah = Math.round(aw * arte.height / arte.width);
        if (ah > 860) { ah = 860; aw = Math.round(ah * arte.width / arte.height); }
        var ax = (W - aw) / 2, ay = topoFim + 10;
        c.save();
        c.shadowColor = "rgba(0,0,0,0.45)"; c.shadowBlur = 50; c.shadowOffsetY = 20;
        c.fillStyle = "#000"; c.fillRect(ax, ay, aw, ah);
        c.restore();
        c.drawImage(arte, ax, ay, aw, ah);
        arteFim = ay + ah + 70;
      }
      // Prova, data e local
      c.fillStyle = "#ffffff";
      c.font = 'italic 800 76px "Barlow Condensed"';
      var linhas = quebra(c, ev.nome, W - 140).slice(0, 2);
      linhas.forEach(function (l, i) { c.fillText(l, W / 2, arteFim + i * 78); });
      var yy = arteFim + linhas.length * 78 + 10;
      c.fillStyle = "#ff8a93";
      c.font = '700 44px "Barlow"';
      c.fillText(quando, W / 2, yy);
      if (ev.local) {
        c.fillStyle = "#c3cbe3";
        c.font = '600 34px "Barlow"';
        quebra(c, ev.local, W - 180).slice(0, 2).forEach(function (l, i) { c.fillText(l, W / 2, yy + 56 + i * 44); });
      }
      // Marca
      var by = H - 2 * q - 70;
      // Equipe (assessoria), acima da marca
      if (equipeNome) {
        c.textAlign = "center";
        c.fillStyle = "#c3cbe3";
        c.font = '600 30px "Barlow"';
        c.fillText("CORRO COM A EQUIPE", W / 2, by - 178);
        var te = cabe(c, equipeNome, 'italic 800 {t}px "Barlow Condensed"', W - 320, 68);
        var we = c.measureText(equipeNome).width;
        var raio = 38, sobra = logoEq ? raio * 2 + 20 : 0;
        var x0 = (W - (we + sobra)) / 2;
        if (logoEq) {
          c.save();
          c.beginPath(); c.arc(x0 + raio, by - 128, raio, 0, Math.PI * 2); c.fillStyle = "#fff"; c.fill(); c.clip();
          var lado = raio * 2, lw = lado, lh = lado;
          if (logoEq.width > logoEq.height) lh = lado * logoEq.height / logoEq.width; else lw = lado * logoEq.width / logoEq.height;
          c.drawImage(logoEq, x0 + raio - lw / 2, by - 128 - lh / 2, lw, lh);
          c.restore();
        }
        c.textAlign = "left";
        c.fillStyle = "#ffffff";
        c.fillText(equipeNome, x0 + sobra, by - 128 + te * 0.32);
        c.textAlign = "center";
      }
      c.font = 'italic 800 52px "Barlow Condensed"';
      var marca = "Tardim Produções";
      var mw = c.measureText(marca).width;
      var lx = (W - (mw + 90)) / 2;
      if (logo) {
        c.save();
        c.beginPath(); c.arc(lx + 34, by - 18, 34, 0, Math.PI * 2); c.fillStyle = "#fff"; c.fill(); c.clip();
        c.drawImage(logo, lx, by - 52, 68, 68);
        c.restore();
      }
      c.textAlign = "left";
      c.fillStyle = "#ffffff";
      c.fillText("Tardim ", lx + 90, by);
      c.fillStyle = "#ff8a93";
      c.fillText("Produções", lx + 90 + c.measureText("Tardim ").width, by);
      return new Promise(function (ok) { cv.toBlob(ok, "image/png"); });
    });
  }

  // ---------- Calculadora de ritmo ----------
  if (corpo) {
    var sr = novaSecao("ritmo", "Calcule seu ritmo");
    sr.append(el("p", "muted", "Escolha a distância e o tempo que você quer fazer. O site mostra o ritmo por km e as passagens."));
    var kms = [];
    (Array.isArray(ev.percursos) ? ev.percursos : [ev.percursos || ""]).forEach(function (p) {
      var m = String(p).match(/(\d+(?:[.,]\d+)?)\s*km/i);
      if (m) { var v = parseFloat(m[1].replace(",", ".")); if (v >= 3 && kms.indexOf(v) < 0) kms.push(v); }
    });
    [5, 10, 21.1, 42.2].forEach(function (v) { if (kms.indexOf(v) < 0) kms.push(v); });
    kms.sort(function (a, b) { return a - b; });
    var estado = { km: kms[0], seg: 0 };
    var calc = el("div", "pace");
    var distG = el("div", "pace__chips");
    distG.setAttribute("role", "group");
    distG.setAttribute("aria-label", "Distância");
    kms.forEach(function (v) {
      var b = el("button", "dist-chip", String(v).replace(".", ",") + " km");
      b.type = "button";
      b.addEventListener("click", function () {
        estado.km = v;
        if (!estado.mexeu) define(padrao(v));
        conta();
      });
      b.setAttribute("data-km", v);
      distG.append(b);
    });
    var tempoG = el("div", "pace__time");
    tempoG.setAttribute("role", "group");
    tempoG.setAttribute("aria-label", "Tempo desejado");
    var campos = {};
    [["h", "horas", 9], ["m", "min", 59], ["s", "seg", 59]].forEach(function (f) {
      var w = el("label", "pace__box");
      var i = el("input");
      i.type = "number"; i.min = 0; i.max = f[2]; i.inputMode = "numeric";
      i.setAttribute("aria-label", f[1]);
      i.addEventListener("input", function () { estado.mexeu = true; conta(); });
      campos[f[0]] = i;
      w.append(i, el("span", null, f[1]));
      tempoG.append(w);
    });
    var res = el("div", "pace__res");
    var ritmoEl = el("p", "pace__big");
    var velEl = el("p", "pace__sub");
    var tabela = el("ol", "pace__splits");
    res.append(ritmoEl, velEl, tabela);
    calc.append(distG, tempoG, res);
    sr.append(calc);

    function padrao(km) { return Math.round(km * 360); } // 6 min/km
    function define(seg) {
      campos.h.value = Math.floor(seg / 3600);
      campos.m.value = Math.floor(seg % 3600 / 60);
      campos.s.value = seg % 60;
    }
    function fmt(seg, comHora) {
      seg = Math.round(seg);
      var h = Math.floor(seg / 3600), m = Math.floor(seg % 3600 / 60), s = seg % 60;
      var dd = function (n) { return (n < 10 ? "0" : "") + n; };
      return (h || comHora ? h + ":" + dd(m) : String(m)) + ":" + dd(s);
    }
    function conta() {
      distG.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(Number(b.getAttribute("data-km")) === estado.km)); });
      var seg = (Number(campos.h.value) || 0) * 3600 + (Number(campos.m.value) || 0) * 60 + (Number(campos.s.value) || 0);
      tabela.innerHTML = "";
      if (!seg) { ritmoEl.textContent = "Informe o tempo"; velEl.textContent = ""; return; }
      var porKm = seg / estado.km;
      ritmoEl.innerHTML = "";
      ritmoEl.append(el("b", null, fmt(porKm)), " /km");
      velEl.textContent = "Velocidade média: " + (estado.km / (seg / 3600)).toFixed(1).replace(".", ",") + " km/h";
      var passo = estado.km <= 10 ? 1 : 5;
      for (var k = passo; k < estado.km; k += passo) {
        var li = el("li");
        li.append(el("span", null, "km " + k), el("b", null, fmt(porKm * k, seg >= 3600)));
        tabela.append(li);
      }
      var ult = el("li", "is-fim");
      ult.append(el("span", null, "Chegada · " + String(estado.km).replace(".", ",") + " km"), el("b", null, fmt(seg, seg >= 3600)));
      tabela.append(ult);
    }
    define(padrao(estado.km));
    conta();
  }
})();
