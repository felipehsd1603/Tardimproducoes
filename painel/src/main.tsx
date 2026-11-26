// Painel da Tardim Produções (React + TypeScript): provas, parceiros, convites, apuração das comissões,
// o que chega pelo site, propostas e contratos. Fala com functions/api/admin; entra quem tem a senha do painel.
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";

const raiz = document.getElementById("painel");
if (raiz) {
  raiz.textContent = "";
  createRoot(raiz).render(<App />);
}
