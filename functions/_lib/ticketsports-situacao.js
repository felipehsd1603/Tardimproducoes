// Situação das inscrições na Ticket Sports: abre a página pública de cada prova e lê o "availability"
// do schema.org que a própria página traz (InStock = aberta, SoldOut = esgotada).
// Grava em provas.ts_situacao / ts_conferido_em / ts_mudou_em / ts_erro; o site junta isso com o
// campo "inscricoes" do painel (functions/_middleware.js) e com as datas dos lotes (js/eventos.js).
//
// Quem chama: o Worker agendado (workers/conferencia-ticketsports, 2x por dia) e o painel
// (POST /api/admin/provas/conferir-ticketsports). Página que não abre ou sem o dado: a situação
// anterior fica como estava e o motivo vai em ts_erro.

const ABERTA = ["InStock", "LimitedAvailability", "PreOrder", "PreSale", "BackOrder", "OnlineOnly", "InStoreOnly"];
const ESGOTADA = ["SoldOut", "OutOfStock"];
const ENCERRADA = ["Discontinued"];

// "aberta" | "esgotado" | "encerrado", ou { erro } quando a página não diz
export function situacaoDaPagina(html) {
  const achados = (re) => [...String(html || "").matchAll(re)].map((m) => m[1]);
  // JSON-LD normal; se não houver, o mesmo dado escapado dentro do JSON da página
  let v = achados(/"availability"\s*:\s*"(?:https?:\/\/schema\.org\/)?([A-Za-z]+)"/g);
  if (!v.length) v = achados(/\\"availability\\"\s*:\s*\\"(?:https?:\/\/schema\.org\/)?([A-Za-z]+)\\"/g);
  if (!v.length) return { erro: "a página não informa a disponibilidade" };
  if (v.some((x) => ABERTA.includes(x))) return { situacao: "aberta", bruto: v.join(",") };
  if (v.every((x) => ESGOTADA.includes(x))) return { situacao: "esgotado", bruto: v.join(",") };
  if (v.every((x) => ESGOTADA.includes(x) || ENCERRADA.includes(x))) return { situacao: "encerrado", bruto: v.join(",") };
  return { erro: "disponibilidade desconhecida: " + [...new Set(v)].join(", ") };
}

export function linkTicketSports(link) {
  try {
    const u = new URL(link);
    return u.protocol === "https:" && (u.hostname === "ticketsports.com.br" || u.hostname.endsWith(".ticketsports.com.br")) ? u.toString() : null;
  } catch (e) {
    return null;
  }
}

// Dia de hoje em Brasília (AAAA-MM-DD)
function hojeBR(agora) {
  return new Date(agora.getTime() - 3 * 3600000).toISOString().slice(0, 10);
}

// Confere as provas publicadas que ainda vão acontecer e têm link da Ticket Sports.
// Devolve [{ id, nome, situacao?, antes, erro? }]
export async function confereTicketSports(env, opcoes) {
  const o = opcoes || {};
  const agora = o.agora || new Date();
  const buscar = o.fetch || fetch;
  const quando = agora.toISOString().replace(/\.\d{3}Z$/, "Z");
  const provas = (await env.DB.prepare(
    "SELECT id, nome, inscricao, ts_situacao FROM provas WHERE publicada = 1 AND data >= ? AND inscricao <> '' ORDER BY data LIMIT 40"
  ).bind(hojeBR(agora)).all()).results;
  const saida = [];
  for (const p of provas) {
    const link = linkTicketSports(p.inscricao);
    if (!link) continue;
    let r;
    try {
      const resp = await buscar(link, {
        headers: { "user-agent": "Mozilla/5.0 (compatible; TardimProducoes/1.0; +https://tardimproducoes.com.br/)", accept: "text/html" },
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });
      r = resp.ok ? situacaoDaPagina((await resp.text()).slice(0, 2000000)) : { erro: "a página respondeu " + resp.status };
    } catch (e) {
      r = { erro: "a página não abriu (" + String((e && e.name) || "erro") + ")" };
    }
    if (r.situacao) {
      // No UPDATE do SQLite, ts_situacao à direita ainda é o valor antigo
      await env.DB.prepare(
        "UPDATE provas SET ts_mudou_em = CASE WHEN ts_situacao <> ?1 THEN ?2 ELSE ts_mudou_em END, ts_situacao = ?1, ts_conferido_em = ?2, ts_erro = '' WHERE id = ?3"
      ).bind(r.situacao, quando, p.id).run();
    } else {
      await env.DB.prepare("UPDATE provas SET ts_conferido_em = ?1, ts_erro = ?2 WHERE id = ?3").bind(quando, r.erro.slice(0, 200), p.id).run();
    }
    saida.push({ id: p.id, nome: p.nome, antes: p.ts_situacao || "", situacao: r.situacao || "", erro: r.erro || "" });
  }
  return saida;
}
