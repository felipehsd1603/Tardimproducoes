// Configurações do painel, imagens enviadas (tabela arquivos) e o PDF do contrato assinado.

import { json } from "../_lib/http.js";
import { Erro, corpo, MAX_ARQUIVO, RE_ARQUIVO } from "./comum.js";

// Configurações do painel: chave -> tamanho máximo do JSON
const CONFIGS = { contrato: 120000 };
async function config(request, env, m, chave) {
  if (m === "GET") {
    const r = await env.DB.prepare("SELECT valor FROM configuracoes WHERE chave = ?").bind(chave).first();
    try { return json(r ? JSON.parse(r.valor) : {}); } catch (e) { return json({}); }
  }
  if (m === "PUT") {
    const v = JSON.stringify(await corpo(request));
    if (v.length > CONFIGS[chave]) throw new Erro(400, "Configuração grande demais.");
    await env.DB.prepare(
      "INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')"
    ).bind(chave, v).run();
    return json(JSON.parse(v));
  }
  throw new Erro(405, "Método não permitido.");
}

// PDF do contrato assinado de uma proposta (só com login)
async function contratoAssinado(request, env, m, id) {
  if (!(await env.DB.prepare("SELECT 1 FROM propostas WHERE id = ?").bind(id).first())) throw new Erro(404, "Proposta não encontrada.");
  if (m === "GET") {
    const r = await env.DB.prepare("SELECT nome, dados FROM contratos_assinados WHERE proposta_id = ?").bind(id).first();
    if (!r) throw new Erro(404, "Nenhum contrato assinado foi enviado para esta proposta.");
    const bytes = r.dados instanceof ArrayBuffer ? r.dados : new Uint8Array(r.dados).buffer;
    const nome = String(r.nome || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "-").replace(/^-+/, "") || "contrato-assinado.pdf";
    return new Response(bytes, {
      headers: {
        "content-type": "application/pdf", "content-disposition": `attachment; filename="${nome}"`,
        "cache-control": "no-store", "x-content-type-options": "nosniff",
      },
    });
  }
  if (m === "PUT") {
    const tipo = (request.headers.get("content-type") || "").split(";")[0].trim();
    if (tipo !== "application/pdf") throw new Erro(400, "Envie o contrato assinado em PDF.");
    const dados = await request.arrayBuffer();
    if (!dados.byteLength) throw new Erro(400, "Arquivo vazio.");
    if (dados.byteLength > MAX_ARQUIVO) throw new Erro(413, "PDF grande demais (máximo de 1,9 MB). Guarde no Drive e cole o link.");
    if (String.fromCharCode(...new Uint8Array(dados, 0, Math.min(5, dados.byteLength))) !== "%PDF-") throw new Erro(400, "Esse arquivo não é um PDF.");
    const nome = String(new URL(request.url).searchParams.get("nome") || "contrato-assinado.pdf").slice(0, 120);
    await env.DB.prepare(
      "INSERT INTO contratos_assinados (proposta_id, nome, tamanho, dados) VALUES (?, ?, ?, ?) ON CONFLICT(proposta_id) DO UPDATE SET " +
      "nome = excluded.nome, tamanho = excluded.tamanho, dados = excluded.dados, enviado_em = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')"
    ).bind(id, nome, dados.byteLength, dados).run();
    return json({ ok: true, nome, tamanho: dados.byteLength });
  }
  if (m === "DELETE") {
    await env.DB.prepare("DELETE FROM contratos_assinados WHERE proposta_id = ?").bind(id).run();
    return json({ ok: true });
  }
  throw new Erro(405, "Método não permitido.");
}

async function enviaArquivo(request, env, url) {
  const caminho = url.searchParams.get("caminho") || "";
  if (!RE_ARQUIVO.test(caminho)) throw new Erro(400, "Nome de arquivo inválido.");
  const tipo = (request.headers.get("content-type") || "").split(";")[0].trim();
  if (!/^image\/(jpeg|png|webp)$/.test(tipo)) throw new Erro(400, "Envie uma imagem JPG, PNG ou WebP.");
  const dados = await request.arrayBuffer();
  if (!dados.byteLength) throw new Erro(400, "Arquivo vazio.");
  if (dados.byteLength > MAX_ARQUIVO) throw new Erro(413, "Imagem grande demais (máximo de 1,9 MB).");
  await env.DB.prepare("INSERT INTO arquivos (caminho, tipo, tamanho, dados) VALUES (?, ?, ?, ?)").bind(caminho, tipo, dados.byteLength, dados).run();
  return json({ ok: true, caminho, url: "arquivos/" + caminho }, 201);
}

export { CONFIGS, config, contratoAssinado, enviaArquivo };
