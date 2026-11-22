/*
 * "Monte sua corrida": a pessoa escolhe como quer a prova e vê, ao vivo,
 * tudo o que a Tardim Produções cuida. No fim, leva a configuração para o
 * pedido de orçamento.
 */
(function () {
  "use strict";
  var raiz = document.getElementById("monte-app");
  if (!raiz) return;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var GRUPOS = [
    { id: "quem", titulo: "Quem organiza", tipo: "um", opcoes: [
      ["empresa", "Empresa"], ["publico", "Órgão público ou conselho"], ["assoc", "Associação ou clube"]] },
    { id: "dist", titulo: "Distâncias", tipo: "varios", opcoes: [
      ["kids", "Kids"], ["3", "3 km caminhada"], ["5", "5 km"], ["10", "10 km"], ["21", "21 km"]] },
    { id: "local", titulo: "Onde", tipo: "um", opcoes: [
      ["rua", "Ruas e avenidas"], ["parque", "Parque ou lagoa"], ["privado", "Área particular"]] },
    { id: "kit", titulo: "Kit do atleta", tipo: "varios", opcoes: [
      ["numero", "Número de peito"], ["camiseta", "Camiseta"], ["medalha", "Medalha"]] },
    { id: "extra", titulo: "Extras", tipo: "varios", opcoes: [
      ["crono", "Cronometragem"], ["premio", "Premiação"], ["show", "Arena com shows"], ["fotos", "Fotos"], ["chancela", "Chancela da Federação"]] },
  ];
  var estado = { quem: "empresa", dist: { "5": true, "10": true }, local: "rua", kit: { numero: true, camiseta: true, medalha: true }, extra: { crono: true, premio: true }, publico: 1000 };

  // Controles
  var ctrl = el("div", "monte__ctrl");
  GRUPOS.forEach(function (g) {
    var f = el("fieldset", "monte__grupo");
    f.append(el("legend", null, g.titulo));
    var box = el("div", "monte__chips");
    g.opcoes.forEach(function (o) {
      var b = el("button", "dist-chip", o[1]);
      b.type = "button";
      b.setAttribute("data-g", g.id);
      b.setAttribute("data-v", o[0]);
      b.addEventListener("click", function () {
        if (g.tipo === "um") estado[g.id] = o[0];
        else {
          estado[g.id][o[0]] = !estado[g.id][o[0]];
          if (g.id === "dist" && !Object.keys(estado.dist).some(function (k) { return estado.dist[k]; })) estado.dist[o[0]] = true;
        }
        atualiza();
      });
      box.append(b);
    });
    f.append(box);
    ctrl.append(f);
    if (g.id === "dist") {
      var pf = el("div", "monte__grupo monte__publico");
      var lab = el("label", null);
      lab.setAttribute("for", "monte-publico");
      lab.append("Público esperado: ");
      var val = el("b", "monte__publico-v");
      lab.append(val);
      var r = el("input");
      r.type = "range"; r.id = "monte-publico"; r.min = 100; r.max = 8000; r.step = 100; r.value = estado.publico;
      r.addEventListener("input", function () { estado.publico = Number(r.value); atualiza(); });
      pf.append(lab, r);
      ctrl.append(pf);
    }
  });

  // Resumo ao vivo
  var res = el("div", "monte__res");
  var resTopo = el("div", "monte__res-top");
  var num = el("b", "monte__num");
  var numTxt = el("span", null, "itens no seu evento");
  resTopo.append(num, numTxt);
  var lista = el("ul", "monte__lista");
  var nota = el("p", "monte__nota", "A Tardim Produções cuida de todos, do planejamento à desmontagem.");
  var ir = el("a", "btn btn--red btn--lg monte__ir", "Pedir orçamento com essa corrida");
  ir.href = "#orcamento";
  res.append(resTopo, lista, nota, ir);
  raiz.append(ctrl, res);

  function pessoas(n) { return n >= 8000 ? "mais de 8 mil pessoas" : n.toLocaleString("pt-BR") + " pessoas"; }
  function nomes(grupo) {
    var g = GRUPOS.filter(function (x) { return x.id === grupo; })[0];
    return g.opcoes.filter(function (o) { return estado[grupo][o[0]]; }).map(function (o) { return o[1]; });
  }
  function rotulo(grupo, v) {
    return GRUPOS.filter(function (x) { return x.id === grupo; })[0].opcoes.filter(function (o) { return o[0] === v; })[0][1];
  }

  function itens() {
    var out = [];
    var dist = nomes("dist");
    out.push("Planejamento do evento e dos percursos: " + dist.join(", "));
    if (estado.local === "rua") out.push("Alvarás e autorizações da prefeitura e do trânsito");
    else if (estado.local === "parque") out.push("Alvarás e autorizações para o parque");
    else out.push("Alvarás e licenças do local");
    out.push("Prevenção contra incêndio e brigada no dia");
    if (estado.extra.chancela) out.push("Chancela da Federação Mineira de Atletismo");
    out.push("Plataforma de inscrição e atendimento aos atletas");
    var kit = nomes("kit");
    if (kit.length) out.push("Kit do atleta: " + kit.join(", ").toLowerCase() + ", com retirada organizada");
    out.push("Artes da prova e divulgação nas redes");
    out.push("Arena com largada e chegada para " + pessoas(estado.publico));
    out.push("Staff em todo o percurso e hidratação");
    if (estado.extra.crono) out.push("Cronometragem e resultados");
    if (estado.extra.premio) out.push("Premiação no pódio");
    if (estado.extra.show) out.push("Shows e programação na arena");
    if (estado.extra.fotos) out.push("Fotos da prova");
    out.push("Desmontagem de toda a estrutura");
    return out;
  }

  var anterior = 0;
  function atualiza() {
    ctrl.querySelectorAll("button[data-g]").forEach(function (b) {
      var g = b.getAttribute("data-g"), v = b.getAttribute("data-v");
      var on = typeof estado[g] === "string" ? estado[g] === v : !!estado[g][v];
      b.setAttribute("aria-pressed", String(on));
    });
    ctrl.querySelector(".monte__publico-v").textContent = pessoas(estado.publico);
    var its = itens();
    var antigos = {};
    lista.querySelectorAll("li").forEach(function (li) { antigos[li.textContent] = true; });
    lista.innerHTML = "";
    its.forEach(function (t) {
      var li = el("li", antigos[t] ? null : "is-novo", t);
      lista.append(li);
    });
    num.textContent = its.length;
    if (its.length !== anterior) { num.classList.remove("is-pulse"); void num.offsetWidth; num.classList.add("is-pulse"); }
    anterior = its.length;
  }

  // Leva a configuração para o pedido de orçamento
  ir.addEventListener("click", function () {
    var form = document.getElementById("orc-form");
    if (!form) return;
    var servico = form.querySelector('input[name="servico"][value="' + (estado.quem === "empresa" ? "corporativa" : "corrida") + '"]');
    if (servico) { servico.checked = true; servico.dispatchEvent(new Event("change", { bubbles: true })); }
    var quem = { empresa: "Empresa privada", publico: "Órgão público ou conselho", assoc: "Associação, clube ou instituição" }[estado.quem];
    form.elements.contratante.value = quem;
    var n = estado.publico;
    form.elements.publico.value = n <= 300 ? "Até 300 pessoas" : n <= 1000 ? "300 a 1.000 pessoas" : n <= 3000 ? "1.000 a 3.000 pessoas" : n <= 5000 ? "3.000 a 5.000 pessoas" : "Mais de 5.000 pessoas";
    var det = ["Montei no site:", "Distâncias: " + nomes("dist").join(", "), "Local: " + rotulo("local", estado.local), "Público esperado: " + pessoas(estado.publico)];
    var kit = nomes("kit"); if (kit.length) det.push("Kit: " + kit.join(", "));
    var ex = nomes("extra"); if (ex.length) det.push("Extras: " + ex.join(", "));
    form.elements.detalhes.value = det.join("\n");
    setTimeout(function () { form.elements.nome.focus({ preventScroll: true }); }, 700);
  });

  atualiza();
})();
