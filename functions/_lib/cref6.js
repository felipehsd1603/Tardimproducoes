// Consulta pública do CREF6/MG (profissionais de Educação Física de Minas Gerais).
//
// O CREF6 não tem API: este módulo faz, pelo servidor, a mesma pesquisa da página
// pública "Consulta cadastral" (por número de registro) e lê a tabela de resultado.
// Não há CAPTCHA nem login. Se o CREF6 mudar a página, a consulta passa a devolver
// { ok: false } e o cadastro segue sem a validação automática (confira à mão).
//
// Uso (numa Function):  import { consultaCref6 } from "../../_lib/cref6.js";
//   const r = await consultaCref6("012345-G/MG");
//   r = { ok: true, encontrado: true, registro: "MG-012345", nome, categoria, situacao, ativo }
//     | { ok: true, encontrado: false, registro: "MG-012345" }
//     | { ok: false, erro: "numero" | "indisponivel" }

export const CREF6_URL = "https://portal.cref6.org.br/spw/ConsultaCadastral/TelaConsultaPublicaCompleta.aspx";
const CAMPO = "ctl00$ContentPlaceHolder1$Callbackconsulta$txtConsultaTotal";
const BOTAO = "ctl00$ContentPlaceHolder1$Callbackconsulta$btnConsultaTotal";
const AGENTE = "Mozilla/5.0 (compatible; TardimProducoes/1.0; validacao de registro profissional)";

// "012345-G/MG", "MG-12345", "12345" -> "012345" (só os números, com 6 casas)
export function numeroCref(texto) {
  const d = String(texto == null ? "" : texto).replace(/\D/g, "").replace(/^0+/, "");
  if (!d || d.length > 6) return "";
  return ("000000" + d).slice(-6);
}

function desfaz(s) {
  return String(s).replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(Number(n)); })
    .replace(/&#x([0-9a-f]+);/gi, function (_, n) { return String.fromCharCode(parseInt(n, 16)); })
    .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
function texto(html) {
  return desfaz(String(html).replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

// Campos do formulário (inclui __VIEWSTATE e __EVENTVALIDATION), menos os botões
function campos(html) {
  const f = new URLSearchParams();
  const re = /<input\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const t = m[0];
    const nome = /\bname="([^"]*)"/i.exec(t);
    if (!nome || /\btype="submit"/i.test(t)) continue;
    const valor = /\bvalue="([^"]*)"/i.exec(t);
    f.set(desfaz(nome[1]), valor ? desfaz(valor[1]) : "");
  }
  return f;
}

// Linhas da tabela de profissionais: registro, nome, categoria e situação
export function linhasCref6(html) {
  const out = [];
  const partes = String(html).split(/<tr\b[^>]*id="[^"]*gridConsulta_DXDataRow\d+"[^>]*>/i).slice(1);
  partes.forEach(function (p) {
    const fim = p.search(/<\/tr>/i);
    const linha = fim >= 0 ? p.slice(0, fim) : p;
    const celulas = linha.split(/<td\b[^>]*>/i).slice(1).map(texto);
    if (celulas.length >= 4 && /^[A-Z]{2}-\d{4,7}$/.test(celulas[0])) {
      out.push({ registro: celulas[0], nome: celulas[1], categoria: celulas[2], situacao: celulas[3] });
    }
  });
  return out;
}

export async function consultaCref6(numero, opcoes) {
  const num = numeroCref(numero);
  if (!num) return { ok: false, erro: "numero" };
  const registro = "MG-" + num;
  const busca = (opcoes && opcoes.fetch) || fetch;
  try {
    const sinal = typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined;
    const r1 = await busca(CREF6_URL, { headers: { "user-agent": AGENTE }, signal: sinal });
    if (!r1.ok) return { ok: false, erro: "indisponivel" };
    const pagina = await r1.text();
    const form = campos(pagina);
    if (!form.get("__VIEWSTATE") || !pagina.includes(CAMPO)) return { ok: false, erro: "indisponivel" };
    const biscoitos = (typeof r1.headers.getSetCookie === "function" ? r1.headers.getSetCookie() : [r1.headers.get("set-cookie") || ""])
      .map(function (c) { return String(c).split(";")[0]; }).filter(Boolean).join("; ");
    form.set(CAMPO, num);
    form.set(BOTAO, "Pesquisar");
    const r2 = await busca(CREF6_URL, {
      method: "POST",
      headers: { "user-agent": AGENTE, "content-type": "application/x-www-form-urlencoded", cookie: biscoitos, referer: CREF6_URL },
      body: form.toString(),
      signal: sinal,
    });
    if (!r2.ok) return { ok: false, erro: "indisponivel" };
    const resposta = await r2.text();
    // A página pesquisa por "contém": fica só o registro exato
    const achou = linhasCref6(resposta).filter(function (l) { return l.registro === registro; })[0];
    if (achou) {
      return { ok: true, encontrado: true, registro: achou.registro, nome: achou.nome, categoria: achou.categoria, situacao: achou.situacao, ativo: /^ATIVO$/i.test(achou.situacao) };
    }
    // Só afirma "não existe" quando a página respondeu do jeito esperado
    if (/n(ã|&#227;)o constam em nossa base/i.test(resposta) || /gridConsulta/.test(resposta)) return { ok: true, encontrado: false, registro: registro };
    return { ok: false, erro: "indisponivel" };
  } catch (e) {
    return { ok: false, erro: "indisponivel" };
  }
}
