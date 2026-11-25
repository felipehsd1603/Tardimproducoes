/*
 * Página pública da equipe: o treinador manda este link aos atletas.
 * Mostra a prova, o prazo interno, os ritmos por pelotão e um formulário
 * que monta a mensagem com os dados do atleta para o WhatsApp do treinador.
 * Nada é enviado nem guardado pelo site.
 */
(function () {
  "use strict";
  var app = document.getElementById("equipe-app");
  if (!app) return;

  var SITE_ = typeof SITE !== "undefined" ? SITE : {};
  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
    "agosto", "setembro", "outubro", "novembro", "dezembro"];
  var DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  var TAMANHOS_PADRAO = ["PP", "P", "M", "G", "GG", "XG", "XGG"];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function data(str) { var p = str.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function hoje() { var h = new Date(); h.setHours(0, 0, 0, 0); return h; }
  function dias(str) { return Math.round((data(str) - hoje()) / 86400000); }
  function dataCurta(str) { var d = data(str); return d.getDate() + " de " + MESES[d.getMonth()]; }
  function faltam(n) { return n === 0 ? "é hoje" : n === 1 ? "falta 1 dia" : "faltam " + n + " dias"; }

  var hero = document.querySelector(".assess-hero");
  var olho = hero.querySelector(".eyebrow"), h1 = hero.querySelector("h1"), lead = hero.querySelector(".assess-hero__lead");

  function fechado(titulo, texto) {
    var c = el("section", "assess-card assess-card--fechado");
    c.append(el("h2", null, titulo), el("p", "muted", texto));
    var a = el("a", "btn btn--red", "Ver calendário de provas");
    a.href = "index.html#calendario";
    c.append(a);
    app.append(c);
  }

  var conv = window.CONVITE ? CONVITE.le(new URLSearchParams(location.search).get("c")) : null;
  if (!conv) {
    fechado("Link da equipe inválido", "Peça ao treinador da sua assessoria o link certo da página da equipe.");
    return;
  }
  var ev = (typeof PROXIMAS !== "undefined" ? PROXIMAS : []).filter(function (p) { return p.id === conv.p && p.data && dias(p.data) >= 0; })[0];
  if (!ev) {
    olho.textContent = conv.e;
    fechado("Esta prova já aconteceu", "A página da " + conv.e + " era para uma prova que já passou. Veja as próximas no calendário.");
    return;
  }

  // ---------- Cara da equipe ----------
  var cor = CONVITE.cor(conv), logo = CONVITE.logo(conv);
  if (cor) { document.documentElement.style.setProperty("--equipe", cor); document.body.classList.add("tem-equipe"); }
  var treinador = String(conv.t || "").trim();
  var d = data(ev.data);
  var quando = DIAS[d.getDay()] + ", " + d.getDate() + " de " + MESES[d.getMonth()] + " de " + d.getFullYear() + (ev.hora ? " · largada às " + ev.hora : "");
  olho.textContent = conv.e;
  h1.textContent = "Corra a " + ev.nome + " com a " + conv.e;
  lead.textContent = quando.charAt(0).toUpperCase() + quando.slice(1) + (ev.local ? " · " + ev.local : "");
  document.title = conv.e + " na " + ev.nome + " · Tardim Produções";
  if (logo) {
    var lg = el("img", "equipe-logo");
    lg.alt = "Logo da " + conv.e;
    lg.onerror = function () { lg.remove(); };
    lg.src = logo;
    olho.before(lg);
  }

  // Contagens: prova e prazo interno
  var prazo = conv.i || "";
  var prazoAberto = !prazo || dias(prazo) >= 0;
  var cont = el("ul", "equipe-cont");
  function marco(n, rotulo, alerta) {
    var li = el("li", alerta ? "is-alerta" : "");
    li.append(el("b", null, String(n)), el("span", null, rotulo));
    cont.append(li);
  }
  marco(dias(ev.data), dias(ev.data) === 1 ? "dia para a prova" : "dias para a prova");
  if (prazo && prazoAberto) marco(dias(prazo), (dias(prazo) === 1 ? "dia" : "dias") + " para mandar seus dados (até " + dataCurta(prazo) + ")", dias(prazo) <= 3);
  hero.querySelector(".wrap").append(cont);

  var numTreinador = String(conv.w || "").replace(/\D/g, "");
  var paginaProva = (window.DEMO ? "prova.html?id=" + encodeURIComponent(ev.id) + "&demo=1&" : "prova-" + ev.id + ".html?") +
    "equipe=" + encodeURIComponent(conv.e) + (conv.l && logo ? "&logo=" + encodeURIComponent(conv.l) : "");

  // ---------- Dados para a inscrição ----------
  var percursos = (Array.isArray(ev.percursos) ? ev.percursos : [ev.percursos || ""]).map(function (p) { return String(p).trim(); }).filter(Boolean);
  var tamanhos = ev.tamanhos && ev.tamanhos.length ? ev.tamanhos : TAMANHOS_PADRAO;

  var p1 = el("section", "assess-card");
  p1.append(el("p", "assess-card__step", "Passo 1"), el("h2", null, "Mande seus dados para a inscrição"));
  if (!prazoAberto) {
    p1.append(el("p", "assess-alerta", "O prazo da equipe terminou em " + dataCurta(prazo) + ". Fale com " + (treinador || "o treinador") + " para ver se ainda dá tempo."));
  } else {
    p1.append(el("p", "muted", "A inscrição é coletiva, feita pela " + conv.e + ". Preencha e envie para " + (treinador || "o treinador") + (prazo ? " até " + dataCurta(prazo) : "") + "."));
  }
  var form = el("form", "assess-grid");
  form.noValidate = true;
  function campo(rotulo, input, cheio) {
    var l = el("label", "orc__field" + (cheio ? " assess-grid__full" : ""));
    l.append(el("span", null, rotulo), input);
    return l;
  }
  function entrada(tipo, ph, auto) { var i = el("input"); if (tipo) i.type = tipo; if (ph) i.placeholder = ph; if (auto) i.autocomplete = auto; return i; }
  function escolha(opcoes, vazio) {
    var s = el("select");
    if (vazio) { var o0 = el("option", null, vazio); o0.value = ""; s.append(o0); }
    opcoes.forEach(function (t) { s.append(el("option", null, t)); });
    return s;
  }
  var fNome = entrada("", "Nome completo", "name");
  var fCpf = entrada("", "000.000.000-00"); fCpf.inputMode = "numeric";
  var fNasc = entrada("", "dd/mm/aaaa", "bday"); fNasc.inputMode = "numeric";
  var fSexo = escolha(["F", "M"], "Selecione");
  var fDist = percursos.length > 1 ? escolha(percursos, "Selecione") : null;
  var fCam = escolha(tamanhos, "Selecione");
  var fEmail = entrada("email", "voce@exemplo.com", "email");
  var fTel = entrada("tel", "(31) 90000-0000", "tel");
  form.append(campo("Nome completo", fNome, true), campo("CPF", fCpf), campo("Data de nascimento", fNasc), campo("Sexo", fSexo));
  if (fDist) form.append(campo("Distância", fDist));
  form.append(campo("Camiseta", fCam), campo("E-mail", fEmail), campo("Telefone com DDD", fTel));
  var enviar = el("button", "btn btn--wa btn--lg assess-grid__full", numTreinador ? "Enviar para " + (treinador ? treinador.split(" ")[0] : "o treinador") + " no WhatsApp" : "Enviar pelo WhatsApp");
  enviar.type = "submit";
  var copiar = el("button", "orc__email assess-grid__full", "Prefiro copiar a mensagem");
  copiar.type = "button";
  form.append(enviar, copiar);
  var aviso = el("p", "assess-status");
  aviso.setAttribute("role", "status");
  p1.append(form, aviso, el("p", "muted assess-nota", "O site não guarda nem envia seus dados: a mensagem é montada no seu aparelho e só chega ao treinador quando você enviar."));
  app.append(p1);

  function cpfValido(c) {
    if (!/^\d{11}$/.test(c) || /^(\d)\1{10}$/.test(c)) return false;
    for (var t = 9; t < 11; t++) {
      var s = 0;
      for (var i = 0; i < t; i++) s += Number(c[i]) * (t + 1 - i);
      if ((s * 10) % 11 % 10 !== Number(c[t])) return false;
    }
    return true;
  }
  function monta() {
    var nome = fNome.value.replace(/\s+/g, " ").trim();
    var cpf = fCpf.value.replace(/\D/g, "");
    var nasc = fNasc.value.trim();
    var tel = fTel.value.replace(/\D/g, "");
    var mail = fEmail.value.trim().toLowerCase();
    var dist = fDist ? fDist.value : (percursos[0] || "");
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(nasc);
    var dn = m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
    var erro = null;
    if (nome.split(" ").length < 2) erro = [fNome, "Informe nome e sobrenome."];
    else if (!cpfValido(cpf)) erro = [fCpf, "CPF inválido. Confira os números."];
    else if (!dn || dn.getDate() !== Number(m[1]) || dn.getMonth() !== Number(m[2]) - 1 || dn > new Date() || Number(m[3]) < 1920) erro = [fNasc, "Data de nascimento no formato dd/mm/aaaa."];
    else if (!fSexo.value) erro = [fSexo, "Selecione o sexo."];
    else if (fDist && !dist) erro = [fDist, "Selecione a distância."];
    else if (!fCam.value) erro = [fCam, "Selecione o tamanho da camiseta."];
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) erro = [fEmail, "E-mail inválido."];
    else if (tel.length < 10 || tel.length > 11) erro = [fTel, "Telefone com DDD: 10 ou 11 números."];
    if (erro) { aviso.textContent = erro[1]; erro[0].focus(); return null; }
    aviso.textContent = "";
    var cpfF = cpf.slice(0, 3) + "." + cpf.slice(3, 6) + "." + cpf.slice(6, 9) + "-" + cpf.slice(9);
    var telF = "(" + tel.slice(0, 2) + ") " + tel.slice(2, tel.length - 4) + "-" + tel.slice(-4);
    var nascF = ("0" + m[1]).slice(-2) + "/" + ("0" + m[2]).slice(-2) + "/" + m[3];
    var colunas = [nome, cpfF, nascF, fSexo.value, dist, fCam.value, mail, telF, conv.e];
    return "Oi" + (treinador ? ", " + treinador.split(" ")[0] : "") + "! Quero correr a *" + ev.nome + "* com a " + conv.e + ". Meus dados:\n\n" +
      "Nome: " + nome + "\nCPF: " + cpfF + "\nNascimento: " + nascF + "\nSexo: " + fSexo.value +
      (dist ? "\nDistância: " + dist : "") + "\nCamiseta: " + fCam.value + "\nE-mail: " + mail + "\nTelefone: " + telF +
      "\n\nAutorizo o uso desses dados para a minha inscrição.\n\nLinha para a planilha:\n" + colunas.join(";");
  }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var txt = monta();
    if (!txt) return;
    window.open("https://wa.me/" + numTreinador + "?text=" + encodeURIComponent(txt), "_blank", "noopener");
    aviso.textContent = numTreinador ? "Abrimos o WhatsApp com a mensagem pronta. É só enviar." : "Abrimos o WhatsApp: escolha a conversa do treinador e envie.";
  });
  copiar.addEventListener("click", function () {
    var txt = monta();
    if (!txt) return;
    var feito = function () { aviso.textContent = "Mensagem copiada. Cole na conversa com o treinador."; };
    var reserva = function () {
      var t = el("textarea"); t.value = txt; t.style.position = "fixed"; t.style.opacity = "0";
      document.body.append(t); t.select();
      try { document.execCommand("copy"); } catch (err) {}
      t.remove(); feito();
    };
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(feito, reserva); else reserva();
  });

  // ---------- A prova ----------
  var p2 = el("section", "assess-card");
  p2.append(el("p", "assess-card__step", "A prova"), el("h2", null, ev.nome));
  if (ev.resumo) p2.append(el("p", "muted", ev.resumo));
  var info = el("dl", "assess-cond");
  function linha(t, v) { if (v) info.append(el("dt", null, t), el("dd", null, v)); }
  linha("Quando", quando.charAt(0).toUpperCase() + quando.slice(1));
  linha("Onde", ev.local);
  linha("Percursos", percursos.join(" · "));
  linha("Kit", ev.kit && ev.kit.itens && ev.kit.itens.length ? ev.kit.itens.join(", ") : "");
  p2.append(info);
  var ac2 = el("div", "assess-acoes");
  var aProva = el("a", "btn btn--line", "Ver a página da prova"); aProva.href = paginaProva;
  var aCard = el("a", "btn btn--red", "Criar meu card \"Eu vou correr!\""); aCard.href = paginaProva + "#card";
  ac2.append(aCard, aProva);
  p2.append(ac2, el("p", "muted assess-nota", "O card sai com o nome da " + conv.e + ", pronto para postar nos stories."));
  app.append(p2);

  // ---------- Ritmo por pelotão ----------
  var kms = [];
  percursos.forEach(function (p) {
    var m = p.match(/(\d+(?:[.,]\d+)?)\s*km/i);
    if (m) { var v = parseFloat(m[1].replace(",", ".")); if (v >= 3 && kms.indexOf(v) < 0) kms.push(v); }
  });
  if (!kms.length) kms = [5, 10];
  kms.sort(function (a, b) { return a - b; });
  function tempo(seg) {
    seg = Math.round(seg);
    var h = Math.floor(seg / 3600), mi = Math.floor(seg % 3600 / 60), s = seg % 60;
    return (h ? h + "h" + (mi < 10 ? "0" : "") : "") + mi + (h ? "" : ":" + (s < 10 ? "0" : "") + s) + (h ? "min" : "");
  }
  var p3 = el("section", "assess-card");
  p3.append(el("p", "assess-card__step", "Treino"), el("h2", null, "Ritmo por pelotão"));
  p3.append(el("p", "muted", "Tempo final em cada distância da prova, conforme o ritmo médio por km. Combine o seu pelotão com " + (treinador || "o treinador") + "."));
  var wrapT = el("div", "assess-tab");
  var tab = el("table"), th = el("thead"), trh = el("tr");
  trh.append(el("th", null, "Ritmo por km"));
  kms.forEach(function (k) { trh.append(el("th", null, String(k).replace(".", ",") + " km")); });
  th.append(trh); tab.append(th);
  var tb = el("tbody");
  for (var r = 240; r <= 480; r += 30) {
    var tr = el("tr");
    tr.append(el("td", "assess-tab__n", Math.floor(r / 60) + ":" + (r % 60 < 10 ? "0" : "") + (r % 60) + " min/km"));
    kms.forEach(function (k) { tr.append(el("td", null, tempo(r * k))); });
    tb.append(tr);
  }
  tab.append(tb); wrapT.append(tab);
  var aRitmo = el("a", "orc__email", "Calcular meu ritmo exato na página da prova"); aRitmo.href = paginaProva + "#ritmo";
  p3.append(wrapT, aRitmo);
  app.append(p3);

  // Contato da organização
  if (SITE_.whatsapp) {
    var nota = el("p", "muted assess-nota");
    var wa = el("a", null, "fale com a Tardim Produções");
    wa.href = "https://wa.me/" + SITE_.whatsapp + "?text=" + encodeURIComponent("Olá! Sou atleta da " + conv.e + " e tenho uma dúvida sobre a " + ev.nome + ".");
    wa.target = "_blank"; wa.rel = "noopener";
    nota.append("Dúvidas sobre a inscrição são com o seu treinador. Sobre a prova, ", wa, ".");
    app.append(nota);
  }
})();
