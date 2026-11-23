/*
 * Pedido de orçamento guiado.
 * Monta a mensagem no próprio aparelho e abre o WhatsApp (ou o e-mail) da
 * Tardim Produções. Ao enviar, uma cópia do pedido é guardada no banco do
 * site (functions/api/orcamento.js).
 */
(function () {
  "use strict";
  var form = document.getElementById("orc-form");
  if (!form) return;

  var WHATSAPP = (typeof SITE !== "undefined" && SITE.whatsapp) || "5531984289667";
  var EMAIL = (typeof SITE !== "undefined" && SITE.email) || "tardimproducoes.corridas@gmail.com";
  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
    "agosto", "setembro", "outubro", "novembro", "dezembro"];

  var SERVICOS = [
    ["corrida", "Corrida de rua"],
    ["corporativa", "Corrida corporativa ou de marca"],
    ["esportivo", "Outro evento esportivo"],
    ["feira", "Feira, congresso ou festa"],
    ["incendio", "Prevenção contra incêndio"],
    ["licencas", "Licenças e regularização"],
    ["outro", "Outro"],
  ];

  // Opções de serviço (botões de escolha única)
  var chips = document.getElementById("orc-servico");
  SERVICOS.forEach(function (s) {
    var l = document.createElement("label");
    l.className = "orc__chip";
    var i = document.createElement("input");
    i.type = "radio";
    i.name = "servico";
    i.value = s[0];
    var t = document.createElement("span");
    t.textContent = s[1];
    l.append(i, t);
    chips.append(l);
  });

  // Mês e ano previstos
  var hoje = new Date();
  var mes = form.elements.mes, ano = form.elements.ano;
  function opcao(sel, valor, texto) {
    var o = document.createElement("option");
    o.value = valor;
    o.textContent = texto;
    sel.append(o);
  }
  opcao(mes, "", "Mês");
  MESES.forEach(function (m, i) { opcao(mes, String(i), m.charAt(0).toUpperCase() + m.slice(1)); });
  opcao(ano, "", "Ano");
  for (var a = hoje.getFullYear(); a <= hoje.getFullYear() + 2; a++) opcao(ano, String(a), String(a));

  // Botões do site que já chegam com o serviço escolhido
  document.querySelectorAll("[data-orc]").forEach(function (b) {
    b.addEventListener("click", function () {
      var r = form.querySelector('input[name="servico"][value="' + b.getAttribute("data-orc") + '"]');
      if (r) r.checked = true;
      var c = b.getAttribute("data-contratante");
      if (c) form.elements.contratante.value = c;
      erroServico(false);
    });
  });

  function valor(nome) { return (form.elements[nome].value || "").trim(); }
  function servicoEscolhido() {
    var r = form.querySelector('input[name="servico"]:checked');
    if (!r) return "";
    for (var i = 0; i < SERVICOS.length; i++) if (SERVICOS[i][0] === r.value) return SERVICOS[i][1];
    return "";
  }
  function erroServico(mostra) {
    document.getElementById("orc-servico-erro").hidden = !mostra;
    chips.classList.toggle("is-erro", mostra);
  }
  function erroCampo(nome, mostra) {
    var campo = form.elements[nome];
    campo.setAttribute("aria-invalid", String(mostra));
    var msg = campo.parentNode.querySelector(".orc__erro");
    if (msg) msg.hidden = !mostra;
  }

  function valida() {
    var primeiro = null;
    var semServico = !servicoEscolhido();
    erroServico(semServico);
    if (semServico) primeiro = chips.querySelector("input");
    ["nome", "cidade"].forEach(function (n) {
      var vazio = !valor(n);
      erroCampo(n, vazio);
      if (vazio && !primeiro) primeiro = form.elements[n];
    });
    if (primeiro) { primeiro.focus(); return false; }
    return true;
  }

  function linhas(negrito) {
    var b = function (t) { return negrito ? "*" + t + ":*" : t + ":"; };
    var quando = "";
    if (valor("mes") !== "") quando = MESES[Number(valor("mes"))];
    if (valor("ano")) quando = quando ? quando + " de " + valor("ano") : valor("ano");
    var quem = [valor("contratante"), valor("empresa")].filter(Boolean).join(" · ");
    var out = ["Olá! Gostaria de um orçamento com a Tardim Produções.", ""];
    out.push(b("Serviço") + " " + servicoEscolhido());
    out.push(b("Nome") + " " + valor("nome"));
    if (quem) out.push(b("Contratante") + " " + quem);
    out.push(b("Cidade do evento") + " " + valor("cidade"));
    out.push(b("Data prevista") + " " + (quando || "ainda não definida"));
    if (valor("publico")) out.push(b("Público estimado") + " " + valor("publico"));
    if (valor("detalhes")) out.push("", b("Detalhes"), valor("detalhes"));
    return out.join("\n");
  }

  var ok = document.getElementById("orc-ok");
  function confirma(link, texto) {
    ok.innerHTML = "";
    ok.append(texto + " Se não abriu, ");
    var a = document.createElement("a");
    a.href = link;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "toque aqui";
    ok.append(a, ".");
    ok.hidden = false;
  }

  // Guarda o pedido no banco do site (Cloudflare D1). Nunca atrapalha o envio:
  // se a função não existir ou falhar, o WhatsApp e o e-mail seguem normalmente.
  var registrado = "";
  function registra(canal) {
    var quando = "";
    if (valor("mes") !== "") quando = MESES[Number(valor("mes"))];
    if (valor("ano")) quando = quando ? quando + " de " + valor("ano") : valor("ano");
    var dados = {
      servico: servicoEscolhido(), nome: valor("nome"), contratante: valor("contratante"), empresa: valor("empresa"),
      cidade: valor("cidade"), quando: quando, publico: valor("publico"), detalhes: valor("detalhes"),
    };
    var chave = JSON.stringify(dados);
    if (chave === registrado) return;
    registrado = chave;
    dados.canal = canal;
    try {
      fetch("/api/orcamento", { method: "POST", keepalive: true, headers: { "content-type": "application/json" }, body: JSON.stringify(dados) })
        .catch(function () {});
    } catch (e) {}
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!valida()) return;
    registra("whatsapp");
    var link = "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(linhas(true));
    window.open(link, "_blank", "noopener");
    confirma(link, "Abrimos o WhatsApp com a sua mensagem pronta. É só enviar.");
  });

  document.getElementById("orc-email").addEventListener("click", function () {
    if (!valida()) return;
    registra("email");
    var link = "mailto:" + EMAIL + "?subject=" + encodeURIComponent("Pedido de orçamento: " + servicoEscolhido()) +
      "&body=" + encodeURIComponent(linhas(false));
    window.location.href = link;
    confirma(link, "Abrimos o seu e-mail com a mensagem pronta. É só enviar.");
  });

  // Tira o aviso de erro assim que a pessoa corrige
  chips.addEventListener("change", function () { erroServico(false); });
  ["nome", "cidade"].forEach(function (n) {
    form.elements[n].addEventListener("input", function () { if (valor(n)) erroCampo(n, false); });
  });
})();
