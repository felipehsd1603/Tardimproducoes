/*
 * Inscrição direta no site (inscricao.html?prova=<id>&cupom=<CUPOM>): quem chega pelo link de embaixador ou
 * influenciador preenche os dados, paga por PIX ou cartão e a página confirma sozinha. Telas em js/inscricao-tela.js.
 * Endereço com #<id>.<codigo> (e sessionStorage): recarregar a página volta para o pagamento.
 * Cartão: o pagamento é na página do Mercado Pago, que devolve a pessoa para inscricao.html?retorno=cartao (sem prova
 * nem cupom); a inscrição sai do sessionStorage (INSCRICAO.leCartao), inclusive a feita pela área do parceiro.
 */
(function () {
  "use strict";
  var app = document.getElementById("inscricao");
  var I = window.INSCRICAO;
  if (!app || !I) return;
  var q = new URLSearchParams(location.search);
  function limpaCupom(c) { return String(c || "").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40); }
  var provaId = String(q.get("prova") || "").slice(0, 80);
  var cupom = limpaCupom(q.get("cupom"));
  // Volta do Mercado Pago: o status do endereço é só informativo (quem decide é a consulta da inscrição)
  var retorno = q.get("retorno") === "cartao";
  var statusMp = String(q.get("status") || q.get("collection_status") || "").replace(/[^a-z_]/g, "").slice(0, 30);
  var ctx = I.leCartao(); // { id, codigo, prova, cupom, origem: "link" | "parceiro", convite_id, dados }
  if (retorno) {
    if (ctx && ctx.prova) { provaId = String(ctx.prova).slice(0, 80); cupom = limpaCupom(ctx.cupom); }
    var marcaVolta = ctx && ctx.id && ctx.codigo ? "#" + ctx.id + "." + ctx.codigo : location.hash;
    // Tira payment_id e companhia do endereço (recarregar continua funcionando pelo #id.codigo)
    try {
      history.replaceState(null, "", location.pathname +
        (provaId ? "?prova=" + encodeURIComponent(provaId) + (cupom ? "&cupom=" + encodeURIComponent(cupom) : "") : "") + marcaVolta);
    } catch (e) {}
  }
  var titulo = document.getElementById("insc-titulo");
  var lead = document.getElementById("insc-lead");
  var CHAVE = "tdm-inscricao-" + provaId;
  var info = null, ultimos = null, idAtual = null;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function card() { var c = el("section", "assess-card"); app.innerHTML = ""; app.append(c); return c; }
  function paginaProva() { return "prova-" + encodeURIComponent(provaId) + ".html" + (cupom ? "?cupom=" + encodeURIComponent(cupom) : ""); }
  function linkProva(texto, cls) { var a = el("a", cls || "btn btn--line", texto || "Ver a página da prova"); a.href = paginaProva(); return a; }
  function link(texto, href, cls) { var a = el("a", cls || "btn btn--line", texto); a.href = href; return a; }
  function aviso(tit, msg) {
    var c = card();
    c.append(el("h2", null, tit), el("p", "assess-alerta", msg));
    if (ehParceiro()) c.append(link("Voltar para a área do parceiro", "parceiro.html", "btn btn--red"));
    else c.append(provaId ? linkProva() : link("Ir para o site", "index.html"));
  }
  function marca(insc) {
    var v = insc.id + "." + insc.codigo;
    I.guarda(CHAVE, v);
    try { history.replaceState(null, "", location.pathname + location.search + "#" + v); } catch (e) { location.hash = v; }
  }
  function esquece() {
    I.apaga(CHAVE);
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
  }
  function cabecalho(p) {
    if (!p) return;
    if (titulo && p.nome) titulo.textContent = p.nome;
    if (lead && p.data) lead.textContent = [I.quando(p.data) + (p.hora ? " · largada às " + p.hora : ""), p.local].filter(Boolean).join(" · ");
    document.title = "Inscrição · " + (p.nome || "Prova") + " · Tardim Produções";
  }
  // A inscrição na tela foi feita pela área do parceiro (voltou do cartão): refaz pela API do parceiro
  function ehParceiro() { return !!(ctx && ctx.origem === "parceiro" && idAtual && ctx.id === idAtual); }
  function dadosSalvos() { return ultimos || (ctx && ctx.id === idAtual && ctx.dados) || null; }
  function criar(dados) {
    if (ehParceiro()) return I.pegaJSON("api/parceiro/inscricao", { method: "POST", dados: Object.assign({ convite_id: ctx.convite_id }, dados) });
    return I.pegaJSON("api/inscricao-site/criar", { method: "POST", dados: Object.assign({ prova: provaId, cupom: cupom }, dados) });
  }
  // Nova inscrição (PIX no lugar do cartão, PIX novo): o contexto da volta do cartão passa a apontar para ela
  function segueContexto(insc, dados) {
    if (!ctx || ctx.id !== idAtual) return;
    ctx = Object.assign({}, ctx, { id: insc.id, codigo: insc.codigo, dados: dados });
    I.guardaCartao(ctx);
  }
  function vaiCartao(insc, dados) {
    marca(insc);
    var base = ehParceiro() ? ctx : { origem: "link", prova: provaId, cupom: cupom };
    ctx = Object.assign({}, base, { id: insc.id, codigo: insc.codigo, dados: dados || null });
    if (!I.vaiCartao(insc, ctx)) aviso("Pagamento no cartão", "Não consegui abrir a página de pagamento do cartão. Tente de novo ou pague por PIX.");
  }

  // ---------- formulário ----------
  function formulario(valores) {
    idAtual = null;
    var c = card();
    var p = info.prova;
    cabecalho(p);
    if (lead) lead.textContent = [p.data ? I.quando(p.data) + (p.hora ? " · largada às " + p.hora : "") : "", p.local].filter(Boolean).join(" · ") ||
      "Preencha os dados do atleta e pague por PIX.";
    c.append(el("p", "assess-card__step", "Dados do atleta"), el("h2", null, "Faça sua inscrição"));
    if (info.parceiro) {
      var cp = el("p", "insc-cupom");
      cp.append("Cupom ", el("b", null, info.cupom), " de " + info.parceiro + " aplicado.");
      c.append(cp);
    }
    c.append(I.formulario({
      info: info, valores: valores || ultimos,
      enviar: function (dados) {
        ultimos = dados;
        return I.pegaJSON("api/inscricao-site/criar", { method: "POST", dados: Object.assign({ prova: provaId, cupom: cupom }, dados) });
      },
      aoCriar: function (insc, dados) {
        if (insc.forma === "cartao" && insc.cartao) return vaiCartao(insc, dados);
        mostra(insc);
      },
    }));
  }

  // ---------- pagamento e confirmação ----------
  function depois() {
    var d = el("div", "assess-acoes insc-depois");
    if (ehParceiro()) d.append(link("Voltar para a área do parceiro", "parceiro.html", "btn btn--red"));
    d.append(linkProva("Voltar para a prova", "btn btn--line"));
    return d;
  }
  function mostra(insc, voltou) {
    cabecalho(insc.prova);
    idAtual = insc.id;
    if (insc.situacao === "aguardando") marca(insc);
    var c = card();
    I.pix(c, insc, {
      aoMudar: function (n) {
        if (n.situacao === "expirado") esquece();
        // Confirmada: os dados do atleta não precisam mais ficar guardados no navegador
        else if (n.situacao !== "aguardando" && ctx && ctx.id === n.id && ctx.dados) { ctx = Object.assign({}, ctx, { dados: null }); I.guardaCartao(ctx); }
      },
      depois: depois,
      novo: novoPix,
      retorno: !!voltou, statusRetorno: statusMp,
      irCartao: function (n) { vaiCartao(n, dadosSalvos()); },
      pix: novoPix,
    });
    window.scrollTo(0, 0);
  }
  // "Gerar novo PIX" / "Pagar por PIX": manda os mesmos dados de novo, por PIX; sem eles (página recarregada), volta ao formulário
  function novoPix(botao) {
    var dados = dadosSalvos();
    if (!dados) {
      if (ehParceiro()) return aviso("Pagar por PIX", "Para pagar por PIX, faça a inscrição de novo pela área do parceiro.");
      return carrega().then(function () { if (info) formulario(); });
    }
    dados = Object.assign({}, dados, { forma: "pix" });
    criar(dados)
      .then(function (n) { segueContexto(n, dados); ultimos = ultimos ? dados : null; mostra(n); })
      .catch(function (e) {
        botao.disabled = false; botao.textContent = botao.getAttribute("data-rotulo") || "Gerar novo PIX";
        var p = el("p", "assess-alerta", e.message);
        p.setAttribute("role", "alert");
        botao.after(p);
      });
  }

  function carrega() {
    return I.pegaJSON("api/inscricao-site/prova/" + encodeURIComponent(provaId) + "?cupom=" + encodeURIComponent(cupom))
      .then(function (r) { info = r; return r; })
      .catch(function (e) {
        info = null;
        aviso(e.status === 410 ? "Inscrições encerradas" : "Inscrição indisponível", e.message);
      });
  }

  // ---------- início ----------
  function inicio() {
    var salvo = /^#([0-9a-f-]{36})\.([0-9a-f]{32})$/.exec(location.hash) || (provaId ? /^([0-9a-f-]{36})\.([0-9a-f]{32})$/.exec(I.le(CHAVE)) : null);
    if (!salvo && retorno) {
      return aviso("Pagamento no cartão", "Não encontrei a sua inscrição neste navegador. Se o pagamento foi aprovado, a confirmação chega no seu e-mail. Em caso de dúvida, fale com a Tardim pelo WhatsApp.");
    }
    if (!salvo && (!provaId || !cupom)) {
      return aviso("Link incompleto", "Este link de inscrição está incompleto. Abra de novo o link que o parceiro mandou.");
    }
    if (salvo) {
      card().append(el("p", "muted", retorno ? "Conferindo o pagamento no cartão..." : "Carregando a sua inscrição..."));
      idAtual = salvo[1];
      return I.consultaPublica({ id: salvo[1], codigo: salvo[2] }).then(function (insc) {
        insc.codigo = salvo[2];
        if (!provaId && insc.prova && insc.prova.id) { provaId = insc.prova.id; CHAVE = "tdm-inscricao-" + provaId; }
        if (insc.prova && insc.prova.id && insc.prova.id !== provaId) throw new Error("outra prova");
        if (insc.situacao === "expirado") {
          esquece();
          cabecalho(insc.prova);
          // Com os dados guardados (volta do cartão), "Gerar novo PIX" refaz direto; sem eles, volta ao formulário
          if (dadosSalvos() || ehParceiro()) return I.expirado(card(), insc, { novo: novoPix });
          return carrega().then(function () { if (info) I.expirado(card(), insc, { novo: function () { formulario(); } }); });
        }
        mostra(insc, retorno);
      }).catch(function (e) {
        if (retorno && e && e.status === 0) return aviso("Sem conexão", e.message + " Depois, recarregue esta página.");
        esquece();
        idAtual = null;
        if (!provaId || !cupom) return aviso("Inscrição não encontrada", "Não encontrei a sua inscrição. Se o pagamento foi aprovado, a confirmação chega no seu e-mail.");
        return carrega().then(function () { if (info) formulario(); });
      });
    }
    carrega().then(function () { if (info) formulario(); });
  }
  inicio();
})();
