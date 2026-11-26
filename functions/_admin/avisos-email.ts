// "Me avise quando abrir": e-mail de inscrições abertas pelo Resend (segredos RESEND_API_KEY e AVISO_REMETENTE).

import { Erro, RE_ID_PROVA } from "./comum.ts";
import type { Env, Dados } from "../_lib/tipos.ts";

interface PedidoAviso { id: string; nome: string; email: string }

// ---------- "Me avise": e-mail de inscrições abertas ----------
const escHtml = (s: unknown): string => String(s || "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[ch]);
async function enviaAvisos(env: Env, provaId: string, d: Dados, origem: string): Promise<{ enviados: number; falhas: number }> {
  if (!RE_ID_PROVA.test(provaId)) throw new Erro(400, "Prova inválida.");
  if (!env.RESEND_API_KEY) throw new Erro(503, "O envio de e-mail ainda não foi configurado (falta o segredo RESEND_API_KEY).");
  const nome = String(d.nome || "").trim().slice(0, 160);
  const link = String(d.link || "").trim().slice(0, 500);
  const data = String(d.data || "").trim().slice(0, 60);
  const local = String(d.local || "").trim().slice(0, 200);
  if (!nome) throw new Erro(400, "Falta o nome da prova.");
  if (!/^https:\/\/[^\s"<>]+$/.test(link)) throw new Erro(400, "A prova ainda não tem o link de inscrição.");
  const fila = (await env.DB.prepare("SELECT id, nome, email FROM avisos WHERE prova_id = ? AND enviado_em = '' LIMIT 500")
    .bind(provaId).all<PedidoAviso>()).results;
  if (!fila.length) return { enviados: 0, falhas: 0 };
  const remetente = env.AVISO_REMETENTE || "Tardim Produções <onboarding@resend.dev>";
  // pagina_id: avisar quem pediu a "próxima edição" de uma prova realizada com o link da prova nova
  const pagina = origem + "/prova-" + (RE_ID_PROVA.test(d.pagina_id || "") ? d.pagina_id : provaId) + ".html";
  let enviados = 0, falhas = 0;
  // Um e-mail por pessoa (ninguém vê o endereço dos outros), em lotes de 100 (limite do /emails/batch)
  for (let i = 0; i < fila.length; i += 100) {
    const lote = fila.slice(i, i + 100);
    const msgs = lote.map((p) => {
      const ola = p.nome ? "Olá, " + p.nome.split(" ")[0] + "!" : "Olá!";
      const cancelar = origem + "/api/aviso?cancelar=" + p.id;
      return {
        from: remetente, to: [p.email], subject: "Inscrições abertas: " + nome,
        headers: { "List-Unsubscribe": "<" + cancelar + ">" },
        text: [ola, "", "As inscrições para a " + nome + " estão abertas" + (data ? " (prova em " + data + (local ? ", " + local : "") + ")" : "") + ".",
          "", "Inscreva-se: " + link, "", "Detalhes da prova: " + pagina, "", "Tardim Produções",
          "", "Você recebeu este e-mail porque pediu o aviso no site. Para cancelar: " + cancelar].join("\n"),
        html: `<div style="font-family:Arial,sans-serif;font-size:16px;color:#24325a;line-height:1.5">
<p>${escHtml(ola)}</p><p>As inscrições para a <b>${escHtml(nome)}</b> estão abertas${data ? " (prova em " + escHtml(data) + (local ? ", " + escHtml(local) : "") + ")" : ""}.</p>
<p><a href="${escHtml(link)}" style="display:inline-block;background:#c8102e;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Fazer minha inscrição</a></p>
<p><a href="${escHtml(pagina)}">Ver detalhes da prova</a></p><p>Tardim Produções</p>
<p style="font-size:12px;color:#777">Você recebeu este e-mail porque pediu o aviso no site. <a href="${escHtml(cancelar)}">Cancelar o aviso</a>.</p></div>`,
      };
    });
    const r = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { authorization: "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" },
      body: JSON.stringify(msgs),
    });
    if (!r.ok) {
      const msg = ((await r.json<Dados>().catch((): Dados => ({}))).message || "erro " + r.status);
      if (!enviados) throw new Erro(502, "O Resend recusou o envio: " + msg);
      falhas += lote.length;
      break;
    }
    await env.DB.batch(lote.map((p) => env.DB.prepare("UPDATE avisos SET enviado_em = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?").bind(p.id)));
    enviados += lote.length;
  }
  return { enviados, falhas };
}

export { enviaAvisos };
