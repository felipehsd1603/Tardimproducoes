// Propostas e contratos: somas dos itens, andamento (etapas), modelo do contrato e as janelas de impressão
// (proposta e contrato em PDF). Mesmas regras e textos do painel antigo (js/admin.js).
import { api } from "./api.ts";
import { aviso, falha, muda, pega } from "./loja.tsx";
import type { ConfigContrato, DadosProposta, Etapa, Item, ItemMinutario, Proposta } from "./tipos.ts";
import { curta, escHtml, extenso, hojeIso, linhas, numBR, qtdTxt, quando, reais, site } from "./util.ts";

// dados.etapa: rascunho → enviada → aprovada (ou recusada) → contrato → assinado
// dados.marcos: data de cada etapa · dados.contrato: número, empresa, contratante, pagamento...
export const ORDEM_ETAPA: Record<Etapa, number> = { rascunho: 0, enviada: 1, aprovada: 2, recusada: 2, contrato: 3, assinado: 4 };
export const SIT_ETAPA: Record<Etapa, [string, string]> = {
  rascunho: ["Em montagem", "is-rasc"], enviada: ["Enviada ao cliente", "is-env"], aprovada: ["Aprovada", "is-pub"],
  recusada: ["Recusada", "is-nao"], contrato: ["Contrato para assinar", "is-env"], assinado: ["Contrato assinado", "is-ok"],
};
export const PASSOS = ["Montar a proposta", "Enviar ao cliente", "Resposta do cliente", "Gerar o contrato", "Assinatura"];
export function etapaDe(x: Proposta | null | undefined): Etapa { const e = ((x && x.dados) || {}).etapa; return e && ORDEM_ETAPA[e] != null ? e : "rascunho"; }

export interface Soma { cats: { nome: string; itens: Item[]; total: number }[]; total: number }
export function somaItens(itens: Item[]): Soma {
  const cats: Soma["cats"] = [];
  let total = 0;
  itens.forEach((i) => {
    let c = cats.filter((x) => x.nome === i.cat)[0];
    if (!c) { c = { nome: i.cat, itens: [], total: 0 }; cats.push(c); }
    const t = Math.round(i.qtd * i.unit * 100) / 100;
    c.itens.push(i); c.total = Math.round((c.total + t) * 100) / 100; total += t;
  });
  return { cats, total: Math.round(total * 100) / 100 };
}
// Texto dos itens (uma linha: categoria | descrição | quantidade | valor unitário [| variável]) -> lista + linhas que não entendi
// "variável" no fim = a quantidade acompanha o nº de participantes (kit, medalha, água); só o simulador interno usa
export function itensDe(texto: string): { itens: Item[]; erros: number[] } {
  const itens: Item[] = [], erros: number[] = [];
  let cat = "";
  linhas(texto).forEach((l, n) => {
    const p = l.split("|").map((x) => x.trim());
    const pp = p.length > 3 && /^vari[aá]ve(l|is)$/i.test(p[p.length - 1]);
    if (pp) p.pop();
    if (p.length === 3) p.unshift(cat);
    if (p.length !== 4 || !p[1]) { erros.push(n + 1); return; }
    cat = p[0] || cat || "Itens";
    const qtd = numBR(p[2]), unit = numBR(p[3]);
    if (!(qtd > 0) || !/\d/.test(p[3])) { erros.push(n + 1); return; }
    const it: Item = { cat, desc: p[1], qtd, unit };
    if (pp) it.pp = true;
    itens.push(it);
  });
  return { itens, erros };
}
export const textoDosItens = (itens: Item[]) => itens.map((i) => [i.cat, i.desc, qtdTxt(i.qtd), reais(i.unit)].concat(i.pp ? ["variável"] : []).join(" | ")).join("\n");

