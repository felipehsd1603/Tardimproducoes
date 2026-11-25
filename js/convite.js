/*
 * Convite de inscrição coletiva: gera e lê o código que vai no link enviado
 * a cada assessoria (prova, equipe, prazo e limite de atletas).
 * Observação: num site sem servidor isso evita acesso casual e links
 * alterados por engano, mas não é uma proteção forte.
 */
(function () {
  "use strict";
  var SAL = "tardim-producoes-fazendo-bem-feito";

  function hash(txt) {
    var h = 0x811c9dc5;
    for (var i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(36);
  }
  function b64(txt) {
    return btoa(unescape(encodeURIComponent(txt))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function deb64(txt) {
    txt = txt.replace(/-/g, "+").replace(/_/g, "/");
    while (txt.length % 4) txt += "=";
    return decodeURIComponent(escape(atob(txt)));
  }

  // Campos opcionais da personalização (só entram no link quando preenchidos):
  //   t  nome do treinador            w  WhatsApp do treinador (só números)
  //   c  cor da equipe "rrggbb"       l  arquivo da logo em assets/assessorias/
  //   v  valor por atleta (número)    f  faixas de desconto [[mínimo de atletas, %], ...]
  //   k  cortesias (inscrições grátis) g  forma de pagamento combinada
  //   b  benefícios: letras t (tenda), k (kits em lote), f (foto oficial), e (ponto de encontro)
  //   kt horário/local da retirada de kits   pe ponto de encontro
  //   i  prazo interno para os atletas "aaaa-mm-dd"
  //   x  1 = link público da equipe (para os atletas; não abre a inscrição coletiva)
  //   a  id da assessoria no cadastro do banco (tabela parceiros)
  var OPCIONAIS = ["t", "w", "c", "l", "v", "f", "k", "g", "b", "kt", "pe", "i", "x", "a"];
  var PUBLICOS = ["t", "w", "c", "l"];

  window.CONVITE = {
    // dados: { p: id da prova, e: equipe, d: prazo "aaaa-mm-dd" ou "", m: limite de atletas ou 0 } + opcionais
    gera: function (dados) {
      var o = { p: dados.p, e: dados.e, d: dados.d || "", m: Number(dados.m) || 0 };
      OPCIONAIS.forEach(function (k) {
        var v = dados[k];
        if (v == null || v === "" || v === 0 || (Array.isArray(v) && !v.length)) return;
        o[k] = v;
      });
      var corpo = b64(JSON.stringify(o));
      return corpo + "." + hash(SAL + corpo);
    },
    // Link que o treinador manda aos atletas: leva só o que todos podem ver
    // (sem valores, descontos nem limite).
    publico: function (d) {
      var o = { p: d.p, e: d.e, x: 1, i: d.i || d.d || "" };
      PUBLICOS.forEach(function (k) { if (d[k]) o[k] = d[k]; });
      return this.gera(o);
    },
    cor: function (d) { return d && /^[0-9a-f]{6}$/i.test(d.c || "") ? "#" + d.c : ""; },
    // Logo: caminho no banco ("assessorias/arquivo.png", cadastrado no painel e servido em /arquivos/)
    // ou, sem banco, nome de um arquivo em assets/assessorias/.
    logo: function (d) { return d ? this.logoUrl(d.l) : ""; },
    logoUrl: function (l) {
      l = String(l || "");
      if (/^assessorias\/[\w-][\w.-]*\.(png|jpe?g|webp)$/i.test(l)) {
        return "arquivos/" + l;
      }
      return /^[\w-][\w.-]*\.(png|jpe?g|webp)$/i.test(l) ? "assets/assessorias/" + l : "";
    },
    le: function (codigo) {
      if (!codigo || codigo.indexOf(".") < 0) return null;
      var partes = codigo.split(".");
      if (hash(SAL + partes[0]) !== partes[1]) return null;
      try {
        var d = JSON.parse(deb64(partes[0]));
        return d && d.p && d.e ? d : null;
      } catch (e) { return null; }
    },
  };
})();
