/*
 * Área do parceiro (parceiro.html): cadastro e login de assessorias,
 * influenciadores e embaixadores (e-mail e senha ou Google). O cadastro fica
 * pendente até a Tardim Produções aprovar no painel; aprovado, o parceiro vê
 * os convites dele com cupom, links e kit. API: functions/api/parceiro.
 */
(function () {
  "use strict";
  var app = document.getElementById("parceiro");
  if (!app) return;

  var SITE_ = typeof SITE !== "undefined" ? SITE : {};
  var WHATSAPP = SITE_.whatsapp || "5531984289667";
  var PROVAS = typeof PROXIMAS !== "undefined" ? PROXIMAS : [];
  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
    "agosto", "setembro", "outubro", "novembro", "dezembro"];
  var TIPOS = [
    ["assessoria", "Assessoria de corrida", "Inscrição coletiva da equipe, cupom e kit de divulgação."],
    ["influenciador", "Influenciador", "Cupom e link próprios para divulgar as provas."],
    ["embaixador", "Embaixador", "Profissionais e corredores que representam as provas."],
  ];
  var UFS = [["AC", "Acre"], ["AL", "Alagoas"], ["AP", "Amapá"], ["AM", "Amazonas"], ["BA", "Bahia"], ["CE", "Ceará"],
    ["DF", "Distrito Federal"], ["ES", "Espírito Santo"], ["GO", "Goiás"], ["MA", "Maranhão"], ["MT", "Mato Grosso"],
    ["MS", "Mato Grosso do Sul"], ["MG", "Minas Gerais"], ["PA", "Pará"], ["PB", "Paraíba"], ["PR", "Paraná"],
    ["PE", "Pernambuco"], ["PI", "Piauí"], ["RJ", "Rio de Janeiro"], ["RN", "Rio Grande do Norte"],
    ["RS", "Rio Grande do Sul"], ["RO", "Rondônia"], ["RR", "Roraima"], ["SC", "Santa Catarina"], ["SP", "São Paulo"],
    ["SE", "Sergipe"], ["TO", "Tocantins"]];
  var lead = document.getElementById("parc-lead");
  // Municípios do IBGE por estado, buscados na API (functions/_cidades.js)
  var cidadesUf = {};
  function cidadesDe(uf) {
    if (!cidadesUf[uf]) cidadesUf[uf] = api("GET", "cidades?uf=" + uf).then(function (r) { return r.cidades; })
      .catch(function (e) { delete cidadesUf[uf]; throw e; });
    return cidadesUf[uf];
  }
  function chave(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

  // ---------- utilidades ----------
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function entrada(tipo, extra) {
    var i = el("input");
    i.type = tipo;
    if (extra) Object.keys(extra).forEach(function (k) { i[k] = extra[k]; });
    return i;
  }
  function campo(rotulo, input, dica, cheio) {
    var l = el("label", "orc__field" + (cheio ? " assess-grid__full" : ""));
    l.append(el("span", null, rotulo), input);
    if (dica) l.append(el("small", "assess-dica", dica));
    return l;
  }
  function botao(texto, cls, fn) {
    var b = el("button", cls || "orc__email", texto);
    b.type = "button";
    if (fn) b.addEventListener("click", fn);
    return b;
  }
  function card(passo, titulo) {
    var c = el("section", "assess-card");
    if (passo) c.append(el("p", "assess-card__step", passo));
    if (titulo) c.append(el("h2", null, titulo));
    return c;
  }
  function erroEl() { var e = el("p", "orc__erro"); e.hidden = true; e.setAttribute("role", "alert"); return e; }
  function mostraErro(e, msg) { e.textContent = msg; e.hidden = !msg; }
  function dataDe(str) { var p = String(str).split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function quando(str) { if (!str) return ""; var d = dataDe(str); return d.getDate() + " de " + MESES[d.getMonth()] + " de " + d.getFullYear(); }
  // CNPJ com dígitos verificadores (mesma conta de functions/api/parceiro)
  function cnpjOk(v) {
    var d = String(v || "").replace(/\D/g, "");
    if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
    function dv(n) {
      var s = 0, p = n - 7;
      for (var i = 0; i < n; i++) { s += Number(d[i]) * p--; if (p < 2) p = 9; }
      var r = s % 11;
      return r < 2 ? 0 : 11 - r;
    }
    return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
  }
  function numeroWa(t) { var n = String(t || "").replace(/\D/g, ""); if (n && n.length <= 11) n = "55" + n; return n; }
  function base() { return location.href.split("#")[0].split("?")[0].replace(/[^\/]*$/, ""); }
  function linkWa(msg) { return "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(msg); }
  function copiar(texto, b) {
    var orig = b.textContent;
    var feito = function () { b.textContent = "Copiado!"; setTimeout(function () { b.textContent = orig; }, 1800); };
    if (navigator.clipboard) navigator.clipboard.writeText(texto).then(feito, function () {});
  }

  function api(metodo, caminho, dados) {
    var op = { method: metodo, credentials: "same-origin", headers: {} };
    if (dados !== undefined) { op.body = JSON.stringify(dados); op.headers["content-type"] = "application/json"; }
    return fetch("api/parceiro/" + caminho, op).then(function (r) {
      return r.text().then(function (t) {
        var j = null;
        try { j = t ? JSON.parse(t) : {}; } catch (e) { j = null; }
        if (!r.ok || j === null) {
          var err = new Error((j && j.mensagem) || (j === null ? "O cadastro de parceiros funciona só no site publicado." : "Erro " + r.status + "."));
          err.status = r.status;
          throw err;
        }
        return j;
      });
    });
  }

  // ---------- Google ----------
  var googleId = "", googlePronto = null;
  function carregaGoogle() {
    if (!googleId) return Promise.reject(new Error("sem google"));
    if (googlePronto) return googlePronto;
    googlePronto = new Promise(function (ok, erro) {
      var s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = function () { ok(window.google); };
      s.onerror = function () { googlePronto = null; erro(new Error("google")); };
      document.head.append(s);
    });
    return googlePronto;
  }
  // Desenha o botão do Google em "lugar"; a resposta (token) vai para aoEntrar
  function botaoGoogle(lugar, texto, aoEntrar) {
    if (!googleId) return;
    var caixa = el("div", "parc-google");
    var sep = el("p", "parc-sep", "ou com e-mail");
    lugar.append(caixa, sep);
    carregaGoogle().then(function (g) {
      g.accounts.id.initialize({ client_id: googleId, callback: function (r) { aoEntrar(r.credential); }, ux_mode: "popup" });
      g.accounts.id.renderButton(caixa, { theme: "outline", size: "large", shape: "pill", text: texto, locale: "pt-BR", width: Math.min(360, caixa.clientWidth || 320) });
    }).catch(function () { caixa.remove(); sep.remove(); });
  }

  // ---------- entrar / cadastrar ----------
  function telaAcesso(modo, google) {
    app.innerHTML = "";
    if (lead) lead.textContent = "Assessorias, influenciadores e embaixadores: entre ou faça o seu cadastro.";
    var abas = el("div", "cal-tabs parc-abas");
    abas.setAttribute("role", "group");
    abas.setAttribute("aria-label", "Entrar ou cadastrar");
    var bEntrar = botao("Já tenho cadastro", "cal-tab", function () { telaAcesso("entrar"); });
    var bCad = botao("Quero ser parceiro", "cal-tab", function () { telaAcesso("cadastro"); });
    bEntrar.setAttribute("aria-pressed", String(modo === "entrar"));
    bCad.setAttribute("aria-pressed", String(modo !== "entrar"));
    abas.append(bEntrar, bCad);
    app.append(abas);
    if (modo === "entrar") telaEntrar(); else telaCadastro(google);
  }

  function aoGoogle(erro) {
    return function (credential) {
      mostraErro(erro, "");
      api("POST", "google", { credential: credential }).then(function (r) {
        if (r.novo) telaAcesso("cadastro", { credential: credential, email: r.email, nome: r.nome });
        else inicio();
      }).catch(function (e) { mostraErro(erro, e.message); });
    };
  }

  function telaEntrar() {
    var c = card("Parceiros", "Entrar");
    var erro = erroEl();
    botaoGoogle(c, "signin_with", aoGoogle(erro));
    var f = el("form", "assess-grid");
    f.noValidate = true;
    var email = entrada("email", { autocomplete: "email", maxLength: 120, required: true });
    var senha = entrada("password", { autocomplete: "current-password", maxLength: 200, required: true });
    var ir = el("button", "btn btn--red btn--lg assess-grid__full", "Entrar");
    ir.type = "submit";
    f.append(campo("E-mail", email, null, true), campo("Senha", senha, null, true), ir);
    var esqueci = el("p", "muted parc-ajuda");
    esqueci.append(botao("Esqueci minha senha", "orc__email", function () { telaEsqueci(email.value.trim()); }));
    c.append(f, erro, esqueci);
    app.append(c);
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!email.value.trim() || !senha.value) return mostraErro(erro, "Informe o e-mail e a senha.");
      ir.disabled = true; ir.textContent = "Entrando...";
      api("POST", "login", { email: email.value.trim(), senha: senha.value }).then(inicio).catch(function (err) {
        ir.disabled = false; ir.textContent = "Entrar";
        mostraErro(erro, err.message);
      });
    });
  }

  // ---------- esqueci a senha ----------
  function linkWaSenha() {
    var a = el("a", null, "fale com a Tardim Produções pelo WhatsApp");
    a.href = linkWa("Olá! Sou parceiro da Tardim Produções e esqueci a senha da minha área.");
    a.target = "_blank"; a.rel = "noopener";
    return a;
  }
  function telaEsqueci(emailInicial) {
    app.innerHTML = "";
    var c = card("Área do parceiro", "Criar uma senha nova");
    c.append(el("p", "muted", "Informe o e-mail do seu cadastro. Mandamos um link para você criar uma senha nova."));
    var erro = erroEl();
    var f = el("form", "assess-grid");
    f.noValidate = true;
    var email = entrada("email", { autocomplete: "email", maxLength: 120, required: true, value: emailInicial || "" });
    var ir = el("button", "btn btn--red btn--lg assess-grid__full", "Enviar link");
    ir.type = "submit";
    f.append(campo("E-mail do cadastro", email, null, true), ir);
    var voltar = el("p", "muted parc-ajuda");
    voltar.append(botao("← Voltar para entrar", "orc__email", function () { telaAcesso("entrar"); }));
    c.append(f, erro, voltar);
    app.append(c);
    email.focus();
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      mostraErro(erro, "");
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.value.trim())) return mostraErro(erro, "Informe o e-mail do seu cadastro.");
      ir.disabled = true; ir.textContent = "Enviando...";
      api("POST", "esqueci", { email: email.value.trim() }).then(function (r) {
        f.remove();
        var ok = el("p", r.semEmail ? "assess-alerta" : "parc-google-ok");
        if (r.semEmail) ok.append("A troca de senha por e-mail ainda não está ativa. Para criar uma senha nova, ", linkWaSenha(), ".");
        else ok.textContent = "Pronto! Se houver cadastro com " + email.value.trim() + ", o link chega em alguns minutos. Ele vale por 1 hora. Confira também a caixa de spam.";
        c.insertBefore(ok, erro);
      }).catch(function (err) {
        ir.disabled = false; ir.textContent = "Enviar link";
        mostraErro(erro, err.message);
      });
    });
  }
  // Aberta pelo link do e-mail: parceiro.html#redefinir=<token>
  function telaNovaSenha(token) {
    app.innerHTML = "";
    var c = card("Área do parceiro", "Criar sua senha nova");
    var erro = erroEl();
    var f = el("form", "assess-grid");
    f.noValidate = true;
    var s1 = entrada("password", { autocomplete: "new-password", maxLength: 200, required: true });
    var s2 = entrada("password", { autocomplete: "new-password", maxLength: 200, required: true });
    var ir = el("button", "btn btn--red btn--lg assess-grid__full", "Salvar senha e entrar");
    ir.type = "submit";
    f.append(campo("Senha nova", s1, "Pelo menos 8 caracteres.", true), campo("Repita a senha nova", s2, null, true), ir);
    c.append(f, erro);
    app.append(c);
    s1.focus();
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (s1.value.length < 8) return mostraErro(erro, "A senha precisa ter pelo menos 8 caracteres.");
      if (s1.value !== s2.value) return mostraErro(erro, "As duas senhas estão diferentes.");
      mostraErro(erro, "");
      ir.disabled = true; ir.textContent = "Salvando...";
      api("POST", "nova-senha", { token: token, senha: s1.value }).then(inicio).catch(function (err) {
        ir.disabled = false; ir.textContent = "Salvar senha e entrar";
        mostraErro(erro, err.message);
        if (err.status === 400 && /expirou|usado/.test(err.message)) {
          var p = el("p", "muted parc-ajuda");
          p.append(botao("Pedir um link novo", "orc__email", function () { telaEsqueci(""); }));
          c.append(p);
        }
      });
    });
  }

  function telaCadastro(google) {
    var c = card("Cadastro de parceiro", google ? "Complete o seu cadastro" : "Quero ser parceiro");
    c.append(el("p", "muted", "Preencha os dados abaixo. A Tardim Produções confere o cadastro e avisa quando for aprovado."));
    var erro = erroEl();
    if (!google) botaoGoogle(c, "signup_with", aoGoogle(erro));
    else c.append(el("p", "parc-google-ok", "Conta Google: " + google.email));

    var f = el("form", "assess-grid");
    f.noValidate = true;
    // Tipo de parceiro: pode marcar mais de um (cada um vira um perfil no mesmo login)
    var tipos = el("fieldset", "parc-tipos assess-grid__full");
    tipos.append(el("legend", null, "Você é (marque um ou mais)"));
    var marcados = {};
    TIPOS.forEach(function (t) {
      var l = el("label", "parc-tipo");
      var r = entrada("checkbox", { name: "tipos", value: t[0] });
      r.addEventListener("change", function () { marcados[t[0]] = r.checked; ajusta(); });
      var txt = el("span");
      txt.append(el("b", null, t[1]), el("small", null, t[2]));
      l.append(r, txt);
      tipos.append(l);
    });
    function tem(t) { return !!marcados[t]; }
    var nome = entrada("text", { maxLength: 120, autocomplete: "name", value: google && google.nome || "" });
    var cNome = campo("Seu nome", nome, null, true);
    // Dados da assessoria (só quando "Assessoria" está marcada)
    var aNome = entrada("text", { maxLength: 120, autocomplete: "organization" });
    var cANome = campo("Nome da assessoria", aNome, null, true);
    var cnpj = entrada("text", { maxLength: 18, inputMode: "numeric", placeholder: "00.000.000/0000-00" });
    var cCnpj = campo("CNPJ da assessoria", cnpj, "Obrigatório para assessoria.");
    cnpj.addEventListener("input", function () {
      var d = cnpj.value.replace(/\D/g, "").slice(0, 14);
      cnpj.value = d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
    });
    var aInsta = entrada("text", { maxLength: 100, placeholder: "@assessoria" });
    var cAInsta = campo("Instagram da assessoria", aInsta, "Opcional.");
    var wa = entrada("tel", { maxLength: 20, autocomplete: "tel", inputMode: "numeric", placeholder: "(31) 90000-0000" });
    // Máscara: (31) 99999-9999 para celular, (31) 3333-4444 para fixo; tira o +55 de quem cola com DDI
    wa.addEventListener("input", function () {
      var d = wa.value.replace(/\D/g, "");
      if (d.length > 11 && d.indexOf("55") === 0) d = d.slice(2);
      d = d.slice(0, 11);
      var m = d.length > 10 ? d.replace(/^(\d{2})(\d{5})(\d{0,4})$/, "($1) $2-$3")
        : d.length > 6 ? d.replace(/^(\d{2})(\d{4})(\d{0,4})$/, "($1) $2-$3")
        : d.length > 2 ? d.replace(/^(\d{2})(\d+)$/, "($1) $2")
        : d.length ? "(" + d : "";
      wa.value = m;
    });
    // Estado em lista; cidade digitada com sugestões da lista do IBGE daquele estado
    var uf = el("select");
    var op0 = el("option", null, "Escolha o estado"); op0.value = ""; uf.append(op0);
    UFS.forEach(function (u) { var o = el("option", null, u[1]); o.value = u[0]; uf.append(o); });
    uf.value = "MG";
    var lista = el("datalist"); lista.id = "parc-cidades";
    var cidade = entrada("text", { maxLength: 80, autocomplete: "off", placeholder: "Digite para buscar" });
    cidade.setAttribute("list", lista.id);
    var cCidade = campo("Cidade", cidade, null);
    cCidade.append(lista);
    function carregaCidades() {
      lista.innerHTML = "";
      cidade.disabled = !uf.value;
      if (!uf.value) return;
      cidadesDe(uf.value).then(function (cs) {
        cs.forEach(function (n) { var o = el("option"); o.value = n; lista.append(o); });
      }).catch(function (e) { mostraErro(erro, e.message); });
    }
    uf.addEventListener("change", function () { cidade.value = ""; carregaCidades(); });
    carregaCidades();
    var insta = entrada("text", { maxLength: 100, placeholder: "@perfil" });
    var cInsta = campo("Seu Instagram", insta, "Opcional, mas ajuda na aprovação.");
    var seg = entrada("text", { maxLength: 13, inputMode: "numeric", placeholder: "Ex.: 15000" });
    var cSeg = campo("Seguidores (número estimado)", seg, "Somando o perfil principal.");
    seg.addEventListener("input", function () {
      var n = seg.value.replace(/\D/g, "");
      seg.value = n ? Number(n).toLocaleString("pt-BR") : "";
    });
    var email = entrada("email", { maxLength: 120, autocomplete: "email" });
    var senha = entrada("password", { maxLength: 200, autocomplete: "new-password", minLength: 8 });
    var senha2 = entrada("password", { maxLength: 200, autocomplete: "new-password" });
    var aceite = entrada("checkbox");
    var lAceite = el("label", "assess-toggle assess-grid__full");
    var tAceite = el("span");
    var aPriv = el("a", null, "política de privacidade"); aPriv.href = "privacidade.html"; aPriv.target = "_blank";
    var aReg = el("a", null, "regras do programa de parceiros"); aReg.href = "programa-embaixadores.html"; aReg.target = "_blank";
    tAceite.append("Li e aceito a ", aPriv, " e as ", aReg, ".");
    lAceite.append(aceite, tAceite);
    var ir = el("button", "btn btn--red btn--lg assess-grid__full", "Enviar cadastro");
    ir.type = "submit";

    f.append(tipos, cNome, cANome, cCnpj, cAInsta, campo("WhatsApp", wa, null, true), campo("Estado", uf), cCidade, cInsta, cSeg);
    if (!google) f.append(campo("E-mail", email, null, true), campo("Senha", senha, "Pelo menos 8 caracteres."), campo("Repita a senha", senha2));
    f.append(lAceite, ir);
    c.append(f, erro);
    app.append(c);

    function ajusta() {
      var ass = tem("assessoria"), inf = tem("influenciador"), pessoa = inf || tem("embaixador");
      cANome.hidden = cCnpj.hidden = cAInsta.hidden = !ass;
      cNome.querySelector("span").textContent = ass && !pessoa ? "Seu nome (responsável pela assessoria)" : "Seu nome";
      cInsta.hidden = ass && !pessoa;
      cSeg.hidden = !inf;
      cInsta.querySelector("small").textContent = inf ? "Obrigatório para influenciador." : "Opcional, mas ajuda na aprovação.";
    }
    ajusta();
    // Ao sair do campo, troca o que foi digitado pelo nome oficial ("sao joao del rei" -> "São João del-Rei")
    cidade.addEventListener("change", function () { cidade.value = cidadeDaLista() || cidade.value; });
    function cidadeDaLista() {
      var k = chave(cidade.value);
      var o = k && [].filter.call(lista.options, function (x) { return chave(x.value) === k; })[0];
      return o ? o.value : "";
    }

    f.addEventListener("submit", function (e) {
      e.preventDefault();
      mostraErro(erro, "");
      var lista_ = TIPOS.map(function (t) { return t[0]; }).filter(tem);
      var ass = tem("assessoria"), inf = tem("influenciador");
      var falta = !lista_.length ? "Marque se você é assessoria, influenciador e/ou embaixador."
        : nome.value.trim().length < 2 ? "Informe o seu nome."
        : ass && aNome.value.trim().length < 2 ? "Informe o nome da assessoria."
        : ass && !cnpjOk(cnpj.value) ? "Informe um CNPJ válido da assessoria."
        : wa.value.replace(/\D/g, "").length < 10 ? "Informe um WhatsApp com DDD."
        : !uf.value ? "Escolha o estado."
        : !cidadeDaLista() ? "Escolha a cidade na lista (digite e toque na sugestão)."
        : inf && !insta.value.trim() ? "Informe o seu perfil do Instagram."
        : inf && !Number(seg.value.replace(/\D/g, "")) ? "Informe o número estimado de seguidores."
        : !google && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.value.trim()) ? "Informe um e-mail válido."
        : !google && senha.value.length < 8 ? "A senha precisa ter pelo menos 8 caracteres."
        : !google && senha.value !== senha2.value ? "As senhas não são iguais."
        : !aceite.checked ? "Para continuar, aceite a política de privacidade e as regras do programa." : "";
      if (falta) return mostraErro(erro, falta);
      var dados = {
        tipos: lista_, nome: nome.value.trim(),
        whatsapp: wa.value.trim(), uf: uf.value, cidade: cidadeDaLista(), instagram: cInsta.hidden ? "" : insta.value.trim(),
        seguidores: inf ? Number(seg.value.replace(/\D/g, "")) : 0, aceite: true,
      };
      if (ass) { dados.assessoria_nome = aNome.value.trim(); dados.cnpj = cnpj.value; dados.assessoria_instagram = aInsta.value.trim(); }
      if (google) dados.credential = google.credential;
      else { dados.email = email.value.trim(); dados.senha = senha.value; }
      ir.disabled = true; ir.textContent = "Enviando...";
      api("POST", "cadastro", dados).then(inicio).catch(function (err) {
        ir.disabled = false; ir.textContent = "Enviar cadastro";
        // Token do Google vence em 1 hora: pede para entrar de novo
        if (google && err.status === 401) return telaAcesso("cadastro");
        mostraErro(erro, err.message);
      });
    });
  }

  // ---------- área do parceiro ----------
  function provaPorId(id) { return PROVAS.filter(function (p) { return p.id === id; })[0]; }
  function linksConvite(cv, pa) {
    var b = base();
    var l = {
      atleta: b + "prova-" + cv.prova_id + ".html?cupom=" + encodeURIComponent(cv.cupom),
      kit: b + "kit.html?p=" + encodeURIComponent(cv.prova_id) + "&c=" + encodeURIComponent(cv.cupom) + "&n=" + encodeURIComponent(pa.nome) +
        (cv.desconto ? "&d=" + encodeURIComponent(cv.desconto) : ""),
    };
    // Mesmo link de js/admin.js (linksConvite)
    if ((pa.tipo === "assessoria" || pa.tipo === "equipe") && window.CONVITE) {
      var co = cv.coletiva && !Array.isArray(cv.coletiva) ? cv.coletiva : {};
      l.coletiva = b + "assessorias.html?c=" + CONVITE.gera({
        p: cv.prova_id, e: pa.nome, d: co.d || "", m: co.m || 0, a: pa.id, t: pa.responsavel || "",
        w: numeroWa(pa.whatsapp), c: (pa.cor || "").replace(/^#/, ""), l: pa.logo || "", k: cv.cortesias || 0,
        v: co.v, f: co.f, g: co.g, b: co.b, kt: co.kt, pe: co.pe, i: co.i,
      });
    }
    return l;
  }

  // Um login pode ter vários perfis (assessoria, influenciador, embaixador): abas para trocar
  var perfilAtual = "";
  function area(d) {
    var perfis = d.perfis || [];
    var pa = perfis.filter(function (p) { return p.id === perfilAtual; })[0] || perfis[0];
    perfilAtual = pa.id;
    app.innerHTML = "";
    var dono = perfis.filter(function (p) { return p.tipo !== "assessoria"; })[0];
    var pessoa = dono ? dono.nome : (pa.responsavel || pa.nome);
    if (lead) lead.textContent = "Olá, " + pessoa.split(" ")[0] + "! Aqui ficam os seus convites, cupons e links.";
    var topo = el("div", "painel-top");
    topo.append(el("p", "muted", pa.nome + " · " + d.email), botao("Sair", null, function () {
      perfilAtual = "";
      api("POST", "sair").then(inicio, inicio);
    }));
    app.append(topo);
    if (perfis.length > 1) {
      var abas = el("div", "cal-tabs parc-abas");
      abas.setAttribute("role", "group");
      abas.setAttribute("aria-label", "Seus perfis");
      perfis.forEach(function (p) {
        var t = TIPOS.filter(function (x) { return x[0] === p.tipo; })[0];
        var b = botao((t ? t[1] : p.tipo) + (p.situacao === "pendente" ? " (em análise)" : ""), "cal-tab", function () {
          perfilAtual = p.id; area(d);
        });
        b.setAttribute("aria-pressed", String(p.id === pa.id));
        abas.append(b);
      });
      app.append(abas);
    }
    d = Object.assign({}, d, { convites: pa.convites || [] });

    if (pa.situacao === "pendente") {
      var c1 = card("Cadastro recebido", "Em análise");
      c1.append(el("p", null, "Obrigado! A Tardim Produções vai conferir os seus dados e avisar pelo WhatsApp quando o cadastro for aprovado. Depois disso, os seus convites aparecem aqui."));
      var w1 = el("a", "btn btn--wa", "Falar com a Tardim Produções");
      w1.href = linkWa("Olá! Fiz o cadastro de parceiro como " + pa.nome + " e queria saber da aprovação.");
      w1.target = "_blank"; w1.rel = "noopener";
      c1.append(w1);
      return app.append(c1);
    }
    if (pa.situacao === "recusado" || !pa.ativo) {
      var c2 = card("Cadastro", pa.situacao === "recusado" ? "Cadastro não aprovado" : "Cadastro inativo");
      c2.append(el("p", null, pa.motivo_recusa || "No momento o seu cadastro não está ativo. Se quiser, fale com a Tardim Produções."));
      var w2 = el("a", "btn btn--wa", "Falar com a Tardim Produções");
      w2.href = linkWa("Olá! Sou " + pa.nome + " e queria falar sobre o meu cadastro de parceiro.");
      w2.target = "_blank"; w2.rel = "noopener";
      c2.append(w2);
      return app.append(c2);
    }

    var c = card("Seus convites", d.convites.length ? (d.convites.length === 1 ? "1 prova" : d.convites.length + " provas") : "Nenhum convite ainda");
    if (!d.convites.length) {
      c.append(el("p", "muted", "Cadastro aprovado! Quando a Tardim Produções te convidar para uma prova, o cupom e os links aparecem aqui."));
      return app.append(c);
    }
    d.convites.forEach(function (cv) {
      var pv = provaPorId(cv.prova_id);
      var bloco = el("article", "parc-convite");
      bloco.append(el("h3", null, pv ? pv.nome : cv.prova_id));
      var info = [];
      if (pv && pv.data) info.push(quando(pv.data));
      info.push("cupom " + cv.cupom + (cv.desconto ? " (" + cv.desconto + " de desconto)" : ""));
      bloco.append(el("p", "muted", info.join(" · ")));
      var cond = [];
      if (Number(cv.comissao_pct)) cond.push("Comissão de " + String(cv.comissao_pct).replace(".", ",") + "% por inscrição paga com o seu cupom");
      if (cv.cortesias) cond.push(cv.cortesias + (cv.cortesias > 1 ? " inscrições" : " inscrição") + " de cortesia" + (cv.contrapartida ? " (" + cv.contrapartida + ")" : ""));
      if (cv.condicoes) cond.push(cv.condicoes);
      if (cond.length) { var ul = el("ul", "parc-cond"); cond.forEach(function (t) { ul.append(el("li", null, t)); }); bloco.append(ul); }
      var l = linksConvite(cv, pa);
      var caixa = el("div", "painel-links");
      [["Link para os atletas", l.atleta], ["Kit de divulgação", l.kit], l.coletiva ? ["Inscrição coletiva da equipe", l.coletiva] : null].forEach(function (x) {
        if (!x) return;
        var linha = el("div", "convite-link");
        var i = entrada("text", { value: x[1], readOnly: true });
        i.setAttribute("aria-label", x[0]);
        i.addEventListener("focus", function () { i.select(); });
        var cp = botao("Copiar", null, function () { copiar(x[1], cp); });
        var ab = el("a", "orc__email", "Abrir"); ab.href = x[1]; ab.target = "_blank"; ab.rel = "noopener";
        var ac = el("div", "painel-acoes-linha"); ac.append(cp, ab);
        linha.append(el("span", "painel-links__t", x[0]), i, ac);
        caixa.append(linha);
      });
      bloco.append(caixa);
      c.append(bloco);
    });
    app.append(c);
  }

  // ---------- início ----------
  function inicio() {
    return api("GET", "eu").then(area).catch(function (e) {
      // parceiro.html#cadastro (botões "Quero ser parceiro") abre direto no formulário
      if (e.status === 401) return telaAcesso(location.hash === "#cadastro" ? "cadastro" : "entrar");
      app.innerHTML = "";
      var c = card("Área do parceiro", "Indisponível no momento");
      c.append(el("p", "assess-alerta", e.message));
      app.append(c);
    });
  }
  // Link do e-mail de senha nova: tira o código do endereço (não fica no histórico) e abre o formulário
  var redefinir = /^#redefinir=([\w.-]+)$/.exec(location.hash);
  if (redefinir) history.replaceState(null, "", location.pathname + location.search);
  api("GET", "config").then(function (c) { googleId = c.google || ""; }, function () {})
    .then(function () { return redefinir ? telaNovaSenha(redefinir[1]) : inicio(); });
})();