// Valor do evento para n participantes: itens "variáveis" crescem na proporção (arredondando para cima); os demais ficam fixos
export function valorParaParticipantes(itens: Item[], base: number, n: number): number {
  return Math.round(itens.reduce((t, i) => t + (i.pp && base ? Math.ceil(i.qtd * n / base) : i.qtd) * i.unit, 0) * 100) / 100;
}
export const numerosDe = (txt: string) => String(txt || "").split(/[;,\s]+/).map((x) => parseInt(x.replace(/\D/g, ""), 10) || 0).filter((x) => x > 0);
// Faixas do Anexo II: as do simulador da proposta, mais o número da própria proposta
export function faixasDe(d: DadosProposta): number[] {
  const base = Number((d.evento || {}).participantes) || 0;
  const l = numerosDe((d.sim || {}).faixas || "");
  if (base && l.indexOf(base) < 0) l.push(base);
  return l.filter((x, i) => l.indexOf(x) === i).sort((a, b) => a - b).slice(0, 20);
}

// ---------- Minutário (itens padrão) e configuração do contrato ----------
export function carregaMinutario(): Promise<ItemMinutario[]> {
  const m = pega().minutario;
  if (m) return Promise.resolve(m);
  return api<ItemMinutario[]>("GET", "minutario").then((d) => { muda({ minutario: d }); return d; });
}
export const chaveItem = (desc: string) => String(desc || "").replace(/\s+/g, " ").trim().toLowerCase();
// Nome curto do item para as listas: o começo da descrição, até o primeiro corte natural
export function tituloItem(desc: string): string {
  const t = String(desc || "").trim();
  let c = t.split(/ - |\. |, | \(|: /)[0];
  if (c.length < 14) c = t;
  return c.length > 72 ? c.slice(0, 70).replace(/\s+\S*$/, "") + "…" : c;
}
export function carregaConfig(): Promise<ConfigContrato> {
  const c = pega().config;
  if (c) return Promise.resolve(c);
  return api<ConfigContrato>("GET", "config/contrato").then((r) => { const cfg = r || {}; muda({ config: cfg }); return cfg; });
}

// ---------- andamento ----------
// Grava o "dados" da proposta (e, se vier, o nome do cliente da lista); o servidor mantém o resto
export function salvaDados(x: Proposta, mudancas: Partial<DadosProposta>, topo?: Partial<Proposta>): Promise<Proposta> {
  const corpoPut = Object.assign({ dados: Object.assign({}, x.dados || {}, mudancas) }, topo || {});
  return api<Proposta>("PUT", "propostas/" + encodeURIComponent(x.id), corpoPut).then((s) => {
    muda((e) => ({ propostas: (e.propostas || []).map((y) => (y.id === s.id ? s : y)) }));
    return s;
  });
}
export function marcaEtapa(x: Proposta, etapa: Etapa, data?: string | null, extra?: Partial<DadosProposta>, topo?: Partial<Proposta>): Promise<Proposta> {
  const marcos = Object.assign({}, (x.dados || {}).marcos);
  marcos[etapa] = data || hojeIso();
  return salvaDados(x, Object.assign({ etapa, marcos }, extra || {}), topo);
}
export function voltaEtapa(x: Proposta, para: Etapa, extra?: Partial<DadosProposta>): Promise<Proposta> {
  const marcos = Object.assign({}, (x.dados || {}).marcos);
  (Object.keys(ORDEM_ETAPA) as Etapa[]).forEach((e) => { if (ORDEM_ETAPA[e] > ORDEM_ETAPA[para]) delete marcos[e]; });
  return salvaDados(x, Object.assign({ etapa: para, marcos }, extra || {}));
}
// Próximo número de contrato do ano: maior "NN/AAAA" já usado + 1
export function proximoContrato(): string {
  const ano = String(new Date().getFullYear());
  let maior = 0;
  (pega().propostas || []).forEach((p) => {
    const m = /^\s*(\d+)\s*\/\s*(\d{4})/.exec(String((((p.dados || {}).contrato) || {}).numero || ""));
    if (m && m[2] === ano) maior = Math.max(maior, Number(m[1]));
  });
  return (maior + 1) + "/" + ano;
}

export const PAGAMENTOS: [string, string][] = [
  ["50% na assinatura e 50% após o evento", "O CONTRATANTE pagará 50% (cinquenta por cento) do valor global em até 5 (cinco) dias úteis após a assinatura deste contrato e os 50% (cinquenta por cento) restantes em até 5 (cinco) dias úteis após a realização do evento."],
  ["Tudo após o evento", "O CONTRATANTE pagará o valor global em até 5 (cinco) dias úteis após a realização do evento."],
  ["Inscrições e patrocínios", "O valor global será custeado pela arrecadação das inscrições e pelos patrocínios do evento, recebidos pela CONTRATADA. Ao final do evento, a CONTRATADA apresentará o fechamento financeiro emitido pela plataforma de inscrições e o relatório das inscrições feitas fora dela (equipes, grupos, patrocinadores e cortesias), e o CONTRATANTE pagará, em até 5 (cinco) dias úteis, a diferença entre o valor global e o total arrecadado, se houver."],
];

// Modelo padrão do contrato. Linhas com CLÁUSULA viram título e são numeradas sozinhas;
// [SE ANEXO II] e [SE CONDIÇÕES] só entram quando o contrato tem o anexo ou as condições.
export const MODELO_CONTRATO = [
  "CLÁUSULA – DO OBJETO",
  "O presente contrato tem por objeto a prestação, pela CONTRATADA, de serviços de produção, organização e execução do evento {{EVENTO}}, a ser realizado em {{DATA_EVENTO}}, em {{LOCAL}}, para até {{PARTICIPANTES}} participantes, compreendendo o planejamento, a estrutura, os materiais, a mão de obra e o apoio logístico descritos no Anexo I, que faz parte deste contrato.",
  "CLÁUSULA – DO REGIME DE EXECUÇÃO",
  "Os serviços serão executados em regime de empreitada por preço global, conforme as especificações e as quantidades do Anexo I.",
  "CLÁUSULA – DAS OBRIGAÇÕES DA CONTRATADA",
  "São obrigações da CONTRATADA:",
  "a) executar os serviços descritos no Anexo I com qualidade, nos prazos combinados e de acordo com as normas técnicas e de segurança aplicáveis;",
  "b) providenciar as autorizações, licenças e alvarás necessários à realização do evento, quando previstos no Anexo I;",
  "c) manter equipe qualificada e identificada durante a montagem, a realização e a desmontagem do evento, respondendo pelos encargos trabalhistas, previdenciários e fiscais do seu pessoal;",
  "d) informar ao CONTRATANTE, por escrito, qualquer fato que possa comprometer a realização do evento;",
  "e) apresentar, em até 5 (cinco) dias úteis após o evento, relatório com o número de inscritos e de participantes.",
  "CLÁUSULA – DAS OBRIGAÇÕES DO CONTRATANTE",
  "São obrigações do CONTRATANTE:",
  "a) fornecer à CONTRATADA as informações, a marca e os materiais de sua responsabilidade necessários à execução dos serviços;",
  "b) aprovar, em até 5 (cinco) dias úteis, as artes, o regulamento e o percurso apresentados pela CONTRATADA;",
  "c) efetuar os pagamentos nas condições deste contrato;",
  "d) indicar um responsável para acompanhar a execução do contrato.",
  "CLÁUSULA – DO PREÇO",
  "Pelos serviços objeto deste contrato, o CONTRATANTE pagará à CONTRATADA o valor global de {{VALOR}}, já incluídos todos os custos, materiais, mão de obra, transportes, tributos e encargos necessários à execução dos serviços descritos no Anexo I.",
  "[SE ANEXO II] Se o número de participantes for diferente do previsto, o valor global será ajustado conforme a tabela do Anexo II, aplicando-se regra de três simples para as quantidades entre as faixas.",
  "CLÁUSULA – DO PAGAMENTO",
  "{{PAGAMENTO}}",
  "O pagamento será feito mediante nota fiscal emitida pela CONTRATADA, por transferência ou boleto bancário, em conta de titularidade da CONTRATADA. O atraso sujeitará o valor devido a multa de 2% (dois por cento) e juros de 1% (um por cento) ao mês, calculados pro rata die.",
  "CLÁUSULA – DO ADIAMENTO E DO CANCELAMENTO",
  "Se o evento for adiado ou cancelado por caso fortuito ou força maior, como condições climáticas que coloquem os participantes em risco ou determinação de autoridade pública, as partes combinarão nova data, mantidos os valores deste contrato. Não sendo possível nova data, o CONTRATANTE pagará os custos já comprovadamente realizados pela CONTRATADA até o cancelamento.",
  "Se o CONTRATANTE cancelar o evento por iniciativa própria, sem justo motivo, pagará os custos comprovadamente realizados pela CONTRATADA, acrescidos de multa de 10% (dez por cento) do valor global.",
  "CLÁUSULA – DA RESCISÃO",
  "O descumprimento de qualquer cláusula deste contrato permite à parte prejudicada rescindi-lo, mediante notificação por escrito, sem prejuízo da reparação das perdas e danos comprovados. A parte que der causa à rescisão pagará à outra multa de 10% (dez por cento) do valor global, sem prejuízo do pagamento dos serviços já executados.",
  "CLÁUSULA – DA VIGÊNCIA",
  "Este contrato vigora por {{VIGENCIA}}, contados da data de sua assinatura, podendo ser prorrogado por termo aditivo.",
  "CLÁUSULA – DA PROTEÇÃO DE DADOS PESSOAIS",
  "As partes tratarão os dados pessoais dos participantes do evento somente para a execução deste contrato, em conformidade com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais), adotando medidas de segurança para protegê-los e não os compartilhando para outra finalidade.",
  "[SE CONDIÇÕES] CLÁUSULA – DAS CONDIÇÕES ESPECÍFICAS",
  "[SE CONDIÇÕES] {{CONDICOES}}",
  "CLÁUSULA – DAS DISPOSIÇÕES GERAIS",
  "As alterações deste contrato só valerão se feitas por termo aditivo assinado pelas partes. A tolerância de uma parte quanto ao descumprimento de qualquer obrigação não significa renúncia ao direito de exigi-la.",
  "As partes reconhecem a validade da assinatura eletrônica deste contrato, nos termos da Medida Provisória nº 2.200-2/2001 e da Lei nº 14.063/2020.",
  "CLÁUSULA – DO FORO",
  "Fica eleito o foro da comarca de {{FORO}} para resolver as questões oriundas deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja.",
  "E, por estarem de acordo, as partes assinam este contrato eletronicamente.",
].join("\n");

// ---------- documentos para imprimir (proposta e contrato) ----------
// Tabela de itens com subtotais por categoria e total geral (proposta e Anexo I do contrato)
function htmlItens(s: Soma): string {
  const h = escHtml;
  let n = 0;
  const corpoTab = s.cats.map((c) => '<tr class="cat"><th colspan="5">' + h(c.nome) + "</th></tr>" + c.itens.map((i) => {
    n++;
    return "<tr><td>" + n + "</td><td>" + h(i.desc) + '</td><td class="n">' + qtdTxt(i.qtd) + '</td><td class="n">' + reais(i.unit) + '</td><td class="n">' + reais(Math.round(i.qtd * i.unit * 100) / 100) + "</td></tr>";
  }).join("") + '<tr class="sub"><td colspan="4">Total de ' + h(c.nome) + '</td><td class="n">' + reais(c.total) + "</td></tr>").join("");
  return '<table><thead><tr><th>Item</th><th>Descrição</th><th class="n">Qtd.</th><th class="n">Valor unitário</th><th class="n">Valor total</th></tr></thead><tbody>' + corpoTab + "</tbody></table>" +
    '<div class="total"><span>Total geral</span><span>' + reais(s.total) + '</span></div><p class="ext">' + h(extenso(s.total)) + "</p>";
}
const CSS_DOC = "body{font:13px/1.45 Arial,Helvetica,sans-serif;color:#1c2233;margin:28px}h1{font-size:19px;margin:0 0 2px;color:#24325a}h2{font-size:14px;margin:18px 0 6px;color:#24325a}" +
  "table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #c9cdd6;padding:5px 7px;vertical-align:top;text-align:left}" +
  "thead th{background:#24325a;color:#fff}.cat th{background:#eef0f5}.sub td{font-weight:bold;background:#fafafa}.n{text-align:right;white-space:nowrap}" +
  ".total{margin-top:12px;padding:10px 12px;border:2px solid #24325a;display:flex;justify-content:space-between;font-size:16px;font-weight:bold}" +
  ".ext{margin:4px 0 0;color:#5b6275}tr{break-inside:avoid}@media print{body{margin:0}.nao{display:none}}";

function ordinal(n: number): string {
  const U = ["PRIMEIRA", "SEGUNDA", "TERCEIRA", "QUARTA", "QUINTA", "SEXTA", "SÉTIMA", "OITAVA", "NONA"];
  if (n < 10) return U[n - 1];
  const dez = Math.floor(n / 10), un = n % 10, D = ["", "DÉCIMA", "VIGÉSIMA", "TRIGÉSIMA"][dez] || String(n);
  return un ? D + " " + U[un - 1] : D;
}

export function htmlContrato(x: Proposta, cfg: ConfigContrato): string {
  const d = x.dados || {}, ev = d.evento || {}, ct = d.contrato || {}, ctt = ct.contratante || {}, emp = ct.empresa || {};
  const s = somaItens(d.itens || []), h = escHtml;
  const foro = cfg.foro || "Belo Horizonte/MG", cidade = foro.split(/[/,]/)[0].trim();
  const meses = Number(ct.vigencia) || 12;
  const docTipo = (doc: string) => (String(doc || "").replace(/\D/g, "").length === 11 ? "CPF" : "CNPJ");
  const parte = (nome?: string, doc?: string, endereco?: string, rep?: string, cargo?: string, cpf?: string, rg?: string, papel?: string, fem?: boolean) => {
    let t = "<b>" + h(String(nome || "").toUpperCase()) + "</b>";
    if (doc) t += ", inscrit" + (fem ? "a" : "o") + " no " + docTipo(doc) + " sob o nº " + h(doc);
    if (endereco) t += ", com sede em " + h(endereco);
    if (rep) {
      t += ", neste ato representad" + (fem ? "a" : "o") + " por " + h(rep) + (cargo ? ", " + h(cargo) : "");
      if (rg) t += ", portador(a) da carteira de identidade nº " + h(rg);
      if (cpf) t += (rg ? " e" : ",") + " inscrito(a) no CPF sob o nº " + h(cpf);
    }
    return t + ", doravante denominad" + (fem ? "a" : "o") + " <b>" + papel + "</b>";
  };
  const campos: Record<string, string> = {
    CONTRATANTE: ctt.nome || "", CONTRATADA: emp.razao || "", EVENTO: ev.nome || x.evento || "", NUMERO: ct.numero || "",
    DATA_EVENTO: ev.data ? quando(ev.data) : "data a definir", LOCAL: ev.local || "local a definir",
    PARTICIPANTES: ev.participantes ? Number(ev.participantes).toLocaleString("pt-BR") : "—",
    VALOR: reais(s.total) + " (" + extenso(s.total) + ")", PAGAMENTO: ct.pagamento || "", FORO: foro,
    VIGENCIA: meses + " (" + extenso(meses).replace(/ rea(l|is)$/, "") + ") " + (meses === 1 ? "mês" : "meses"), CONDICOES: ct.condicoes || "",
  };
  let n = 0;
  const clausulas = String((cfg.modelo && cfg.modelo.trim()) ? cfg.modelo : MODELO_CONTRATO).split(/\r?\n/).map((l0) => {
    let l = l0.trim();
    if (/^\[SE ANEXO II\]/i.test(l)) { if (!ct.anexo2) return ""; l = l.replace(/^\[SE ANEXO II\]\s*/i, ""); }
    if (/^\[SE CONDI[CÇ][OÕ]ES\]/i.test(l)) { if (!ct.condicoes) return ""; l = l.replace(/^\[SE CONDI[CÇ][OÕ]ES\]\s*/i, ""); }
    if (!l) return "";
    if (/^CL[AÁ]USULA\b/i.test(l)) {
      n++;
      const resto = l.replace(/^CL[AÁ]USULA\s*/i, "").replace(/^(–|-|—)\s*/, "");
      return "<h3>CLÁUSULA " + ordinal(n) + (resto ? " – " + h(resto) : "") + "</h3>";
    }
    const texto = l.replace(/\{\{\s*([A-Z_]+)\s*\}\}/g, (m, k) => (k in campos ? campos[k] : m));
    return texto.split(/\r?\n/).filter((t) => t.trim()).map((t) => "<p" + (/^[a-z]\)\s/.test(t.trim()) ? ' class="al"' : "") + ">" + h(t.trim()) + "</p>").join("");
  }).join("");
  const assina = (nome?: string, rep?: string, cargo?: string, papel?: string) =>
    '<div><span class="linha"></span><b>' + h(String(nome || "").toUpperCase()) + "</b><br>" + h(rep || "") + (cargo ? "<br>" + h(cargo) : "") + "<br><small>" + papel + "</small></div>";
  const fecho = '<p class="local">' + h(cidade) + ", data da última assinatura eletrônica.</p>" +
    '<div class="assinaturas">' + assina(ctt.nome, ctt.rep_nome, ctt.rep_cargo, "CONTRATANTE") + assina(emp.razao, emp.rep_nome, emp.rep_cargo, "CONTRATADA") + "</div>";
  const ref = "<p class=\"ref\">Contrato nº " + h(ct.numero) + " · " + h(campos.EVENTO) + " · " + h(campos.PARTICIPANTES) + " participantes</p>";
  let anexo2 = "";
  if (ct.anexo2) {
    const base = Number(ev.participantes) || 0;
    anexo2 = '<section class="anexo"><h2>ANEXO II – VALOR DO EVENTO POR NÚMERO DE PARTICIPANTES</h2>' + ref +
      '<table><thead><tr><th>Participantes</th><th class="n">Valor do evento</th></tr></thead><tbody>' +
      faixasDe(d).map((k) => "<tr><td>" + k.toLocaleString("pt-BR") + (k === base ? " (previsto neste contrato)" : "") + '</td><td class="n">' + reais(valorParaParticipantes(d.itens || [], base, k)) + "</td></tr>").join("") +
      "</tbody></table><p>Para quantidades entre as faixas, aplica-se regra de três simples entre os valores das faixas vizinhas.</p>" + fecho + "</section>";
  }
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Contrato ' + h(ct.numero) + " · " + h(ctt.nome) + "</title><style>" + CSS_DOC +
    "h1{text-align:center;font-size:17px;margin:0 0 8px}.ementa{margin:0 0 18px 40%;text-align:justify;font-size:12px;color:#3b4256}" +
    "p{text-align:justify;margin:0 0 8px}.al{padding-left:22px}h3{font-size:13px;margin:16px 0 6px;color:#24325a}.ref{color:#5b6275;text-align:left}" +
    ".local{margin-top:28px}.assinaturas{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:56px;text-align:center;break-inside:avoid}" +
    ".assinaturas .linha{display:block;border-top:1px solid #1c2233;margin-bottom:6px}.anexo{break-before:page;page-break-before:always;padding-top:4px}" +
    "@media screen{body{max-width:860px;margin:28px auto}}" +
    "</style></head><body>" +
    '<p class="nao"><button class="imprimir">Imprimir ou salvar em PDF</button></p>' +
    "<h1>CONTRATO DE PRESTAÇÃO DE SERVIÇOS Nº " + h(ct.numero) + "</h1>" +
    '<p class="ementa">Contrato que entre si celebram ' + h(ctt.nome) + " e " + h(emp.razao) + ", para a produção, a organização e a execução do evento " + h(campos.EVENTO) + ".</p>" +
    "<p>" + parte(ctt.nome, ctt.cnpj, ctt.endereco, ctt.rep_nome, ctt.rep_cargo, ctt.rep_cpf, ctt.rep_rg, "CONTRATANTE", false) + ", e " +
    parte(emp.razao, emp.cnpj, emp.endereco, emp.rep_nome, emp.rep_cargo, emp.rep_cpf, emp.rep_rg, "CONTRATADA", true) +
    ", resolvem celebrar o presente contrato de prestação de serviços, que se regerá pelas cláusulas e condições seguintes:</p>" +
    clausulas + fecho +
    '<section class="anexo"><h2>ANEXO I – PLANILHA DE ITENS E VALORES</h2>' + ref + htmlItens(s) + fecho + "</section>" + anexo2 +
    "</body></html>";
}

