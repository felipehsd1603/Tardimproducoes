/*
 * Kit de divulgação de uma prova: kit.html?p=<id da prova>&c=<CUPOM>&n=<nome>&d=<desconto>
 * Link com cupom, textos prontos, arte da prova e card para stories (1080x1920)
 * gerado no próprio navegador. Sem cupom, vira o kit geral da prova.
 */
(function () {
  "use strict";
  var app = document.getElementById("kit");
  if (!app) return;

  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
    "agosto", "setembro", "outubro", "novembro", "dezembro"];
  var q = new URLSearchParams(location.search);
  var id = q.get("p") || "";
  var cupom = (q.get("c") || "").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40);
  var nome = (q.get("n") || "").replace(/\s+/g, " ").trim().slice(0, 60);
  var desconto = (q.get("d") || "").replace(/[^\w%,.\s$-]/g, "").trim().slice(0, 20);
  var provas = typeof PROXIMAS !== "undefined" ? PROXIMAS : [];
  var ev = provas.filter(function (p) { return p.id === id; })[0];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function dataDe(str) { var p = str.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function quando(str) { var d = dataDe(str); return d.getDate() + " de " + MESES[d.getMonth()] + " de " + d.getFullYear(); }
  function curta(str) { var p = str.split("-"); return p[2] + "/" + p[1]; }
  function card(passo, titulo) {
    var c = el("section", "assess-card");
    if (passo) c.append(el("p", "assess-card__step", passo));
    if (titulo) c.append(el("h2", null, titulo));
    return c;
  }
  function copiarBtn(texto, rotulo, cls) {
    var b = el("button", cls || "btn btn--red", rotulo || "Copiar");
    b.type = "button";
    b.addEventListener("click", function () {
      var orig = b.textContent;
      var feito = function () { b.textContent = "Copiado!"; setTimeout(function () { b.textContent = orig; }, 1800); };
      if (navigator.clipboard) navigator.clipboard.writeText(typeof texto === "function" ? texto() : texto).then(feito, function () {});
    });
    return b;
  }

  var titulo = document.getElementById("kit-titulo");
  var lead = document.getElementById("kit-lead");

  if (!ev) {
    titulo.textContent = "Kit não encontrado";
    lead.textContent = "Esta prova não está no calendário. Pode ter sido encerrada, ainda não ter sido publicada, ou o link mudou.";
    var c0 = card(null, "Fale com a Tardim Produções");
    var a0 = el("a", "btn btn--red", "Ver o calendário de provas");
    a0.href = "index.html#calendario";
    c0.append(a0);
    app.append(c0);
    return;
  }

  var base = location.href.split("#")[0].split("?")[0].replace(/[^\/]*$/, "");
  var link = base + "prova-" + ev.id + ".html" + (cupom ? "?cupom=" + encodeURIComponent(cupom) : "");
  var percursos = Array.isArray(ev.percursos) ? ev.percursos : (ev.percursos ? [ev.percursos] : []);
  var dataTxt = quando(ev.data) + (ev.hora ? ", largada às " + ev.hora : "");
  var passada = dataDe(ev.data) < (function () { var h = new Date(); h.setHours(0, 0, 0, 0); return h; })();

  document.title = "Kit de divulgação · " + ev.nome + " · Tardim Produções";
  titulo.textContent = ev.nome;
  lead.textContent = (nome ? "Kit de divulgação de " + nome + ". " : "Kit de divulgação. ") + "Link, cupom, textos prontos e card para stories para você compartilhar.";
  if (passada) app.append(el("p", "assess-alerta", "Esta prova já aconteceu. O material fica aqui só para consulta."));

  // ---------- 1. Link e cupom ----------
  var c1 = card("Passo 1", cupom ? "Seu link e seu cupom" : "Link da prova");
  if (cupom) {
    var cp = el("p", "kit-cupom");
    cp.append(el("span", null, "Cupom"), el("b", null, cupom));
    if (desconto) cp.append(el("small", null, desconto + " de desconto na inscrição"));
    c1.append(cp);
    c1.append(el("p", "muted", "Quem entra pelo seu link já vê o cupom na página da prova. Cada inscrição paga com ele conta para você."));
  }
  var lw = el("div", "convite-link");
  var li = el("input");
  li.readOnly = true; li.value = link;
  li.setAttribute("aria-label", "Link para compartilhar");
  li.addEventListener("focus", function () { li.select(); });
  lw.append(li);
  c1.append(lw);
  var ac1 = el("div", "assess-acoes");
  var abrir = el("a", "orc__email", "Abrir a página da prova");
  abrir.href = link; abrir.target = "_blank"; abrir.rel = "noopener";
  ac1.append(copiarBtn(link, "Copiar link"));
  if (cupom) ac1.append(copiarBtn(cupom, "Copiar cupom", "btn btn--line"));
  ac1.append(abrir);
  c1.append(ac1);
  app.append(c1);

  // ---------- 2. Card para stories ----------
  var c2 = card("Passo 2", "Card para stories");
  c2.append(el("p", "muted", "Imagem no tamanho dos stories (1080 x 1920)" + (cupom ? ", com o seu cupom." : ".") + " Baixe e poste, colando o link no adesivo de link do Instagram."));
  var tela = document.createElement("canvas");
  tela.width = 1080; tela.height = 1920;
  tela.className = "kit-story";
  tela.setAttribute("role", "img");
  tela.setAttribute("aria-label", "Card para stories da " + ev.nome + (cupom ? " com o cupom " + cupom : ""));
  var ac2 = el("div", "assess-acoes");
  var baixar = el("a", "btn btn--red", "Baixar imagem");
  baixar.download = "stories-" + ev.id + (cupom ? "-" + cupom.toLowerCase() : "") + ".png";
  baixar.setAttribute("aria-disabled", "true");
  ac2.append(baixar);
  var erroCard = el("p", "assess-alerta");
  erroCard.hidden = true;
  c2.append(tela, ac2, erroCard);
  app.append(c2);
  desenhaStory(tela).then(function () {
    tela.toBlob(function (blob) {
      if (!blob) return;
      baixar.href = URL.createObjectURL(blob);
      baixar.removeAttribute("aria-disabled");
      var arquivo = new File([blob], baixar.download, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
        var comp = el("button", "btn btn--line", "Compartilhar");
        comp.type = "button";
        comp.addEventListener("click", function () { navigator.share({ files: [arquivo], title: ev.nome }).catch(function () {}); });
        ac2.append(comp);
      }
    }, "image/png");
  }).catch(function () {
    erroCard.textContent = "Não consegui montar o card com a arte desta prova. Use a arte do passo 3.";
    erroCard.hidden = false;
  });

  // ---------- 3. Arte ----------
  if (ev.poster) {
    var c3 = card("Passo 3", "Arte da prova");
    var fig = el("div", "kit-arte");
    var im = el("img");
    im.src = ev.poster; im.alt = "Arte de divulgação: " + ev.nome; im.loading = "lazy";
    fig.append(im);
    var ab = el("a", "btn btn--line", "Baixar a arte");
    ab.href = ev.poster; ab.download = "arte-" + ev.id; ab.target = "_blank"; ab.rel = "noopener";
    c3.append(fig, ab);
    app.append(c3);
  }

  // ---------- 4. Textos prontos ----------
  var c4 = card(ev.poster ? "Passo 4" : "Passo 3", "Textos prontos");
  c4.append(el("p", "muted", "Copie, ajuste do seu jeito e poste. Lembre de marcar como parceria ou publicidade."));
  var tags = [ev.hashtags || "", "#tardimproducoes"].join(" ").trim();
  var chamadaCupom = cupom ? "Use o meu cupom " + cupom + (desconto ? " e ganhe " + desconto + " de desconto" : "") + " na inscrição." : "Inscrições abertas.";
  var corpoTxt = ev.textoDivulgacao || ev.resumo || "";
  var textos = [
    ["Legenda para o Instagram", [
      ev.nome,
      dataTxt + (ev.local ? "\n" + ev.local : "") + (percursos.length ? "\nPercursos: " + percursos.join(", ") : ""),
      corpoTxt,
      chamadaCupom + "\nInscrição pelo link: " + link,
      tags,
    ].filter(Boolean).join("\n\n")],
    ["Mensagem para WhatsApp", [
      "Bora correr comigo a " + ev.nome + "? Vai ser " + dataTxt + (ev.local ? ", em " + ev.local : "") + "." + (percursos.length ? " Tem " + percursos.join(", ") + "." : ""),
      chamadaCupom,
      link,
    ].join("\n\n")],
    ["Texto curto para stories", ev.nome + " · " + curta(ev.data) + (cupom ? "\nCupom " + cupom + (desconto ? " (" + desconto + ")" : "") : "") + "\nInscrições no link"],
  ];
  textos.forEach(function (t) {
    c4.append(el("h3", null, t[0]));
    c4.append(el("p", "kit-texto", t[1]));
    c4.append(copiarBtn(t[1], "Copiar texto", "btn btn--line"));
  });
  app.append(c4);

  if (cupom) {
    var c5 = el("p", "muted assess-nota");
    c5.append("Regras de comissão, cortesia e divulgação: ");
    var rg = el("a", null, "programa de embaixadores");
    rg.href = "programa-embaixadores.html";
    c5.append(rg, ".");
    app.append(c5);
  }

  // ---------- card 1080x1920 ----------
  function carrega(src, cruzado) {
    return new Promise(function (ok, erro) {
      var i = new Image();
      if (cruzado) i.crossOrigin = "anonymous";
      i.onload = function () { ok(i); };
      i.onerror = erro;
      i.src = src;
    });
  }
  function quebra(cx, texto, largura, maxLinhas) {
    var palavras = String(texto).split(/\s+/), linhasT = [], atual = "";
    palavras.forEach(function (w) {
      var t = atual ? atual + " " + w : w;
      if (cx.measureText(t).width > largura && atual) { linhasT.push(atual); atual = w; } else atual = t;
    });
    if (atual) linhasT.push(atual);
    if (linhasT.length > maxLinhas) { linhasT = linhasT.slice(0, maxLinhas); linhasT[maxLinhas - 1] += "…"; }
    return linhasT;
  }
  function retangulo(cx, x, y, w, h, r) {
    cx.beginPath();
    if (cx.roundRect) cx.roundRect(x, y, w, h, r); else cx.rect(x, y, w, h);
  }
  function desenhaStory(cv) {
    var cx = cv.getContext("2d");
    var W = cv.width, H = cv.height;
    var fontes = document.fonts ? Promise.all([
      document.fonts.load('italic 800 100px "Barlow Condensed"'),
      document.fonts.load('700 40px "Barlow"'),
      document.fonts.load('600 40px "Barlow"'),
    ]).catch(function () {}) : Promise.resolve();
    var externa = ev.poster && /^https?:/.test(ev.poster) && new URL(ev.poster).origin !== location.origin;
    var arte = ev.poster ? carrega(ev.poster, externa).catch(function () { return null; }) : Promise.resolve(null);
    var logo = carrega("assets/logo-tardim.png").catch(function () { return null; });
    return Promise.all([fontes, arte, logo]).then(function (r) {
      var img = r[1], lg = r[2];
      // fundo
      var g = cx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#18223f"); g.addColorStop(1, "#24325a");
      cx.fillStyle = g; cx.fillRect(0, 0, W, H);
      var rg = cx.createRadialGradient(150, 250, 0, 150, 250, 900);
      rg.addColorStop(0, "rgba(214, 80, 91, 0.45)"); rg.addColorStop(1, "rgba(214, 80, 91, 0)");
      cx.fillStyle = rg; cx.fillRect(0, 0, W, H);

      var y = 140;
      if (img) {
        var caixaH = cupom ? 900 : 1000, caixaW = 860;
        var esc = Math.min(caixaW / img.naturalWidth, caixaH / img.naturalHeight);
        var w = Math.round(img.naturalWidth * esc), h = Math.round(img.naturalHeight * esc);
        var x = Math.round((W - w) / 2);
        cx.save();
        cx.shadowColor = "rgba(0, 0, 0, 0.45)"; cx.shadowBlur = 50; cx.shadowOffsetY = 20;
        retangulo(cx, x, y, w, h, 18); cx.fillStyle = "#fff"; cx.fill();
        cx.restore();
        cx.save(); retangulo(cx, x, y, w, h, 18); cx.clip(); cx.drawImage(img, x, y, w, h); cx.restore();
        y += h + 80;
      } else {
        y = 420;
      }

      cx.textAlign = "center"; cx.textBaseline = "alphabetic";
      cx.fillStyle = "#ff8a93";
      cx.font = '700 40px "Barlow", sans-serif';
      cx.fillText((quando(ev.data) + (ev.hora ? " · " + ev.hora : "")).toUpperCase(), W / 2, y);
      y += 30;

      cx.fillStyle = "#ffffff";
      var tam = img ? 92 : 130;
      cx.font = 'italic 800 ' + tam + 'px "Barlow Condensed", sans-serif';
      quebra(cx, ev.nome.toUpperCase(), 940, img ? 2 : 4).forEach(function (l) { y += tam; cx.fillText(l, W / 2, y); });
      y += 30;
      if (ev.local) {
        cx.fillStyle = "#c3cbe3";
        cx.font = '600 36px "Barlow", sans-serif';
        quebra(cx, ev.local, 920, 1).forEach(function (l) { y += 44; cx.fillText(l, W / 2, y); });
      }

      y += 60;
      var bx = 150, bw = W - 300, bh = cupom ? (desconto ? 270 : 230) : 150;
      if (y + bh > H - 200) y = H - 200 - bh;
      cx.save();
      cx.setLineDash([22, 14]); cx.lineWidth = 6; cx.strokeStyle = "#ff8a93";
      retangulo(cx, bx, y, bw, bh, 28); cx.stroke();
      cx.restore();
      if (cupom) {
        cx.fillStyle = "#c3cbe3"; cx.font = '700 36px "Barlow", sans-serif';
        cx.fillText("CUPOM DE DESCONTO", W / 2, y + 62);
        cx.fillStyle = "#ffffff"; cx.font = 'italic 800 120px "Barlow Condensed", sans-serif';
        var tc = 120;
        while (cx.measureText(cupom).width > bw - 60 && tc > 60) { tc -= 6; cx.font = 'italic 800 ' + tc + 'px "Barlow Condensed", sans-serif'; }
        cx.fillText(cupom, W / 2, y + 180);
        if (desconto) { cx.fillStyle = "#ffd166"; cx.font = '700 36px "Barlow", sans-serif'; cx.fillText(desconto.toUpperCase() + " NA INSCRIÇÃO", W / 2, y + 238); }
      } else {
        cx.fillStyle = "#ffffff"; cx.font = 'italic 800 84px "Barlow Condensed", sans-serif';
        cx.fillText("INSCRIÇÕES ABERTAS", W / 2, y + 105);
      }

      // rodapé
      var rodY = H - 110;
      cx.font = '700 40px "Barlow Condensed", sans-serif';
      var marca = "TARDIM PRODUÇÕES";
      var mw = cx.measureText(marca).width;
      var lw = lg ? 80 : 0, gap = lg ? 20 : 0;
      var ini = (W - (lw + gap + mw)) / 2;
      if (lg) cx.drawImage(lg, ini, rodY - 58, lw, lw);
      cx.fillStyle = "#ffffff"; cx.textAlign = "left";
      cx.fillText(marca, ini + lw + gap, rodY);
      // o canvas fica "sujo" se a arte não liberar CORS; testa já para avisar
      cv.toDataURL("image/png").slice(0, 10);
    });
  }
})();
