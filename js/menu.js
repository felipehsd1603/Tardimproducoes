// Botão "Menu" do topo e o ano do rodapé, nas páginas sem script próprio para isso
// (fora do HTML para o CSP não precisar liberar scripts inline)
(function () {
  var btn = document.querySelector(".menu-btn");
  btn.addEventListener("click", function () {
    var open = document.body.classList.toggle("menu-open");
    btn.setAttribute("aria-expanded", String(open));
    btn.textContent = open ? "Fechar" : "Menu";
  });
  document.getElementById("ano").textContent = new Date().getFullYear();
})();
