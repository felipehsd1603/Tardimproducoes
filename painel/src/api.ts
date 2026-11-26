// Cliente da API do painel (functions/api/admin). Erros: { erro: <status>, mensagem }.
// 401 fora do login = sessão terminou: volta para a tela de login sem mostrar erro.
import { telaLogin } from "./loja.tsx";

export class ErroApi extends Error {
  status = 0; semApi = false; silencioso = false;
}

export async function api<T = unknown>(metodo: string, caminho: string, dados?: unknown, tipo?: string): Promise<T> {
  const op: RequestInit & { headers: Record<string, string> } = { method: metodo, credentials: "same-origin", headers: {} };
  if (dados instanceof Blob) { op.body = dados; op.headers["content-type"] = tipo || dados.type; }
  else if (dados !== undefined) { op.body = JSON.stringify(dados); op.headers["content-type"] = "application/json"; }
  const r = await fetch("api/admin/" + caminho, op);
  const t = await r.text();
  let j: { mensagem?: string } | null = null;
  try { j = t ? JSON.parse(t) : {}; } catch (e) { j = null; }
  if (r.status === 401 && caminho !== "login") {
    telaLogin("Sua sessão terminou. Entre de novo.");
    const e = new ErroApi("sessão terminou"); e.silencioso = true; throw e;
  }
  if (!r.ok || j === null) {
    const err = new ErroApi((j && j.mensagem) || (r.status === 404 && j === null ? "o painel precisa do Cloudflare Pages (as funções não responderam)" : "erro " + r.status));
    err.status = r.status; err.semApi = j === null;
    throw err;
  }
  return j as T;
}

export async function enviaImagem(pasta: string, nome: string, blob: Blob, tipo: string): Promise<string> {
  const ext = tipo === "image/png" ? "png" : "jpg";
  const caminho = pasta + "/" + nome + "-" + Date.now().toString(36) + "." + ext;
  await api("POST", "arquivos?caminho=" + encodeURIComponent(caminho), blob, tipo);
  return caminho;
}
export const urlArquivo = (caminho: string) => (!caminho ? "" : (/^(https?:|arquivos\/|assets\/)/.test(caminho) ? caminho : "arquivos/" + caminho));
