/*
 * Provas cadastradas no painel. No site publicado no Cloudflare, este endereço
 * é respondido na hora pelo banco D1 (functions/_middleware.js) e este arquivo
 * não é usado. Ele só existe para o site abrir sem erro fora do Cloudflare
 * (arquivo aberto direto no navegador, GitHub Pages): lá, sem provas do painel.
 */
(function () {
  var DB = [];
  if (typeof PROXIMAS === "undefined") return;
  DB.forEach(function (p) {
    for (var i = 0; i < PROXIMAS.length; i++) if (PROXIMAS[i].id === p.id) { PROXIMAS[i] = p; return; }
    PROXIMAS.push(p);
  });
})();
