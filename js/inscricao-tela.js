/*
 * Telas da inscrição pelo site (formulário do atleta, PIX com QR Code e inscrição confirmada).
 * Usado por inscricao.html (js/inscricao.js) e pela área do parceiro (js/parceiro.js).
 * API: functions/api/inscricao-site. O QR Code sai de js/vendor/qrcode-1.4.4.js (global qrcode).
 */
(function () {
  "use strict";
  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
    "agosto", "setembro", "outubro", "novembro", "dezembro"];
  var SITUACAO = { aguardando: "Aguardando pagamento", pago: "Confirmada (paga)", cortesia: "Confirmada (cortesia)", expirado: "PIX expirado" };
  var CHAVE_CARTAO = "tdm-insc-cartao";

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function reais(c) { return (Number(c || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
  function quando(iso) {
    if (!iso) return "";
    var p = String(iso).split("-").map(Number);
    return p[2] + " de " + MESES[p[1] - 1] + " de " + p[0];
  }
  function cpfOk(d) {
    d = String(d || "").replace(/\D/g, "");
    if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
    for (var t = 9; t < 11; t++) {
      var s = 0;
      for (var i = 0; i < t; i++) s += Number(d[i]) * (t + 1 - i);
      if ((s * 10) % 11 % 10 !== Number(d[t])) return false;
    }
    return true;
  }
  // sessionStorage pode não existir (aba privada, bloqueio): nunca quebra a tela
  function guarda(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  function le(k) { try { return sessionStorage.getItem(k) || ""; } catch (e) { return ""; } }
  function apaga(k) { try { sessionStorage.removeItem(k); } catch (e) {} }
  // Cartão: antes de ir ao Mercado Pago guarda { id, codigo, prova, cupom, origem, convite_id, dados } para a volta
  // (inscricao.html?retorno=cartao), que pode ser de uma inscrição do site ou da área do parceiro
  function guardaCartao(ctx) { try { guarda(CHAVE_CARTAO, JSON.stringify(ctx)); } catch (e) {} }
  function leCartao() {
    try { var o = JSON.parse(le(CHAVE_CARTAO) || "null"); return o && typeof o === "object" ? o : null; } catch (e) { return null; }
  }
  function apagaCartao() { apaga(CHAVE_CARTAO); }
  function vaiCartao(insc, ctx) {
    var url = insc && insc.cartao && insc.cartao.url;
    if (!url || !/^https?:\/\//i.test(url)) return false;
    guardaCartao(Object.assign({}, ctx || {}, { id: insc.id, codigo: insc.codigo }));
    location.href = url;
    return true;
  }

  /** fetch JSON; erro com a mensagem da API e o status. */
  function pegaJSON(url, op) {
    op = op || {};
    var o = { method: op.method || "GET", credentials: "same-origin", headers: {} };
    if (op.dados !== undefined) { o.body = JSON.stringify(op.dados); o.headers["content-type"] = "application/json"; }
    return fetch(url, o).then(function (r) {
      return r.text().then(function (t) {
        var j = null;
        try { j = t ? JSON.parse(t) : {}; } catch (e) { j = null; }
        if (!r.ok || j === null) {
          var err = new Error((j && j.mensagem) || (j === null ? "A inscrição pelo site funciona só no site publicado." : "Erro " + r.status + "."));
          err.status = r.status;
          throw err;
        }
        return j;
      });
    }, function () {
      var err = new Error("Sem conexão. Confira a internet e tente de novo.");
      err.status = 0;
      throw err;
    });
  }
  function consultaPublica(insc) {
    return pegaJSON("api/inscricao-site/" + encodeURIComponent(insc.id) + "?c=" + encodeURIComponent(insc.codigo));
  }

  // ---------- campos ----------
  function campo(rotulo, input, dica, cheio) {
    var l = el("label", "orc__field" + (cheio ? " assess-grid__full" : ""));
    l.append(el("span", null, rotulo), input);
    if (dica) l.append(el("small", "assess-dica", dica));
    return l;
  }
  function entrada(tipo, extra) {
    var i = el("input");
    i.type = tipo;
    if (extra) Object.keys(extra).forEach(function (k) { i[k] = extra[k]; });
    return i;
  }
  function lista(opcoes, vazio) {
    var s = el("select");
    if (vazio) { var o0 = el("option", null, vazio); o0.value = ""; s.append(o0); }
    opcoes.forEach(function (x) {
      var o = el("option", null, Array.isArray(x) ? x[1] : x);
      o.value = Array.isArray(x) ? x[0] : x;
      s.append(o);
    });
    return s;
  }
  function mascaraCpf(i) {
    i.addEventListener("input", function () {
      var d = i.value.replace(/\D/g, "").slice(0, 11);
      i.value = d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1-$2");
    });
  }
  // (31) 99999-9999 para celular, (31) 3333-4444 para fixo; tira o +55 de quem cola com DDI
  function mascaraTel(i) {
    i.addEventListener("input", function () {
      var d = i.value.replace(/\D/g, "");
      if (d.length > 11 && d.indexOf("55") === 0) d = d.slice(2);
      d = d.slice(0, 11);
      i.value = d.length > 10 ? d.replace(/^(\d{2})(\d{5})(\d{0,4})$/, "($1) $2-$3")
        : d.length > 6 ? d.replace(/^(\d{2})(\d{4})(\d{0,4})$/, "($1) $2-$3")
        : d.length > 2 ? d.replace(/^(\d{2})(\d+)$/, "($1) $2")
        : d.length ? "(" + d : "";
    });
  }

  /** Quadro de valores: valor cheio riscado, desconto e total. */
  function precos(lote, parceiro, cortesia, cartao) {
    var q = el("div", "insc-preco");
    q.setAttribute("aria-label", "Valor da inscrição");
    var ul = el("ul");
    function linha(rotulo, valor, cls) {
      var li = el("li", cls);
      li.append(el("span", null, rotulo), valor);
      ul.append(li);
    }
    var desconto = cortesia ? lote.valor_cheio : lote.desconto;
    var total = cortesia ? 0 : (cartao ? cartao.valor : lote.valor);
    var taxa = cartao ? cartao.valor - lote.valor : 0;
    if (desconto || taxa) {
      linha("Inscrição" + (lote.nome ? " · " + lote.nome : ""), el("s", null, reais(lote.valor_cheio)));
      if (desconto) linha(cortesia ? "Cortesia do seu convite" : "Desconto do cupom" + (parceiro ? " de " + parceiro : ""), el("span", "insc-preco__desc", "− " + reais(desconto)));
      if (taxa) linha("Taxa do cartão (" + String(cartao.acrescimo_pct).replace(".", ",") + "%)", el("span", null, "+ " + reais(taxa)));
    }
    linha(desconto || taxa ? "Total" + (cartao ? " no cartão" : "") : "Inscrição" + (lote.nome ? " · " + lote.nome : ""), el("b", null, total ? reais(total) : "Sem pagamento"), "insc-preco__total");
    q.append(ul);
    if (!cortesia && desconto) q.append(el("p", "insc-preco__nota", "O desconto já está aplicado. Não precisa digitar o cupom."));    return q;
  }

  /** "Como você quer pagar?": PIX ou cartão de crédito, com o valor de cada um. */
  function escolheForma(info, atual, aoTrocar) {
    var fs = el("fieldset", "insc-forma assess-grid__full");
    fs.append(el("legend", null, "Como você quer pagar?"));
    var k = info.cartao;
    var nome = "insc-forma-" + Math.random().toString(36).slice(2, 8);
    function opcao(valor, titulo, preco, notas) {
      var l = el("label", "insc-forma__op");
      var r = el("input");
      r.type = "radio"; r.name = nome; r.value = valor; r.checked = atual === valor;
      r.addEventListener("change", function () { if (r.checked) aoTrocar(valor); });
      var t = el("span", "insc-forma__txt");
      var cab = el("span", "insc-forma__cab");
      cab.append(el("b", null, titulo), el("span", "insc-forma__preco", reais(preco)));
      t.append(cab);
      notas.forEach(function (n) { if (n) t.append(el("small", null, n)); });
      l.append(r, t);
      return l;
    }
    fs.append(
      opcao("pix", "PIX", info.lote.valor, ["Confirmação na hora, sem taxa."]),
      opcao("cartao", "Cartão de crédito", k.valor, [
        k.parcelas > 1 ? "Até " + k.parcelas + "x no cartão, com juros da operadora." : "À vista no cartão.",
        k.valor > info.lote.valor ? "O valor no cartão inclui a taxa do cartão (" + String(k.acrescimo_pct).replace(".", ",") + "%)." : "",
        "Você paga na página segura do Mercado Pago.",
      ])
    );
    return fs;
  }

  /**
   * Formulário do atleta. opts: { info (GET prova), cortesia, titulo, enviar(dados) -> Promise<inscrição>, aoCriar(inscrição), valores }
   * Devolve o elemento (um <form>).
   */
  function formulario(opts) {
    var info = opts.info, v = opts.valores || {};
    var f = el("form", "assess-grid insc-form");
    f.noValidate = true;
    var nome = entrada("text", { maxLength: 120, autocomplete: "name", required: true, value: v.nome || "" });
    var cpf = entrada("text", { maxLength: 14, inputMode: "numeric", autocomplete: "off", placeholder: "000.000.000-00", required: true, value: v.cpf || "" });
    mascaraCpf(cpf);
    var email = entrada("email", { maxLength: 120, autocomplete: "email", required: true, value: v.email || "" });
    var tel = entrada("tel", { maxLength: 16, inputMode: "numeric", autocomplete: "tel", placeholder: "(31) 90000-0000", required: true, value: v.telefone || "" });
    mascaraTel(tel);
    var nasc = entrada("date", { required: true, max: new Date().toISOString().slice(0, 10), min: "1900-01-01", value: v.nascimento || "" });
    var sexo = lista([["F", "Feminino"], ["M", "Masculino"], ["O", "Outro / prefiro não informar"]], "Escolha");
    sexo.value = v.sexo || "";
    var mods = info.modalidades || [];
    var modalidade = lista(mods, mods.length > 1 ? "Escolha a modalidade" : null);
    modalidade.value = v.modalidade || (mods.length === 1 ? mods[0] : "");
    var cams = info.camisetas || [];
    var camiseta = cams.length ? lista(cams, "Escolha o tamanho") : null;
    if (camiseta) camiseta.value = v.camiseta || "";

    var aceite = entrada("checkbox", { checked: !!v.aceite });
    var lAceite = el("label", "assess-toggle assess-grid__full");
    var tAceite = el("span");
    if (info.prova && info.prova.regulamento) {
      var aReg = el("a", null, "regulamento da prova");
      aReg.href = info.prova.regulamento; aReg.target = "_blank"; aReg.rel = "noopener";
      tAceite.append("Li e aceito o ", aReg, ".");
    } else tAceite.append("Li e aceito o regulamento da prova.");
    lAceite.append(aceite, tAceite);

    var erro = el("p", "orc__erro assess-grid__full");
    erro.hidden = true; erro.setAttribute("role", "alert");
    var pagavel = !opts.cortesia && !!(info.lote && info.lote.valor);
    // Cartão (Mercado Pago) só quando a prova aceita e há o que pagar; cortesia e desconto de 100% ignoram a escolha
    var comCartao = pagavel && !!(info.cartao && info.cartao.valor);
    var forma = comCartao && v.forma === "cartao" ? "cartao" : "pix";
    var escolhaForma = comCartao ? escolheForma(info, forma, function (f) { forma = f; trocaPreco(); }) : null;
    function rotuloIr() { return !pagavel ? "Confirmar inscrição" : forma === "cartao" ? "Continuar para o cartão" : "Continuar para o PIX"; }
    var ir = el("button", "btn btn--red btn--lg assess-grid__full", rotuloIr());
    ir.type = "submit";
    // Voltou do Mercado Pago pelo "voltar" do navegador (página restaurada do cache): libera o botão
    window.addEventListener("pageshow", function (e) { if (e.persisted && ir.disabled) { ir.disabled = false; ir.textContent = rotuloIr(); } });

    f.append(
      campo("Nome completo", nome, null, true),
      campo("CPF", cpf),
      campo("Data de nascimento", nasc),
      campo("E-mail", email, "A confirmação chega neste e-mail."),
      campo("Telefone (WhatsApp)", tel),
      campo("Sexo", sexo),
      campo("Modalidade", modalidade, null, !camiseta)
    );
    if (camiseta) f.append(campo("Camiseta", camiseta));
    var pq = precos(info.lote, info.parceiro, opts.cortesia, forma === "cartao" ? info.cartao : null);
    pq.classList.add("assess-grid__full");
    function trocaPreco() {
      var n = precos(info.lote, info.parceiro, opts.cortesia, forma === "cartao" ? info.cartao : null);
      n.classList.add("assess-grid__full");
      pq.replaceWith(n); pq = n;
      if (!ir.disabled) ir.textContent = rotuloIr();
    }
    if (escolhaForma) f.append(escolhaForma);
    f.append(pq, lAceite, erro, ir);

    function falha(msg, campoEl) {
      erro.textContent = msg; erro.hidden = !msg;
      [nome, cpf, email, tel, nasc, sexo, modalidade, camiseta].forEach(function (x) { if (x) x.removeAttribute("aria-invalid"); });
      if (campoEl) { campoEl.setAttribute("aria-invalid", "true"); campoEl.focus(); }
    }
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var n = nome.value.trim().replace(/\s+/g, " ");
      var hoje = new Date().toISOString().slice(0, 10);
      if (n.split(" ").length < 2 || n.length < 5) return falha("Informe o nome completo.", nome);
      if (!cpfOk(cpf.value)) return falha("CPF inválido. Confira os números.", cpf);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(nasc.value) || nasc.value < "1900-01-01" || nasc.value > hoje) return falha("Informe a data de nascimento.", nasc);
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.value.trim())) return falha("Informe um e-mail válido.", email);
      if (tel.value.replace(/\D/g, "").length < 10) return falha("Informe um telefone com DDD.", tel);
      if (!sexo.value) return falha("Informe o sexo.", sexo);
      if (!modalidade.value) return falha("Escolha a modalidade.", modalidade);
      if (camiseta && !camiseta.value) return falha("Escolha o tamanho da camiseta.", camiseta);
      if (!aceite.checked) return falha("Para continuar, aceite o regulamento da prova.", aceite);
      falha("");
      var dados = {
        nome: n, cpf: cpf.value.replace(/\D/g, ""), email: email.value.trim(), telefone: tel.value.replace(/\D/g, ""),
        nascimento: nasc.value, sexo: sexo.value, modalidade: modalidade.value, camiseta: camiseta ? camiseta.value : "", aceite: true,
        forma: forma,
      };
      ir.disabled = true; ir.textContent = "Enviando...";
      opts.enviar(dados).then(function (insc) {
        if (insc && insc.cartao) ir.textContent = "Abrindo o pagamento no cartão...";
        opts.aoCriar(insc, dados);
      }).catch(function (err) {
        ir.disabled = false; ir.textContent = rotuloIr();
        falha(err.message || "Não deu certo. Tente de novo.");
      });
    });
    return f;
  }

  // ---------- PIX ----------
  function qrDataURL(texto) {
    if (typeof qrcode !== "function") return "";
    if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs["UTF-8"]) qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
    var q = qrcode(0, "M");
    q.addData(texto);
    q.make();
    var cel = Math.max(3, Math.floor(280 / (q.getModuleCount() + 8)));
    return q.createDataURL(cel, cel * 4);
  }
  function resumo(insc) {
    var dl = el("dl", "assess-cond insc-resumo");
    function item(t, v) { if (!v) return; dl.append(el("dt", null, t), el("dd", null, v)); }
    var p = insc.prova || {};
    item("Prova", (p.nome || p.id || "") + (p.data ? " · " + quando(p.data) : "") + (p.local ? " · " + p.local : ""));
    item("Atleta", insc.nome);
    item("Modalidade", insc.modalidade);
    item("Camiseta", insc.camiseta);
    var extra = [insc.desconto ? "desconto de " + reais(insc.desconto) : "", insc.acrescimo ? "taxa do cartão de " + reais(insc.acrescimo) : ""].filter(Boolean);
    item("Valor", insc.valor ? reais(insc.valor) + (insc.forma === "cartao" ? " no cartão" : " no PIX") + (extra.length ? " (" + extra.join(", ") + ")" : "") : "Cortesia");
    return dl;
  }

  /**
   * Tela do PIX em "alvo" (limpa o conteúdo). opts: { consulta(insc) -> Promise<inscrição atualizada>, aoMudar(insc) (pago, cortesia ou expirado), novo() (gerar novo PIX) }
   * Confere a cada 5 s enquanto a tela estiver na página.
   */
  function pix(alvo, insc, opts) {
    opts = opts || {};
    var consulta = opts.consulta || consultaPublica;
    if (insc.situacao === "aguardando" && insc.cartao) return cartao(alvo, insc, opts);
    alvo.innerHTML = "";
    if (insc.situacao !== "aguardando" || !insc.pix) return fim(insc);

    alvo.append(el("p", "assess-card__step", "Pagamento"), el("h2", null, "Pague com PIX"));
    var valor = el("p", "insc-pix__valor");
    valor.append("Valor: ", el("b", null, reais(insc.valor)));
    alvo.append(valor);
    var caixa = el("div", "insc-pix");
    var src = qrDataURL(insc.pix.copia_cola);
    if (src) {
      var img = el("img", "insc-pix__qr");
      img.src = src; img.alt = "QR Code do PIX de " + reais(insc.valor); img.width = 240; img.height = 240;
      caixa.append(img);
    }
    var lado = el("div", "insc-pix__lado");
    lado.append(el("p", "insc-pix__passo", "Abra o app do seu banco, escolha PIX e leia o QR Code, ou copie o código abaixo e use \"PIX copia e cola\"."));
    var ta = el("textarea", "insc-pix__codigo");
    ta.readOnly = true; ta.rows = 4; ta.value = insc.pix.copia_cola;
    ta.setAttribute("aria-label", "Código PIX copia e cola");
    ta.addEventListener("focus", function () { ta.select(); });
    var copiar = el("button", "btn btn--red", "Copiar código");
    copiar.type = "button";
    copiar.addEventListener("click", function () {
      var ok = function () { copiar.textContent = "Código copiado!"; setTimeout(function () { copiar.textContent = "Copiar código"; }, 2000); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(insc.pix.copia_cola).then(ok, function () { ta.focus(); ta.select(); });
      else { ta.focus(); ta.select(); try { document.execCommand("copy"); ok(); } catch (e) {} }
    });
    var prazo = el("p", "insc-pix__prazo");
    lado.append(ta, copiar, prazo);
    caixa.append(lado);
    var status = el("p", "insc-pix__status", "Aguardando o pagamento...");
    status.setAttribute("role", "status");
    alvo.append(caixa, status, resumo(insc));
    alvo.append(el("p", "muted insc-pix__nota", "Pode deixar esta página aberta: assim que o banco confirmar, ela muda sozinha e a confirmação chega no seu e-mail."));

    var expira = Date.parse(insc.pix.expira_em);
    var vivo = true, conferindo = false, ultimo = 0;
    function presente() { return vivo && document.body.contains(alvo) && alvo.contains(caixa); }
    function tique() {
      if (!presente()) { vivo = false; return; }
      var falta = Math.max(0, Math.floor((expira - Date.now()) / 1000));
      var h = new Date(expira);
      prazo.textContent = falta > 0
        ? "O código vale até " + String(h.getHours()).padStart(2, "0") + ":" + String(h.getMinutes()).padStart(2, "0") +
          " (faltam " + Math.floor(falta / 60) + ":" + String(falta % 60).padStart(2, "0") + ")."
        : "O prazo deste código terminou.";
      if (Date.now() - ultimo >= 5000 || (falta === 0 && Date.now() - ultimo >= 2000)) confere();
      setTimeout(tique, 1000);
    }
    function confere() {
      if (conferindo) return;
      conferindo = true; ultimo = Date.now();
      consulta(insc).then(function (n) {
        conferindo = false;
        if (!presente() || !n) return;
        if (n.situacao !== "aguardando") { vivo = false; n.codigo = insc.codigo; fim(n); }
        else status.textContent = "Aguardando o pagamento...";
      }, function (e) {
        conferindo = false;
        if (presente()) status.textContent = "Aguardando o pagamento... (" + (e.status ? e.message : "sem conexão, tentando de novo") + ")";
      });
    }
    ultimo = Date.now();
    tique();

    function fim(n) {
      if (opts.aoMudar) opts.aoMudar(n);
      if (n.situacao === "expirado") return expirado(alvo, n, opts);
      confirmada(alvo, n, opts);
    }
  }

  /**
   * Pagamento no cartão (Mercado Pago) ainda em aberto. opts como no pix() e mais: retorno (acabou de voltar do Mercado Pago),
   * statusRetorno (status do endereço, só informativo), irCartao(insc) (abre o checkout de novo), pix(botao) (troca para PIX).
   * Confere a cada 4 s por até 2 minutos; quem decide é a consulta (GET), nunca o status do endereço.
   */
  function cartao(alvo, insc, opts) {
    opts = opts || {};
    var consulta = opts.consulta || consultaPublica;
    var esperaAprovar = opts.retorno && /^(approved|pending|in_process|authorized)$/.test(opts.statusRetorno || "");
    var vivo = true, inicio = 0, volta = 0;
    alvo.innerHTML = "";
    alvo.append(el("p", "assess-card__step", "Pagamento"), el("h2", null, "Pagamento no cartão"));
    var valor = el("p", "insc-pix__valor");
    valor.append("Valor no cartão: ", el("b", null, reais(insc.valor)));
    var status = el("p", "insc-pix__status", "Conferindo o pagamento no cartão...");
    status.setAttribute("role", "status");
    var falta = el("div", "insc-cartao");
    falta.hidden = !!opts.retorno;
    falta.append(el("p", "insc-cartao__tit", opts.retorno ? "O pagamento ainda não foi aprovado" : "Falta concluir o pagamento no cartão"));
    var h = new Date(Date.parse(insc.cartao.expira_em));
    falta.append(el("p", null, (opts.retorno ? "Se o cartão foi recusado, tente de novo (com o mesmo ou outro cartão) ou pague por PIX." :
      "Abra a página do Mercado Pago para pagar, ou pague por PIX.") +
      (isNaN(h.getTime()) ? "" : " A vaga fica reservada até " + String(h.getHours()).padStart(2, "0") + ":" + String(h.getMinutes()).padStart(2, "0") + ".")));
    var bts = el("div", "assess-acoes");
    var deNovo = el("button", "btn btn--red", opts.retorno ? "Tentar de novo no cartão" : "Ir para o pagamento no cartão");
    deNovo.type = "button";
    deNovo.addEventListener("click", function () {
      vivo = false;
      deNovo.disabled = true; deNovo.textContent = "Abrindo o Mercado Pago...";
      if (opts.irCartao) opts.irCartao(insc); else location.href = insc.cartao.url;
    });
    bts.append(deNovo);
    if (opts.pix) {
      var porPix = el("button", "btn btn--line", "Pagar por PIX");
      porPix.type = "button"; porPix.setAttribute("data-rotulo", "Pagar por PIX");
      porPix.addEventListener("click", function () { vivo = false; porPix.disabled = true; porPix.textContent = "Gerando o PIX..."; opts.pix(porPix); });
      bts.append(porPix);
    }
    var outra = el("button", "orc__email", "Conferir de novo");
    outra.type = "button"; outra.hidden = true;
    outra.addEventListener("click", function () { outra.hidden = true; comeca(); });
    falta.append(bts);
    alvo.append(valor, status, falta, outra, resumo(insc));
    alvo.append(el("p", "muted insc-pix__nota", "O cartão é digitado só na página do Mercado Pago. Assim que o pagamento for aprovado, esta página muda sozinha e a confirmação chega no seu e-mail."));
    // Voltou do Mercado Pago pelo "voltar" do navegador: libera os botões e volta a conferir
    window.addEventListener("pageshow", function (e) {
      if (!e.persisted || !document.body.contains(falta)) return;
      deNovo.disabled = false; deNovo.textContent = opts.retorno ? "Tentar de novo no cartão" : "Ir para o pagamento no cartão";
      comeca();
    });

    function presente() { return vivo && document.body.contains(alvo) && alvo.contains(falta); }
    function comeca() { vivo = true; inicio = Date.now(); status.textContent = "Conferindo o pagamento no cartão..."; confere(++volta); }
    function confere(v) {
      if (!presente() || v !== volta) return;
      consulta(insc).then(function (n) {
        if (!presente() || !n || v !== volta) return;
        if (n.situacao !== "aguardando") { vivo = false; n.codigo = insc.codigo; return fim(n); }
        if (n.cartao && n.cartao.url) insc.cartao = n.cartao;
        segue(v);
      }, function (e) {
        if (!presente() || v !== volta) return;
        status.textContent = "Conferindo o pagamento no cartão... (" + (e.status ? e.message : "sem conexão, tentando de novo") + ")";
        segue(v);
      });
    }
    function segue(v) {
      var passou = Date.now() - inicio;
      // Voltou recusado (ou sem status): mostra as opções já; aprovado: espera a confirmação antes de oferecer outra tentativa
      if (!esperaAprovar || passou >= 20000) falta.hidden = false;
      if (passou >= 120000) {
        vivo = false;
        falta.hidden = false; outra.hidden = false;
        status.textContent = "O Mercado Pago ainda não confirmou o pagamento.";
        return;
      }
      setTimeout(function () { confere(v); }, 4000);
    }
    function fim(n) {
      if (opts.aoMudar) opts.aoMudar(n);
      if (n.situacao === "expirado") return expirado(alvo, n, opts);
      confirmada(alvo, n, opts);
    }
    comeca();
  }

  function expirado(alvo, insc, opts) {
    alvo.innerHTML = "";
    var noCartao = insc.forma === "cartao";
    alvo.append(el("p", "assess-card__step", "Pagamento"), el("h2", null, noCartao ? "O prazo do pagamento terminou" : "O PIX expirou"));
    alvo.append(el("p", null, (noCartao ? "O prazo para pagar no cartão terminou e a vaga foi liberada." : "O prazo para pagar este código terminou e a vaga foi liberada.") +
      " Gere um PIX novo para continuar."));
    alvo.append(resumo(insc));
    if (opts && opts.novo) {
      var b = el("button", "btn btn--red btn--lg", "Gerar novo PIX");
      b.type = "button"; b.setAttribute("data-rotulo", "Gerar novo PIX");
      b.addEventListener("click", function () { b.disabled = true; b.textContent = "Gerando..."; opts.novo(b); });
      alvo.append(b);
    }
  }

  /** Inscrição confirmada (paga ou cortesia). opts.depois: elementos extras no fim. */
  function confirmada(alvo, insc, opts) {
    alvo.innerHTML = "";
    var ok = el("div", "insc-ok");
    ok.append(el("p", "assess-card__step", insc.situacao === "cortesia" ? "Cortesia" : "Pagamento recebido"), el("h2", null, "Inscrição confirmada"));
    ok.append(el("p", "insc-ok__msg", "Pronto" + (insc.nome ? ", " + insc.nome : "") + "! A inscrição está confirmada. Enviamos os detalhes para o seu e-mail; confira também a caixa de spam."));
    alvo.append(ok, resumo(insc));
    var depois = opts && opts.depois;
    if (typeof depois === "function") depois = depois(insc);
    if (depois) alvo.append(depois);
    if (alvo.scrollIntoView) alvo.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  window.INSCRICAO = {
    formulario: formulario, pix: pix, confirmada: confirmada, expirado: expirado, resumo: resumo,
    reais: reais, quando: quando, situacao: SITUACAO, pegaJSON: pegaJSON, consultaPublica: consultaPublica,
    guarda: guarda, le: le, apaga: apaga, cartao: cartao, vaiCartao: vaiCartao, leCartao: leCartao, guardaCartao: guardaCartao, apagaCartao: apagaCartao,
  };
})();
