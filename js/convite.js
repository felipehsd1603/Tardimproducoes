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

  window.CONVITE = {
    // dados: { p: id da prova, e: equipe, d: prazo "aaaa-mm-dd" ou "", m: limite de atletas ou 0 }
    gera: function (dados) {
      var corpo = b64(JSON.stringify({ p: dados.p, e: dados.e, d: dados.d || "", m: Number(dados.m) || 0 }));
      return corpo + "." + hash(SAL + corpo);
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