// Botão "Imprimir" das janelas de contrato e proposta: listener em vez de onclick (o CSP do site bloqueia
// código inline, e a janela aberta daqui herda o CSP)
function botaoImprimir(w: Window): void {
  const b = w.document.querySelector(".imprimir");
  if (b) b.addEventListener("click", () => w.print());
}

// Abre o contrato numa janela para imprimir ou salvar em PDF. "w" = janela já aberta no clique (evita o bloqueio do navegador)
export function imprimeContrato(x: Proposta, w?: Window | null): void {
  w = w || window.open("", "_blank");
  if (!w) return aviso("O navegador bloqueou a janela do contrato. Libere as janelas deste site e tente de novo.", true);
  const janela = w;
  janela.document.write('<p style="font:16px Arial,sans-serif;margin:32px">Gerando o contrato...</p>');
  janela.document.close();
  carregaConfig().then((cfg) => {
    janela.document.open();
    janela.document.write(htmlContrato(x, cfg));
    janela.document.close();
    botaoImprimir(janela);
  }).catch((e) => { janela.close(); falha(e); });
}

export function imprimeProposta(x: Proposta): void {
  const d = x.dados || {}, cl = d.cliente || {}, ev = d.evento || {}, s = somaItens(d.itens || []);
  const h = escHtml;
  const dl = (pares: [string, string | undefined][]) => pares.filter((p) => p[1]).map((p) => "<dt>" + p[0] + "</dt><dd>" + h(p[1]) + "</dd>").join("");
  const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Proposta ' + h(x.numero) + " · " + h(x.cliente) + "</title><style>" + CSS_DOC +
    ".top{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #d6505b;padding-bottom:10px}.top p{margin:0;color:#5b6275}" +
    "dl{display:grid;grid-template-columns:150px 1fr;gap:2px 12px;margin:0}dt{font-weight:bold}dd{margin:0}" +
    ".ass{margin-top:56px;width:300px;border-top:1px solid #1c2233;padding-top:4px}</style></head><body>" +
    '<p class="nao"><button class="imprimir">Imprimir ou salvar em PDF</button></p>' +
    '<div class="top"><div><h1>' + h(site.razaoSocial || "Tardim Produções") + "</h1><p>" + h([site.cnpj ? "CNPJ " + site.cnpj : "", d.emitente].filter(Boolean).join(" · ")) + "</p></div>" +
    "<div><h1>Proposta comercial" + (x.numero ? " nº " + h(x.numero) : "") + "</h1><p>" + h([d.data ? "Emitida em " + curta(d.data) : "", d.validade ? "válida até " + curta(d.validade) : ""].filter(Boolean).join(" · ")) + "</p></div></div>" +
    "<h2>Cliente</h2><dl>" + dl([["Nome", cl.nome], ["CNPJ/CPF", cl.cnpj], ["Endereço", cl.endereco], ["Representante", cl.representante]]) + "</dl>" +
    "<h2>Evento</h2><dl>" + dl([["Evento", ev.nome], ["Data", ev.data ? quando(ev.data) : ""], ["Local", ev.local], ["Participantes", ev.participantes ? Number(ev.participantes).toLocaleString("pt-BR") : ""]]) + "</dl>" +
    htmlItens(s) +
    (d.obs ? "<h2>Observações</h2><ol>" + linhas(d.obs).map((o) => "<li>" + h(o) + "</li>").join("") + "</ol>" : "") +
    '<p style="margin-top:24px">' + h((site.cidade || "Belo Horizonte, MG").split(",")[0]) + (d.data ? ", " + quando(d.data) : "") + '.</p><div class="ass">' + h(site.razaoSocial || "Tardim Produções") + "</div></body></html>";
  const w = window.open("", "_blank");
  if (!w) return aviso("O navegador bloqueou a janela da proposta. Libere as janelas deste site e tente de novo.", true);
  w.document.write(html);
  w.document.close();
  botaoImprimir(w);
}
