// /api/inscricao-site/* — inscrição direta no site, para quem chega pelo link de embaixador ou influenciador
// (inscricao.html?prova=<id>&cupom=<CUPOM>). Lógica em functions/_lib/inscricoes-site.ts.
//
//   GET  prova/<id>?cupom=X     { prova, lote: { nome, valor_cheio, desconto, valor }, modalidades, camisetas, parceiro }
//   POST criar                  { prova, cupom, nome, cpf, email, telefone, nascimento, sexo, camiseta, modalidade, aceite, forma: pix|cartao }
//                               -> inscrição pública + { codigo } e o PIX copia e cola, ou { cartao: { url } } (Mercado Pago); vale 1 hora
//   GET  <id>?c=<codigo>        acompanha o pagamento (consulta a cobrança no banco, no máximo a cada 10 s)
//
// Erros: { erro: <status>, mensagem }. Limite: 20 inscrições criadas por hora por IP (dados inválidos não contam).

import { json, mesmaOrigem } from "../../_lib/http.ts";
import { dentroDoLimite } from "../../_lib/limite.ts";
import {
  ErroInscricao, provaAberta, conviteDoCupom, loteAtual, descontoDe, validaAtleta, criaInscricao, confere, publica, inscricaoComCodigo,
  acrescimoCartao, cartaoAtivo,
} from "../../_lib/inscricoes-site.ts";

async function corpo(request) {
  const t = await request.text();
  if (t.length > 20000) throw new ErroInscricao(413, "Dados grandes demais.");
  try { return JSON.parse(t || "{}"); } catch (e) { throw new ErroInscricao(400, "Dados inválidos."); }
}

async function trata(request, env, ctx, segs, url) {
  const m = request.method;
  if (m !== "GET" && !mesmaOrigem(request)) throw new ErroInscricao(403, "Origem não permitida.");

  if (segs[0] === "prova" && segs.length === 2 && m === "GET") {
    const { prova, cfg } = await provaAberta(env, segs[1]);
    const convite = await conviteDoCupom(env, prova.id, url.searchParams.get("cupom"));
    if (!convite) throw new ErroInscricao(404, "Cupom não encontrado para esta prova. Confira o link que o parceiro mandou.");
    const lote = await loteAtual(env, prova, cfg);
    if (!lote) throw new ErroInscricao(410, "As inscrições desta prova estão encerradas ou esgotadas.");
    const desconto = descontoDe(convite.desconto, lote.centavos);
    return json({
      prova: { id: prova.id, nome: prova.nome, data: prova.data, hora: prova.hora, local: prova.local, regulamento: prova.regulamento, poster: prova.poster },
      lote: { nome: lote.nome, ate: lote.ate, valor_cheio: lote.centavos, desconto, valor: lote.centavos - desconto },
      modalidades: cfg.modalidades, camisetas: cfg.camisetas,
      // Cartão (Mercado Pago): valor do PIX + a taxa repassada ao atleta; parcelas com juros do comprador
      cartao: cartaoAtivo(env, cfg)
        ? { acrescimo_pct: cfg.cartao.acrescimo_pct, parcelas: cfg.cartao.parcelas, valor: lote.centavos - desconto + acrescimoCartao(cfg, lote.centavos - desconto) }
        : null,
      cupom: convite.cupom, parceiro: convite.parceiro_nome,
    });
  }

  if (segs[0] === "criar" && segs.length === 1 && m === "POST") {
    const d = await corpo(request);
    const { prova, cfg } = await provaAberta(env, d.prova);
    const convite = await conviteDoCupom(env, prova.id, d.cupom);
    if (!convite) throw new ErroInscricao(404, "Cupom não encontrado para esta prova. Confira o link que o parceiro mandou.");
    const atleta = validaAtleta(d, cfg);
    // Conta só o que vai ao banco (erros de digitação no formulário não gastam o limite)
    if (!(await dentroDoLimite(env, request, "inscricao-site", 20, 3600))) throw new ErroInscricao(429, "Muitas inscrições deste endereço. Tente de novo mais tarde.");
    return json(await criaInscricao(env, ctx, { prova, cfg, convite, origem: "link", atleta, site: url.origin, forma: d.forma }), 201);
  }

  if (segs.length === 1 && m === "GET") {
    let l = await inscricaoComCodigo(env, segs[0], url.searchParams.get("c"));
    if (!l) throw new ErroInscricao(404, "Inscrição não encontrada.");
    l = await confere(env, l, { ctx, site: url.origin });
    const prova = await env.DB.prepare("SELECT id, nome, data, local FROM provas WHERE id = ?").bind(l.prova_id).first();
    return json(publica(l, prova));
  }
  throw new ErroInscricao(404, "Rota não encontrada.");
}

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  if (!env.DB) return json({ erro: 503, mensagem: "Banco indisponível." }, 503);
  const url = new URL(request.url);
  const segs = [].concat(params.rota || []).map((x) => decodeURIComponent(x));
  try {
    return await trata(request, env, ctx, segs, url);
  } catch (e) {
    if (e instanceof ErroInscricao) return json({ erro: e.status, mensagem: e.message }, e.status);
    if (/no such (table|column)/i.test(String((e && e.message) || e))) {
      return json({ erro: 503, mensagem: "A inscrição pelo site ainda não foi ativada no banco (migração 016)." }, 503);
    }
    console.error("[api/inscricao-site]", request.method, url.pathname, e);
    return json({ erro: 500, mensagem: "Erro no servidor." }, 500);
  }
}
