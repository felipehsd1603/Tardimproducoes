/*
 * Inscrição coletiva para assessorias.
 * Tudo acontece no aparelho de quem usa: o site gera o modelo, confere a
 * planilha preenchida e monta o arquivo padronizado. Nenhum dado é enviado
 * a servidor; o arquivo segue para a Tardim Produções por WhatsApp ou e-mail.
 */
(function () {
  "use strict";
  var app = document.getElementById("assess-app");
  if (!app) return;

  var SITE_ = typeof SITE !== "undefined" ? SITE : {};
  var WHATSAPP = SITE_.whatsapp || "5531984289667";
  var EMAIL = SITE_.email || "tardimproducoes.corridas@gmail.com";
  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
    "agosto", "setembro", "outubro", "novembro", "dezembro"];
  var TAMANHOS_PADRAO = ["PP", "P", "M", "G", "GG", "XG", "XGG"];

  // Colunas do modelo (ordem do arquivo final)
  var COLS = [
    { id: "nome", titulo: "Nome completo", obrig: true, nomes: ["nome completo", "nome", "atleta", "nome do atleta"] },
    { id: "cpf", titulo: "CPF", obrig: true, nomes: ["cpf", "documento", "cpf do atleta"] },
    { id: "nasc", titulo: "Data de nascimento", obrig: true, nomes: ["data de nascimento", "nascimento", "data nascimento", "data nasc", "dt nascimento", "dt nasc", "nasc"] },
    { id: "sexo", titulo: "Sexo", obrig: true, nomes: ["sexo", "genero"] },
    { id: "dist", titulo: "Distância", obrig: true, nomes: ["distancia", "percurso", "modalidade", "prova", "km"] },
    { id: "cam", titulo: "Camiseta", obrig: true, nomes: ["camiseta", "tamanho", "tamanho da camiseta", "tam camiseta", "tam"] },
    { id: "email", titulo: "E-mail", obrig: true, nomes: ["e mail", "email", "e mail do atleta"] },
    { id: "tel", titulo: "Telefone", obrig: true, nomes: ["telefone", "celular", "whatsapp", "telefone celular", "fone"] },
    { id: "equipe", titulo: "Equipe", obrig: false, nomes: ["equipe", "assessoria", "time", "grupo"] },
  ];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function norm(s) {
    return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }
  function data(str) { var p = str.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function hoje() { var h = new Date(); h.setHours(0, 0, 0, 0); return h; }
  function slug(s) { return norm(s).replace(/ /g, "-").slice(0, 40) || "equipe"; }

  // Biblioteca de planilhas (carregada só quando precisa)
  var xlsxPronto = null;
  function xlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (xlsxPronto) return xlsxPronto;
    xlsxPronto = new Promise(function (ok, erro) {
      var s = document.createElement("script");
      s.src = "js/vendor/xlsx-0.18.5.min.js";
      s.onload = function () { ok(window.XLSX); };
      s.onerror = function () { xlsxPronto = null; erro(new Error("xlsx")); };
      document.head.append(s);
    });
    return xlsxPronto;
  }

  // Provas abertas
  var provas = (typeof PROXIMAS !== "undefined" ? PROXIMAS : [])
    .filter(function (p) { return p.data && data(p.data) >= hoje(); })
    .sort(function (a, b) { return a.data.localeCompare(b.data); });

  function distancias(ev) {
    var out = [];
    (Array.isArray(ev.percursos) ? ev.percursos : [ev.percursos || ""]).forEach(function (p) {
      var m = String(p).match(/(\d+(?:[.,]\d+)?)\s*km/i);
      if (m) out.push({ km: parseFloat(m[1].replace(",", ".")), rotulo: String(p).trim() });
    });
    return out;
  }
  function tamanhos(ev) { return ev.tamanhos && ev.tamanhos.length ? ev.tamanhos : TAMANHOS_PADRAO; }
  function quando(ev) { var d = data(ev.data); return d.getDate() + " de " + MESES[d.getMonth()] + " de " + d.getFullYear(); }

  // ---------- Interface ----------
  // ---------- Convite: a página só funciona com o link gerado pela Tardim Produções ----------
  function fimDoDia(str) { var d = data(str); d.setHours(23, 59, 59, 999); return d; }
  function bloqueia(titulo, texto, msgWa) {
    var c = el("div", "assess-card assess-card--fechado");
    c.append(el("h2", null, titulo), el("p", "muted", texto));
    var w = el("a", "btn btn--wa", "Falar com a Tardim Produções");
    w.href = "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(msgWa);
    w.target = "_blank"; w.rel = "noopener";
    c.append(w);
    app.append(c);
    var passos = document.querySelector(".assess-steps");
    if (passos) passos.hidden = true;
  }
  var codigo = new URLSearchParams(location.search).get("c");
  var convite = window.CONVITE ? CONVITE.le(codigo) : null;
  // Link público da equipe (dos atletas): vai para a página da equipe
  if (convite && convite.x) { location.replace("equipe.html?c=" + encodeURIComponent(codigo)); return; }
  if (!convite) {
    bloqueia("Página exclusiva para assessorias convidadas",
      "A inscrição coletiva é feita por um link que a Tardim Produções envia para cada assessoria. Se a sua equipe quer participar, peça o seu link.",
      "Olá! Sou de uma assessoria e gostaria do link para a inscrição coletiva da minha equipe.");
    return;
  }
  var provaConv = provas.filter(function (p) { return p.id === convite.p; })[0];
  if (!provaConv) {
    bloqueia("Este link não está mais ativo",
      "A prova deste convite já aconteceu ou não está com inscrições abertas. Fale com a Tardim Produções.",
      "Olá! Sou da equipe " + convite.e + " e o link da inscrição coletiva não está mais ativo.");
    return;
  }
  if (convite.d && new Date() > fimDoDia(convite.d)) {
    var dp = data(convite.d);
    bloqueia("O prazo deste link terminou",
      "A inscrição coletiva da equipe " + convite.e + " ia até " + dp.getDate() + " de " + MESES[dp.getMonth()] + ". Fale com a Tardim Produções para ver se ainda é possível.",
      "Olá! Sou da equipe " + convite.e + " e o prazo da inscrição coletiva da " + provaConv.nome + " terminou. Ainda é possível inscrever?");
    return;
  }
  var estado = { prova: provaConv, linhas: [], erros: 0, avisos: 0, arquivo: "" };
  var limite = Number(convite.m) || 0;

  // ---------- Personalização: a página com a cara da assessoria ----------
  var treinador = String(convite.t || "").trim();
  var corEquipe = CONVITE.cor(convite);
  var logoEquipe = CONVITE.logo(convite);
  (function () {
    var hero = document.querySelector(".assess-hero");
    if (!hero) return;
    if (corEquipe) { document.documentElement.style.setProperty("--equipe", corEquipe); document.body.classList.add("tem-equipe"); }
    var olho = hero.querySelector(".eyebrow"), h1 = hero.querySelector("h1"), lead = hero.querySelector(".assess-hero__lead");
    if (olho) olho.textContent = convite.e;
    if (h1) h1.textContent = treinador ? "Olá, " + treinador.split(" ")[0] + "! Vamos inscrever a equipe" : "Inscrição coletiva da " + convite.e;
    if (lead) lead.textContent = "Esta página foi preparada para a " + convite.e + " na " + provaConv.nome + ". Baixe o modelo, preencha, confira aqui e envie para a Tardim Produções com tudo certo na primeira.";
    if (logoEquipe && olho) {
      var lg = el("img", "equipe-logo");
      lg.alt = "Logo da " + convite.e;
      lg.onerror = function () { lg.remove(); };
      lg.src = logoEquipe;
      olho.before(lg);
    }
    document.title = convite.e + " · Inscrição coletiva · Tardim Produções";
  })();

  // Condição comercial combinada (mostrada no site; o valor final é conferido pela Tardim Produções)
  var valorAtleta = Number(convite.v) > 0 ? Number(convite.v) : 0;
  var cortesias = Number(convite.k) > 0 ? Math.floor(Number(convite.k)) : 0;
  var pagamento = String(convite.g || "").trim();
  var faixas = (Array.isArray(convite.f) ? convite.f : [])
    .map(function (f) { return [Math.floor(Number(f && f[0])), Number(f && f[1])]; })
    .filter(function (f) { return f[0] > 0 && f[1] > 0 && f[1] <= 100; })
    .sort(function (a, b) { return a[0] - b[0]; });
  var temCondicao = !!(valorAtleta || faixas.length || cortesias || pagamento);
  function reais(v) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
  function pct(v) { return String(v).replace(".", ",") + "%"; }
  function atletasTxt(n) { return n + (n === 1 ? " atleta" : " atletas"); }
  function conta(n) {
    var atual = null, prox = null;
    faixas.forEach(function (f) { if (n >= f[0]) atual = f; else if (!prox) prox = f; });
    var desc = atual ? atual[1] : 0;
    var gratis = Math.min(cortesias, n);
    var unit = valorAtleta * (1 - desc / 100);
    return { desc: desc, prox: prox, gratis: gratis, pagantes: n - gratis, unit: unit, total: (n - gratis) * unit, cheio: n * valorAtleta };
  }
  // Barra "faltam X atletas para a próxima faixa"
  function progresso(n) {
    if (!faixas.length) return null;
    var c = conta(n);
    var box = el("div", "assess-meta");
    var barra = el("div", "assess-meta__barra");
    var fill = el("span");
    var alvo = c.prox ? c.prox[0] : faixas[faixas.length - 1][0];
    fill.style.width = Math.max(4, Math.min(100, Math.round(n / alvo * 100))) + "%";
    barra.append(fill);
    var txt = el("p", "assess-meta__txt");
    if (c.prox) {
      var falta = c.prox[0] - n;
      txt.append(el("b", null, falta === 1 ? "Falta 1 atleta" : "Faltam " + falta + " atletas"), " para " + pct(c.prox[1]) + " de desconto" + (c.desc ? " (hoje: " + pct(c.desc) + ")" : "") + ".");
    } else {
      txt.append(el("b", null, "Maior faixa alcançada: "), pct(c.desc) + " de desconto para a equipe.");
    }
    var marcos = el("ul", "assess-meta__faixas");
    faixas.forEach(function (f) {
      var li = el("li", n >= f[0] ? "is-on" : "");
      li.append(el("b", null, pct(f[1])), el("span", null, "a partir de " + f[0]));
      marcos.append(li);
    });
    box.append(txt, barra, marcos);
    return box;
  }
  function linhasCondicao(n) {
    var l = [], c = conta(n);
    if (valorAtleta) l.push(["Valor por atleta", reais(valorAtleta)]);
    if (faixas.length) l.push(["Desconto por volume", n ? (c.desc ? pct(c.desc) + " (" + atletasTxt(n) + ")" : "ainda sem desconto") : faixas.map(function (f) { return pct(f[1]) + " a partir de " + f[0]; }).join(" · ")]);
    if (cortesias) l.push(["Cortesias", cortesias === 1 ? "1 inscrição grátis" : cortesias + " inscrições grátis"]);
    if (pagamento) l.push(["Pagamento", pagamento]);
    if (n && valorAtleta) {
      l.push(["Atletas pagantes", String(c.pagantes)]);
      l.push(["Total estimado", reais(c.total)]);
      if (c.cheio - c.total > 0.005) l.push(["Economia da equipe", reais(c.cheio - c.total)]);
    }
    return l;
  }
  function tabelaCondicao(n) {
    var dl = el("dl", "assess-cond");
    linhasCondicao(n).forEach(function (p) { dl.append(el("dt", null, p[0]), el("dd", null, p[1])); });
    return dl;
  }
  var NOTA_VALOR = "Condição combinada com a Tardim Produções para este convite. O valor final é confirmado quando a planilha é recebida.";

  // Benefícios do dia da prova
  var BENEFICIOS = {
    t: ["Espaço para a tenda da equipe", "Área reservada na arena para montar a tenda da " + convite.e + "."],
    k: ["Retirada de kits em lote", String(convite.kt || "").trim() || "O responsável retira os kits de toda a equipe de uma vez. A Tardim Produções combina dia e horário."],
    f: ["Foto oficial da equipe", "Foto da equipe no pórtico, antes da largada."],
    e: ["Ponto de encontro", String(convite.pe || "").trim() || "Local de encontro da equipe na arena, combinado com a Tardim Produções."],
  };
  var beneficios = String(convite.b || "").split("").filter(function (k, i, a) { return BENEFICIOS[k] && a.indexOf(k) === i; });

  // Link público da equipe, para o treinador mandar aos atletas
  var linkEquipe = location.href.split("#")[0].split("?")[0].replace(/[^\/]*$/, "") + "equipe.html?c=" + CONVITE.publico(convite);
  function dataCurta(str) { var d = data(str); return d.getDate() + " de " + MESES[d.getMonth()]; }
  var prazoAtletas = convite.i || convite.d || "";

  // Condições e benefícios da equipe
  if (temCondicao || beneficios.length) {
    var p0 = el("section", "assess-card assess-card--equipe");
    p0.append(el("p", "assess-card__step", "Exclusivo da " + convite.e), el("h2", null, "O que foi combinado com a sua equipe"));
    if (temCondicao) {
      p0.append(tabelaCondicao(0));
      var meta0 = progresso(0);
      if (meta0) p0.append(meta0);
      if (valorAtleta || faixas.length) p0.append(el("p", "muted assess-nota", NOTA_VALOR));
    }
    if (beneficios.length) {
      p0.append(el("h3", "assess-benef__t", "No dia da prova"));
      var ulB = el("ul", "assess-benef");
      beneficios.forEach(function (k) {
        var li = el("li");
        li.append(el("b", null, BENEFICIOS[k][0]), el("span", null, BENEFICIOS[k][1]));
        ulB.append(li);
      });
      p0.append(ulB);
    }
    app.append(p0);
  }

  // Passo 1: prova, equipe e modelo
  var p1 = el("section", "assess-card");
  p1.append(el("p", "assess-card__step", "Passo 1"), el("h2", null, "Baixe o modelo da planilha"));
  var conv = el("div", "assess-convite");
  conv.append(el("span", "assess-convite__t", "Convite da Tardim Produções"));
  conv.append(el("b", null, convite.e));
  conv.append(el("span", null, estado.prova.nome + " · " + quando(estado.prova)));
  var extras = [];
  if (convite.d) { var dz = data(convite.d); extras.push("Envie até " + dz.getDate() + " de " + MESES[dz.getMonth()]); }
  if (limite) extras.push("Até " + limite + " atletas");
  if (extras.length) conv.append(el("small", null, extras.join(" · ")));
  p1.append(conv);
  var g1 = el("div", "assess-grid");
  function campo(rotulo, input, dica) {
    var l = el("label", "orc__field");
    l.append(el("span", null, rotulo), input);
    if (dica) l.append(el("small", "assess-dica", dica));
    return l;
  }
  var inEquipe = el("input"); inEquipe.value = convite.e; inEquipe.readOnly = true;
  var inResp = el("input"); inResp.placeholder = "Quem está enviando"; inResp.autocomplete = "name";
  var inTel = el("input"); inTel.placeholder = "(31) 90000-0000"; inTel.type = "tel"; inTel.autocomplete = "tel";
  if (treinador) inResp.value = treinador;
  if (convite.w) inTel.value = telefone(String(convite.w)) || "";
  g1.append(campo("Responsável", inResp), campo("WhatsApp do responsável", inTel));
  var info = el("div", "assess-info");
  var acoes1 = el("div", "assess-acoes");
  var bModelo = el("button", "btn btn--red", "Baixar modelo (Excel)");
  bModelo.type = "button";
  var bCsv = el("button", "orc__email", "Prefiro o modelo em CSV");
  bCsv.type = "button";
  acoes1.append(bModelo, bCsv);
  p1.append(g1, info, acoes1);
  app.append(p1);

  function mostraInfo() {
    var ev = estado.prova;
    info.innerHTML = "";
    var ds = distancias(ev);
    var li = el("ul", "assess-info__list");
    var a = el("li"); a.append(el("b", null, "Distâncias: "), ds.length ? ds.map(function (d) { return d.rotulo; }).join(", ") : "informe a distância como aparece no regulamento");
    var b = el("li"); b.append(el("b", null, "Camisetas: "), tamanhos(ev).join(", "));
    var c = el("li"); c.append(el("b", null, "Obrigatórios: "), "nome, CPF, nascimento, sexo, distância, camiseta, e-mail e telefone");
    var d = el("li"); d.append(el("b", null, "Dica: "), "se a sua equipe já tem uma planilha própria, pode enviar ela mesma. O site reconhece as colunas.");
    li.append(a, b, c, d);
    info.append(li);
  }
  mostraInfo();

  function linhaExemplo(ev) {
    var ds = distancias(ev);
    return ["Maria da Silva Exemplo", "123.456.789-09", "15/03/1990", "F", ds.length ? ds[0].rotulo : "Corrida", tamanhos(ev)[2] || "M", "maria@exemplo.com", "(31) 99999-0000", inEquipe.value.trim() || "Nome da equipe"];
  }
  bModelo.addEventListener("click", function () {
    var ev = estado.prova;
    bModelo.disabled = true;
    xlsx().then(function (X) {
      var wb = X.utils.book_new();
      var cab = COLS.map(function (c) { return c.titulo; });
      // Coluna "Equipe" já preenchida nas linhas dos atletas
      var vagas = limite || 50, prontas = [];
      for (var k = 0; k < vagas; k++) prontas.push(["", "", "", "", "", "", "", "", convite.e]);
      var ws = X.utils.aoa_to_sheet([cab, linhaExemplo(ev)].concat(prontas));
      ws["!cols"] = [{ wch: 32 }, { wch: 16 }, { wch: 18 }, { wch: 8 }, { wch: 18 }, { wch: 11 }, { wch: 28 }, { wch: 17 }, { wch: 22 }];
      X.utils.book_append_sheet(wb, ws, "Atletas");
      var ds = distancias(ev);
      var instr = [
        ["Inscrição coletiva · " + ev.nome],
        [quando(ev)],
        ["Equipe: " + convite.e + (convite.d ? " · enviar até " + dataCurta(convite.d) : "") + (limite ? " · até " + limite + " atletas" : "")],
        [""],
        ["Como preencher"],
        ["1. Uma linha por atleta, a partir da linha 3. A linha 2 é só um exemplo (o site ignora). A coluna Equipe já vem preenchida."],
        ["2. Não mude a ordem nem o nome das colunas."],
        ["3. Data de nascimento no formato dd/mm/aaaa."],
        ["4. Sexo: F ou M."],
        ["5. Distância: " + (ds.length ? ds.map(function (d) { return d.rotulo; }).join(" / ") : "como aparece no regulamento")],
        ["6. Camiseta: " + tamanhos(ev).join(" / ")],
        ["7. Quando terminar, confira o arquivo no site antes de enviar: " + location.href.split("?")[0]],
      ];
      var wi = X.utils.aoa_to_sheet(instr);
      wi["!cols"] = [{ wch: 90 }];
      X.utils.book_append_sheet(wb, wi, "Como preencher");
      X.writeFile(wb, "Modelo-inscricao-coletiva_" + slug(convite.e) + "_" + slug(ev.nome) + ".xlsx");
    }).catch(function () { alert("Não foi possível gerar o modelo agora. Tente o modelo em CSV."); })
      .then(function () { bModelo.disabled = false; });
  });
  bCsv.addEventListener("click", function () {
    var ev = estado.prova;
    var q = function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; };
    var txt = "﻿" + [COLS.map(function (c) { return q(c.titulo); }).join(";"), linhaExemplo(ev).map(q).join(";")].join("\r\n");
    var a = el("a");
    a.href = URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" }));
    a.download = "Modelo-inscricao-coletiva_" + slug(ev.nome) + ".csv";
    document.body.append(a); a.click(); a.remove();
  });

  // Passo 2: enviar o arquivo para conferir
  var p2 = el("section", "assess-card");
  p2.append(el("p", "assess-card__step", "Passo 2"), el("h2", null, "Confira a planilha preenchida"));
  p2.append(el("p", "muted", "O arquivo é conferido aqui mesmo, no seu aparelho. Nada é enviado até você decidir mandar."));
  var drop = el("label", "assess-drop");
  var inArq = el("input");
  inArq.type = "file";
  inArq.accept = ".xlsx,.xls,.csv,.ods";
  inArq.className = "sr-only";
  drop.append(inArq);
  drop.append(el("b", null, "Toque para escolher a planilha"), el("span", null, "ou arraste o arquivo para cá · Excel, CSV ou Google Planilhas baixada"));
  var status = el("p", "assess-status");
  status.setAttribute("role", "status");
  p2.append(drop, status);
  app.append(p2);

  ["dragenter", "dragover"].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add("is-over"); }); });
  ["dragleave", "drop"].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove("is-over"); }); });
  drop.addEventListener("drop", function (e) { if (e.dataTransfer.files[0]) le(e.dataTransfer.files[0]); });
  inArq.addEventListener("change", function () { if (inArq.files[0]) le(inArq.files[0]); inArq.value = ""; });

  // Resultado
  var p3 = el("section", "assess-card");
  p3.hidden = true;
  app.append(p3);

  function le(arquivo) {
    status.textContent = "Lendo " + arquivo.name + "…";
    estado.arquivo = arquivo.name;
    Promise.all([xlsx(), arquivo.arrayBuffer()]).then(function (r) {
      var X = r[0];
      // CSV é lido como texto puro: assim "10/05/1988" continua dia/mês (sem virar data americana)
      var csv = /\.(csv|txt)$/i.test(arquivo.name);
      var wb = X.read(r[1], csv ? { type: "array", raw: true, codepage: 65001 } : { type: "array", cellDates: true });
      var ws = wb.Sheets[wb.SheetNames[0]];
      var linhas = X.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
      importa(linhas);
    }).catch(function () {
      status.textContent = "Não foi possível ler esse arquivo. Salve como Excel (.xlsx) ou CSV e tente de novo.";
    });
  }

  function mapaColunas(cab) {
    var mapa = {};
    cab.forEach(function (t, i) {
      var n = norm(t);
      COLS.forEach(function (c) { if (mapa[c.id] == null && c.nomes.indexOf(n) >= 0) mapa[c.id] = i; });
    });
    // Segunda passada: nomes que contêm a palavra-chave
    cab.forEach(function (t, i) {
      var n = norm(t);
      COLS.forEach(function (c) {
        if (mapa[c.id] != null) return;
        if (c.nomes.some(function (k) { return k.length > 3 && n.indexOf(k) >= 0; })) {
          var usado = Object.keys(mapa).some(function (k) { return mapa[k] === i; });
          if (!usado) mapa[c.id] = i;
        }
      });
    });
    return mapa;
  }

  var faltando = [];
  function importa(linhas) {
    // Primeira linha com pelo menos 3 títulos reconhecidos é o cabeçalho
    var iCab = -1, mapa = {};
    for (var i = 0; i < Math.min(linhas.length, 10); i++) {
      var m = mapaColunas(linhas[i]);
      if (Object.keys(m).length >= 3) { iCab = i; mapa = m; break; }
    }
    p3.hidden = false;
    if (iCab < 0) {
      estado.linhas = [];
      faltando = COLS.filter(function (c) { return c.obrig; }).map(function (c) { return c.titulo; });
      status.textContent = "Não encontramos os títulos das colunas. Use o modelo do passo 1.";
      desenha();
      return;
    }
    faltando = COLS.filter(function (c) { return c.obrig && mapa[c.id] == null; }).map(function (c) { return c.titulo; });
    estado.linhas = [];
    for (var j = iCab + 1; j < linhas.length; j++) {
      var row = linhas[j];
      if (!row.some(function (v) { return String(v).trim() !== ""; })) continue;
      var bruto = {};
      COLS.forEach(function (c) { bruto[c.id] = mapa[c.id] != null ? row[mapa[c.id]] : ""; });
      // Ignora as linhas do modelo que só têm a equipe e a linha de exemplo
      if (COLS.every(function (c) { return c.id === "equipe" || String(bruto[c.id]).trim() === ""; })) continue;
      if (norm(bruto.nome) === "maria da silva exemplo") continue;
      estado.linhas.push({ n: j + 1, bruto: bruto });
    }
    status.textContent = estado.arquivo + ": " + estado.linhas.length + (estado.linhas.length === 1 ? " atleta encontrado." : " atletas encontrados.");
    valida();
    desenha();
  }

  // ---------- Conferência ----------
  function cpfValido(d) {
    if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
    for (var t = 9; t < 11; t++) {
      var s = 0;
      for (var i = 0; i < t; i++) s += Number(d[i]) * (t + 1 - i);
      var dv = (s * 10) % 11 % 10;
      if (dv !== Number(d[t])) return false;
    }
    return true;
  }
  function dataNasc(v) {
    if (v instanceof Date && !isNaN(v)) return new Date(v.getFullYear(), v.getMonth(), v.getDate() + (v.getHours() >= 12 ? 1 : 0));
    if (typeof v === "number" && v > 1000 && v < 80000) { var b = new Date(Date.UTC(1899, 11, 30) + v * 86400000); return new Date(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()); }
    var s = String(v).trim();
    var m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/.exec(s);
    if (m) {
      var a = Number(m[3]); if (a < 100) a += a > (new Date().getFullYear() % 100) ? 1900 : 2000;
      var d = new Date(a, Number(m[2]) - 1, Number(m[1]));
      if (d.getDate() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1) return d;
      return null;
    }
    m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return null;
  }
  function dd(n) { return (n < 10 ? "0" : "") + n; }
  function fmtData(d) { return dd(d.getDate()) + "/" + dd(d.getMonth() + 1) + "/" + d.getFullYear(); }
  function sexo(v) {
    var n = norm(v);
    if (/^(f|fem|feminino|mulher)$/.test(n)) return "F";
    if (/^(m|masc|masculino|homem)$/.test(n)) return "M";
    return "";
  }
  function distancia(v, ev) {
    var ds = distancias(ev);
    var s = String(v).trim();
    if (!ds.length) return s;
    var m = s.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
    if (m) {
      var km = parseFloat(m[1]);
      var acha = ds.filter(function (d) { return d.km === km; })[0];
      if (acha) return acha.rotulo;
    }
    var n = norm(s);
    var porNome = ds.filter(function (d) { return norm(d.rotulo) === n; })[0];
    return porNome ? porNome.rotulo : "";
  }
  function camiseta(v, ev) {
    var n = norm(v).toUpperCase().replace(/ /g, "");
    var alias = { EG: "XG", EXG: "XGG", XXG: "XGG", GG1: "XG", G1: "XG", G2: "XGG", PEQUENA: "P", MEDIA: "M", GRANDE: "G" };
    n = alias[n] || n;
    var lista = tamanhos(ev);
    return lista.filter(function (t) { return t.toUpperCase().replace(/ /g, "") === n; })[0] || "";
  }
  function telefone(v) {
    var d = String(v).replace(/\D/g, "");
    if (d.length > 11 && d.indexOf("55") === 0) d = d.slice(2);
    if (d.length === 11) return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
    if (d.length === 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
    return "";
  }

  function valida() {
    var ev = estado.prova;
    var dia = data(ev.data);
    var vistos = {};
    estado.erros = 0; estado.avisos = 0;
    estado.linhas.forEach(function (l) {
      var b = l.bruto, v = {}, erros = [], avisos = [];
      v.nome = String(b.nome).replace(/\s+/g, " ").trim();
      if (!v.nome) erros.push(["nome", "Nome em branco"]);
      else if (v.nome.split(" ").length < 2) avisos.push(["nome", "Informe nome e sobrenome"]);
      var cpf = String(b.cpf).replace(/\D/g, "");
      if (cpf.length > 0 && cpf.length < 11) cpf = ("00000000000" + cpf).slice(-11); // zeros que o Excel corta
      if (!String(b.cpf).trim()) erros.push(["cpf", "CPF em branco"]);
      else if (!cpfValido(cpf)) erros.push(["cpf", "CPF inválido"]);
      else {
        v.cpf = cpf.slice(0, 3) + "." + cpf.slice(3, 6) + "." + cpf.slice(6, 9) + "-" + cpf.slice(9);
        if (vistos[cpf]) erros.push(["cpf", "CPF repetido (linha " + vistos[cpf] + ")"]);
        else vistos[cpf] = l.n;
      }
      var nasc = String(b.nasc).trim() === "" ? null : dataNasc(b.nasc);
      if (String(b.nasc).trim() === "") erros.push(["nasc", "Nascimento em branco"]);
      else if (!nasc) erros.push(["nasc", "Data inválida (use dd/mm/aaaa)"]);
      else {
        var idade = dia.getFullYear() - nasc.getFullYear() - ((dia.getMonth() < nasc.getMonth() || (dia.getMonth() === nasc.getMonth() && dia.getDate() < nasc.getDate())) ? 1 : 0);
        v.nasc = fmtData(nasc);
        v.idade = idade;
        if (idade < 3 || idade > 100) erros.push(["nasc", "Idade de " + idade + " anos: confira a data"]);
      }
      v.sexo = sexo(b.sexo);
      if (!v.sexo) erros.push(["sexo", String(b.sexo).trim() ? "Sexo deve ser F ou M" : "Sexo em branco"]);
      v.dist = distancia(b.dist, ev);
      if (!v.dist) erros.push(["dist", String(b.dist).trim() ? "Distância não existe nesta prova" : "Distância em branco"]);
      v.cam = camiseta(b.cam, ev);
      if (!v.cam) erros.push(["cam", String(b.cam).trim() ? "Tamanho fora da lista" : "Camiseta em branco"]);
      v.email = String(b.email).trim().toLowerCase();
      if (!v.email) erros.push(["email", "E-mail em branco"]);
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) erros.push(["email", "E-mail inválido"]);
      v.tel = telefone(b.tel);
      if (!String(b.tel).trim()) erros.push(["tel", "Telefone em branco"]);
      else if (!v.tel) erros.push(["tel", "Telefone com DDD: 10 ou 11 números"]);
      v.equipe = String(b.equipe).trim() || inEquipe.value.trim();
      l.v = v; l.erros = erros; l.avisos = avisos;
      estado.erros += erros.length;
      estado.avisos += avisos.length;
    });
  }

  // ---------- Resultado ----------
  var soErros = false;
  var registrado = "";
  function desenha() {
    p3.innerHTML = "";
    p3.append(el("p", "assess-card__step", "Resultado"));
    var total = estado.linhas.length;
    var comErro = estado.linhas.filter(function (l) { return l.erros.length; }).length;
    var passou = limite && total > limite;
    if (faltando.length) {
      p3.append(el("h2", null, "Faltam colunas na planilha"));
      p3.append(el("p", "assess-alerta", "Não encontramos: " + faltando.join(", ") + ". Baixe o modelo no passo 1 e copie os dados para ele."));
      return;
    }
    if (!total) {
      p3.append(el("h2", null, "Nenhum atleta na planilha"));
      p3.append(el("p", "muted", "Preencha a partir da linha 2 do modelo e envie de novo."));
      return;
    }
    p3.append(el("h2", null, comErro ? "Quase lá: corrija " + comErro + (comErro === 1 ? " linha" : " linhas") : passou ? "Passou do limite de atletas" : "Tudo certo com a sua planilha"));
    if (passou) p3.append(el("p", "assess-alerta", "O convite da sua equipe é para até " + limite + " atletas, e a planilha tem " + total + ". Tire " + (total - limite) + " ou fale com a Tardim Produções."));

    // Números
    var nums = el("div", "assess-nums");
    function num(v, t, cls) { var d = el("div", "assess-num" + (cls ? " " + cls : "")); d.append(el("b", null, String(v)), el("span", null, t)); nums.append(d); }
    num(total, total === 1 ? "atleta" : "atletas");
    num(total - comErro, "prontos", "is-ok");
    num(comErro, comErro === 1 ? "com erro" : "com erro", comErro ? "is-erro" : "");
    p3.append(nums);

    // Condição da equipe com o número de atletas da planilha
    if (valorAtleta || faixas.length) {
      var cond = el("div", "assess-valor");
      cond.append(el("p", "assess-resumo__t", "Condição da " + convite.e));
      var metaN = progresso(total);
      if (metaN) cond.append(metaN);
      cond.append(tabelaCondicao(total), el("p", "muted assess-nota", NOTA_VALOR));
      p3.append(cond);
    }

    // Resumo por distância e camiseta
    var porDist = {}, porCam = {}, porSexo = { F: 0, M: 0 };
    estado.linhas.forEach(function (l) {
      if (l.v.dist) porDist[l.v.dist] = (porDist[l.v.dist] || 0) + 1;
      if (l.v.cam) porCam[l.v.cam] = (porCam[l.v.cam] || 0) + 1;
      if (l.v.sexo) porSexo[l.v.sexo]++;
    });
    var res = el("div", "assess-resumo");
    function bloco(titulo, obj, ordem) {
      var b = el("div");
      b.append(el("p", "assess-resumo__t", titulo));
      var ul = el("ul");
      (ordem || Object.keys(obj)).forEach(function (k) { if (obj[k]) { var li = el("li"); li.append(el("span", null, k), el("b", null, String(obj[k]))); ul.append(li); } });
      b.append(ul);
      res.append(b);
    }
    bloco("Por distância", porDist);
    bloco("Por camiseta", porCam, tamanhos(estado.prova));
    bloco("Por sexo", { Feminino: porSexo.F, Masculino: porSexo.M });
    p3.append(res);

    // Tabela
    var topoTab = el("div", "assess-tab__top");
    if (comErro) {
      var tg = el("label", "assess-toggle");
      var cb = el("input"); cb.type = "checkbox"; cb.checked = soErros;
      cb.addEventListener("change", function () { soErros = cb.checked; desenha(); });
      tg.append(cb, " Mostrar só as linhas com erro");
      topoTab.append(tg);
    }
    if (estado.avisos) topoTab.append(el("span", "assess-legenda", estado.avisos + (estado.avisos === 1 ? " aviso" : " avisos") + " (não impede o envio)"));
    p3.append(topoTab);
    var wrapT = el("div", "assess-tab");
    var t = el("table");
    var thead = el("thead"), trh = el("tr");
    trh.append(el("th", null, "Linha"));
    COLS.forEach(function (c) { trh.append(el("th", null, c.titulo)); });
    thead.append(trh); t.append(thead);
    var tb = el("tbody");
    estado.linhas.forEach(function (l) {
      if (soErros && !l.erros.length) return;
      var tr = el("tr", l.erros.length ? "is-erro" : "");
      tr.append(el("td", "assess-tab__n", String(l.n)));
      COLS.forEach(function (c) {
        var er = l.erros.filter(function (e) { return e[0] === c.id; })[0];
        var av = l.avisos.filter(function (e) { return e[0] === c.id; })[0];
        var mostra = l.v[c.id] || String(l.bruto[c.id] instanceof Date ? fmtData(l.bruto[c.id]) : l.bruto[c.id]).trim();
        var td = el("td", er ? "has-erro" : av ? "has-aviso" : "");
        td.append(el("span", null, mostra || "—"));
        if (er || av) td.append(el("small", null, (er || av)[1]));
        tr.append(td);
      });
      tb.append(tr);
    });
    t.append(tb);
    wrapT.append(t);
    p3.append(wrapT);
    if (comErro) p3.append(el("p", "muted assess-nota", "Corrija as linhas marcadas na sua planilha e envie o arquivo de novo no passo 2."));

    // Passo 3: enviar
    var envio = el("div", "assess-envio");
    envio.append(el("p", "assess-card__step", "Passo 3"), el("h3", null, "Enviar para a Tardim Produções"));
    var ok = el("label", "assess-toggle");
    var aut = el("input"); aut.type = "checkbox";
    ok.append(aut, " Confirmo que os atletas autorizaram o envio dos seus dados para a inscrição.");
    var bt = el("div", "assess-acoes");
    var bBaixar = el("button", "btn btn--line", "Baixar planilha conferida");
    bBaixar.type = "button";
    var bWa = el("button", "btn btn--wa", "Enviar pelo WhatsApp");
    bWa.type = "button";
    var bMail = el("button", "orc__email", "Enviar por e-mail");
    bMail.type = "button";
    bt.append(bWa, bBaixar, bMail);
    var aviso = el("p", "assess-status");
    aviso.setAttribute("role", "status");
    envio.append(ok, bt, aviso);
    p3.append(envio);
    var bloqueado = !!comErro || !!passou;
    [bBaixar, bWa, bMail].forEach(function (b) { b.disabled = bloqueado; });
    if (bloqueado) aviso.textContent = passou && !comErro ? "O envio libera quando a planilha estiver dentro do limite." : "O envio libera quando não houver erros.";

    aut.addEventListener("change", function () { if (aut.checked && /autoriza/.test(aviso.textContent)) aviso.textContent = ""; });
    function confere() {
      if (!aut.checked) { aviso.textContent = "Marque a confirmação de autorização dos atletas."; aut.focus(); return false; }
      return true;
    }
    bBaixar.addEventListener("click", function () { if (confere()) geraArquivo().then(function (f) { baixa(f); aviso.textContent = "Planilha baixada: " + f.name; }); });
    // Guarda a inscrição no banco do site (Cloudflare D1). Nunca atrapalha o envio.
    function registra(canal) {
      var dados = {
        prova: { id: estado.prova.id, nome: estado.prova.nome }, convite: codigo || "",
        equipe: inEquipe.value.trim(), responsavel: inResp.value.trim(), telefone: inTel.value.trim(),
        atletas: estado.linhas.map(function (l) { return l.v; }),
      };
      var chave = JSON.stringify(dados);
      if (chave === registrado) return;
      registrado = chave;
      dados.canal = canal;
      try {
        fetch("/api/inscricao", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(dados) })
          .catch(function () {});
      } catch (e) {}
    }
    bWa.addEventListener("click", function () {
      if (!confere()) return;
      registra("whatsapp");
      geraArquivo().then(function (f) {
        var texto = resumoTexto(true);
        if (navigator.canShare && navigator.canShare({ files: [f] })) {
          navigator.share({ files: [f], text: texto.replace(/\*/g, "") }).catch(function () {});
          aviso.textContent = "Escolha o WhatsApp da Tardim Produções na lista para mandar o arquivo.";
        } else {
          baixa(f);
          window.open("https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(texto + "\n\nVou anexar a planilha: " + f.name), "_blank", "noopener");
          aviso.textContent = "Baixamos a planilha (" + f.name + ") e abrimos o WhatsApp com o resumo. Anexe o arquivo na conversa para concluir.";
        }
      });
    });
    bMail.addEventListener("click", function () {
      if (!confere()) return;
      registra("email");
      geraArquivo().then(function (f) {
        baixa(f);
        location.href = "mailto:" + EMAIL + "?subject=" + encodeURIComponent("Inscrição coletiva: " + inEquipe.value.trim() + " · " + estado.prova.nome) + "&body=" + encodeURIComponent(resumoTexto(false) + "\n\nSegue em anexo a planilha: " + f.name);
        aviso.textContent = "Baixamos a planilha (" + f.name + ") e abrimos o seu e-mail com o resumo. Anexe o arquivo antes de enviar.";
      });
    });

    function resumoTexto(negrito) {
      var b = function (s) { return negrito ? "*" + s + "*" : s; };
      var l = ["Olá! Segue a inscrição coletiva da nossa equipe.", ""];
      l.push(b("Prova:") + " " + estado.prova.nome + " (" + quando(estado.prova) + ")");
      l.push(b("Equipe:") + " " + inEquipe.value.trim());
      if (inResp.value.trim()) l.push(b("Responsável:") + " " + inResp.value.trim() + (inTel.value.trim() ? " · " + inTel.value.trim() : ""));
      l.push(b("Atletas:") + " " + total);
      l.push(b("Por distância:") + " " + Object.keys(porDist).map(function (k) { return k + ": " + porDist[k]; }).join(" · "));
      l.push(b("Camisetas:") + " " + tamanhos(estado.prova).filter(function (k) { return porCam[k]; }).map(function (k) { return k + ": " + porCam[k]; }).join(" · "));
      if (temCondicao) {
        l.push("", b("Condição do convite (a confirmar):"));
        linhasCondicao(total).forEach(function (p) { l.push(p[0] + ": " + p[1]); });
      }
      l.push("", "Planilha conferida no site da Tardim Produções.");
      return l.join("\n");
    }
  }

  function geraArquivo() {
    return xlsx().then(function (X) {
      var wb = X.utils.book_new();
      var cab = COLS.map(function (c) { return c.titulo; });
      var linhas = estado.linhas.map(function (l) { return COLS.map(function (c) { return l.v[c.id] || ""; }); });
      var ws = X.utils.aoa_to_sheet([cab].concat(linhas));
      ws["!cols"] = [{ wch: 32 }, { wch: 16 }, { wch: 18 }, { wch: 8 }, { wch: 18 }, { wch: 11 }, { wch: 28 }, { wch: 17 }, { wch: 22 }];
      X.utils.book_append_sheet(wb, ws, "Atletas");
      var r = [["Inscrição coletiva"], ["Prova", estado.prova.nome], ["Data", quando(estado.prova)], ["Equipe", inEquipe.value.trim()],
        ["Responsável", inResp.value.trim()], ["WhatsApp", inTel.value.trim()], ["Atletas", estado.linhas.length], ["Conferida em", fmtData(new Date())]];
      if (temCondicao) r = r.concat([[""], ["Condição do convite (a confirmar pela Tardim Produções)"]], linhasCondicao(estado.linhas.length));
      var wr = X.utils.aoa_to_sheet(r);
      wr["!cols"] = [{ wch: 16 }, { wch: 50 }];
      X.utils.book_append_sheet(wb, wr, "Resumo");
      var nome = "Inscricao-coletiva_" + slug(inEquipe.value) + "_" + slug(estado.prova.nome) + ".xlsx";
      var buf = X.write(wb, { bookType: "xlsx", type: "array" });
      return new File([buf], nome, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    });
  }
  function baixa(f) {
    var a = el("a");
    a.href = URL.createObjectURL(f);
    a.download = f.name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  // ---------- Página da equipe e mensagens prontas para os atletas ----------
  function copia(texto, botao, rotulo) {
    var feito = function () { botao.textContent = "Copiado!"; setTimeout(function () { botao.textContent = rotulo; }, 2000); };
    var reserva = function () {
      var t = el("textarea"); t.value = texto; t.style.position = "fixed"; t.style.opacity = "0";
      document.body.append(t); t.select();
      try { document.execCommand("copy"); } catch (e) {}
      t.remove(); feito();
    };
    if (navigator.clipboard) navigator.clipboard.writeText(texto).then(feito, reserva); else reserva();
  }
  var p4 = el("section", "assess-card");
  p4.append(el("p", "assess-card__step", "Para os seus atletas"), el("h2", null, "Página da " + convite.e + " e mensagens prontas"));
  p4.append(el("p", "muted", "Mande este link no grupo da equipe. Cada atleta vê a prova, o prazo e envia os dados dele direto para você, já no formato da planilha."));
  var cx = el("div", "convite-link");
  var inLink = el("input"); inLink.readOnly = true; inLink.value = linkEquipe;
  inLink.setAttribute("aria-label", "Link da página da equipe");
  inLink.addEventListener("focus", function () { inLink.select(); });
  cx.append(inLink);
  var acL = el("div", "assess-acoes");
  var bCopiaLink = el("button", "btn btn--red", "Copiar link da equipe"); bCopiaLink.type = "button";
  bCopiaLink.addEventListener("click", function () { copia(linkEquipe, bCopiaLink, "Copiar link da equipe"); });
  var aVer = el("a", "orc__email", "Ver a página da equipe"); aVer.href = linkEquipe; aVer.target = "_blank"; aVer.rel = "noopener";
  acL.append(bCopiaLink, aVer);
  p4.append(cx, acL);

  var ev0 = estado.prova;
  var ate = prazoAtletas ? " até " + dataCurta(prazoAtletas) : " o quanto antes";
  var mensagens = [
    ["Convite para o grupo",
      "Pessoal, a " + convite.e + " vai correr a *" + ev0.nome + "*!\n" + quando(ev0) + (ev0.hora ? ", largada às " + ev0.hora : "") + (ev0.local ? "\n" + ev0.local : "") +
      "\n\nA inscrição é coletiva, pela equipe. Veja os detalhes e me mande seus dados" + ate + " por este link:\n" + linkEquipe],
    ["Lembrete de prazo",
      "Lembrete, pessoal: quem vai correr a *" + ev0.nome + "* com a " + convite.e + " precisa me mandar os dados" + ate + ". Depois disso a lista fecha.\n\nÉ rápido, pelo link:\n" + linkEquipe],
    ["Retirada de kit",
      "Kits da *" + ev0.nome + "*: " + (beneficios.indexOf("k") >= 0
        ? "a retirada da " + convite.e + " é em lote, feita pela equipe. " + (String(convite.kt || "").trim() || "Aviso aqui o dia e o horário assim que a organização confirmar.")
        : (ev0.kit && ev0.kit.retirada ? ev0.kit.retirada : "aviso aqui o local e o horário de retirada assim que a organização confirmar.")) +
      (beneficios.indexOf("e") >= 0 && String(convite.pe || "").trim() ? "\n\nNo dia da prova, nosso ponto de encontro: " + String(convite.pe).trim() : "")],
  ];
  var listaM = el("div", "assess-msgs");
  mensagens.forEach(function (m) {
    var item = el("div", "assess-msg");
    item.append(el("h3", null, m[0]));
    var ta = el("textarea"); ta.value = m[1]; ta.rows = 5; ta.setAttribute("aria-label", m[0]);
    var ac = el("div", "assess-acoes");
    var bc = el("button", "btn btn--line", "Copiar"); bc.type = "button";
    bc.addEventListener("click", function () { copia(ta.value, bc, "Copiar"); });
    var bw = el("button", "btn btn--wa", "Abrir no WhatsApp"); bw.type = "button";
    bw.addEventListener("click", function () { window.open("https://wa.me/?text=" + encodeURIComponent(ta.value), "_blank", "noopener"); });
    ac.append(bw, bc);
    item.append(ta, ac);
    listaM.append(item);
  });
  p4.append(listaM, el("p", "muted assess-nota", "Você pode ajustar o texto antes de copiar ou enviar."));
  app.append(p4);

})();
