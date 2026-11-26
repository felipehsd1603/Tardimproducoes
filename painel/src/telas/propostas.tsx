// Aba Propostas: lista, formulário da proposta (itens do minutário em tabela, somas, simulador interno),
// minutário (itens padrão) e "Empresa e modelo do contrato". O andamento fica em andamento.tsx.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../api.ts";
import { abreDialogo, aviso, cancelar, falha, ir, marcaSujo, muda, pega, usaEstado, voltarPara } from "../loja.tsx";
import { Acoes, BarraForm, Botao, Campo, Card, Form, Marcador, Secao, Situacao, Tabela, Trilha, pergunta, useCampos } from "../ui.tsx";
import { enc, extenso, hojeIso, numBR, qtdTxt, reais, site } from "../util.ts";
import {
  carregaConfig, carregaMinutario, chaveItem, etapaDe, itensDe, MODELO_CONTRATO, numerosDe, SIT_ETAPA, somaItens, textoDosItens,
  tituloItem, valorParaParticipantes,
} from "../proposta.ts";
import type { ConfigContrato, DadosProposta, Empresa, Item, ItemMinutario, Proposta } from "../tipos.ts";

// Célula "nome curto + começo do resto"; a descrição inteira aparece ao passar o mouse
export function CelulaItem({ desc }: { desc: string }) {
  const t = tituloItem(desc);
  const resto = String(desc || "").trim().slice(t.replace(/…$/, "").length).replace(/^[\s.,:(-]+/, "");
  return <div className="proposta-itens__desc" title={desc || ""}><strong>{t}</strong>{resto ? <small>{resto}</small> : null}</div>;
}

// ---------- caixas de diálogo: item (proposta ou minutário) e escolha no minutário ----------
function DialogoItem({ titulo, it, cats, fecha }: { titulo: string; it: Partial<Item>; cats: string[]; fecha: (v: Item | null) => void }) {
  const [cat, setCat] = useState(it.cat || "");
  const [desc, setDesc] = useState(it.desc || "");
  const [qtd, setQtd] = useState(it.qtd ? qtdTxt(it.qtd) : "1");
  const [unit, setUnit] = useState(it.unit ? reais(it.unit) : "");
  const [pp, setPp] = useState(!!it.pp);
  const [erro, setErro] = useState("");
  const lista = useRef("cats-" + Date.now()).current;
  return (
    <form noValidate onSubmit={(e) => e.preventDefault()}>
      <h2>{titulo}</h2>
      <Campo rotulo="Categoria"><input type="text" maxLength={80} placeholder="Ex.: Estrutura do evento" list={lista} value={cat} onChange={(e) => setCat(e.target.value)} data-foco={it.desc ? undefined : true} /></Campo>
      <datalist id={lista}>{cats.map((c) => <option key={c} value={c} />)}</datalist>
      <Campo rotulo="Descrição completa (sai na proposta)"><textarea rows={6} maxLength={2000} value={desc} onChange={(e) => setDesc(e.target.value)} /></Campo>
      <div className="painel-dialogo__dupla">
        <Campo rotulo="Quantidade"><input type="text" inputMode="decimal" value={qtd} onChange={(e) => setQtd(e.target.value)} data-foco={it.desc ? true : undefined} /></Campo>
        <Campo rotulo="Valor unitário"><input type="text" inputMode="decimal" placeholder="R$ 0,00" value={unit} onChange={(e) => setUnit(e.target.value)} /></Campo>
      </div>
      <Marcador texto="Variável: a quantidade acompanha o número de participantes (kit, medalha, hidratação)" checked={pp} onChange={setPp} />
      <p className="assess-alerta" hidden={!erro}>{erro}</p>
      <div className="painel-dialogo__acoes">
        <button type="button" className="btn btn--line" onClick={() => fecha(null)}>Cancelar</button>
        <button type="button" className="btn btn--red" onClick={() => {
          const q = numBR(qtd), texto = desc.replace(/\s*\r?\n\s*/g, " ").replace(/\|/g, "/").trim();
          const msg = !texto ? "Escreva a descrição do item." : (!(q > 0) ? "A quantidade precisa ser maior que zero." : "");
          if (msg) { setErro(msg); return; }
          fecha({ cat: cat.replace(/\|/g, "/").trim() || "Itens", desc: texto, qtd: q, unit: numBR(unit), pp });
        }}>Salvar item</button>
      </div>
    </form>
  );
}
/** Formulário de um item (proposta ou minutário). Devolve { cat, desc, qtd, unit, pp } ou null se cancelar. */
export const dialogoItem = (titulo: string, it: Partial<Item> | null, cats: string[]) =>
  abreDialogo<Item | null>(null, (fecha) => <DialogoItem titulo={titulo} it={it || {}} cats={cats} fecha={fecha} />, "painel-dialogo painel-dialogo--largo");

function EscolheMinutario({ min, fecha }: { min: ItemMinutario[]; fecha: (v: ItemMinutario[]) => void }) {
  const [busca, setBusca] = useState("");
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});
  const n = Object.keys(marcados).filter((k) => marcados[k]).length;
  const q = chaveItem(busca);
  const itens: ReactNode[] = [];
  let cat: string | null = null, achou = 0;
  min.forEach((m) => {
    if (q && chaveItem(m.categoria + " " + m.descricao).indexOf(q) < 0) return;
    achou++;
    if (m.categoria !== cat) { cat = m.categoria; itens.push(<h3 key={"c" + m.id}>{cat || "Itens"}</h3>); }
    itens.push(
      <label className="minutario-lista__item" key={m.id}>
        <input type="checkbox" checked={!!marcados[m.id]} onChange={(e) => setMarcados((x) => ({ ...x, [m.id]: e.target.checked }))} />
        <CelulaItem desc={m.descricao} />
        <span className="minutario-lista__valor">{reais((m.dados || {}).unit)}</span>
      </label>,
    );
  });
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <h2>Adicionar do minutário</h2>
      <input type="search" placeholder="Buscar: tenda, staff, medalha..." aria-label="Buscar no minutário" value={busca} onChange={(e) => setBusca(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} data-foco />
      <div className="minutario-lista">
        {itens}
        {!achou ? <p className="muted">{min.length ? "Nenhum item com esse texto." : "O minutário ainda está vazio. Abra uma proposta pronta e use \"Guardar estes itens no minutário\"."}</p> : null}
      </div>
      <div className="painel-dialogo__acoes">
        <button type="button" className="btn btn--line" onClick={() => fecha([])}>Cancelar</button>
        <button type="button" className="btn btn--red" disabled={!n} onClick={() => fecha(min.filter((m) => marcados[m.id]))}>{n ? "Adicionar " + n + (n === 1 ? " item" : " itens") : "Adicionar"}</button>
      </div>
    </form>
  );
}
/** Lista do minutário para marcar o que entra na proposta. Devolve as linhas escolhidas ([] se cancelar). */
const escolheDoMinutario = () => carregaMinutario().then((min) =>
  abreDialogo<ItemMinutario[]>([], (fecha) => <EscolheMinutario min={min} fecha={fecha} />, "painel-dialogo painel-dialogo--largo"));

// ---------- lista ----------
function excluirProposta(x: Proposta) {
  pergunta("Excluir a proposta" + (x.numero ? " nº " + x.numero : "") + " de " + x.cliente + "?", "Ela sai do painel. Um PDF já salvo ou enviado continua existindo.", "Excluir proposta").then((sim) => {
    if (!sim) return;
    api("DELETE", "propostas/" + encodeURIComponent(x.id)).then(() => {
      muda((e) => ({ propostas: (e.propostas || []).filter((y) => y.id !== x.id) }));
      aviso("Proposta excluída.");
    }).catch(falha);
  });
}

export function AbaPropostas() {
  const { propostas } = usaEstado();
  const [erro, setErro] = useState(false);
  useEffect(() => {
    if (!propostas) api<Proposta[]>("GET", "propostas").then((d) => muda({ propostas: d })).catch((e) => { setErro(true); falha(e); });
  }, []);
  return (
    <Card passo="Comercial" titulo="Propostas">
      <p className="muted">Cada proposta vai do orçamento ao contrato assinado em cinco passos: montar, enviar ao cliente, registrar a resposta, gerar o contrato e registrar a assinatura. Abra a proposta para ver o próximo passo.</p>
      <Acoes>
        <Botao cls="btn btn--red" onClick={() => ir("proposta/novo")}>Nova proposta</Botao>
        <Botao onClick={() => ir("minutario")}>Minutário (itens padrão)</Botao>
        <Botao onClick={() => ir("modelo-contrato")}>Empresa e modelo do contrato</Botao>
      </Acoes>
      {erro ? <p className="assess-alerta">Não consegui ler as propostas. Se a tabela ainda não existe no banco: npx wrangler d1 execute tardim --remote --file d1/migracoes/010-propostas.sql</p>
        : !propostas ? <p className="muted">Carregando...</p>
        : !propostas.length ? <p className="muted">Nenhuma proposta ainda. Comece por "Nova proposta".</p>
        : <Tabela cab={["Nº", "Cliente", "Evento", "Total", "Situação", ""]} ids={propostas.map((x) => x.id)} linhas={propostas.map((x) => {
          const d = x.dados || {}, sit = SIT_ETAPA[etapaDe(x)];
          return [x.numero || "—", <strong>{x.cliente}</strong>, x.evento || "", reais(somaItens(d.itens || []).total), <Situacao cls={sit[1]}>{sit[0]}</Situacao>,
            <Acoes>
              <Botao cls="btn btn--line btn--sm" onClick={() => ir("proposta/" + enc(x.id))}>Abrir</Botao>
              <Botao onClick={() => ir("proposta/novo?de=" + enc(x.id))}>Duplicar</Botao>
              <Botao cls="orc__email painel-perigo" onClick={() => excluirProposta(x)}>Excluir</Botao>
            </Acoes>];
        })} />}
    </Card>
  );
}

// ---------- formulário ----------
// Agrupa por categoria, na ordem em que aparecem (a mesma da proposta impressa)
function agrupa(M: Item[]): Item[] {
  const cats: string[] = [];
  M.forEach((i) => { if (cats.indexOf(i.cat) < 0) cats.push(i.cat); });
  return cats.reduce((l: Item[], c) => l.concat(M.filter((i) => i.cat === c)), []);
}
const catsDe = (M: Item[]) => { const l: string[] = []; M.forEach((i) => { if (l.indexOf(i.cat) < 0) l.push(i.cat); }); return l; };
const arred = (x: number) => Math.round(x * 100) / 100;

/** Número editável na tabela: mostra o que foi digitado e formata ao sair do campo */
function CelulaNum({ valor, fmt, aceita, onValor, rotulo }: { valor: number; fmt: (n: number) => string; aceita: (n: number) => boolean; onValor: (n: number) => void; rotulo: string }) {
  const [txt, setTxt] = useState(fmt(valor));
  const foco = useRef(false);
  useEffect(() => { if (!foco.current) setTxt(fmt(valor)); }, [valor]);
  return (
    <input type="text" inputMode="decimal" aria-label={rotulo} value={txt}
      onFocus={() => { foco.current = true; }}
      onBlur={() => { foco.current = false; setTxt(fmt(valor)); }}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
      onChange={(e) => { setTxt(e.target.value); const x = numBR(e.target.value); if (aceita(x)) onValor(x); }} />
  );
}

// item = proposta em edição; modelo = proposta de onde se duplica (leva os itens, não o cliente)
export function FormProposta({ item, modelo }: { item: Proposta | null; modelo: Proposta | null }) {
  const d: DadosProposta = JSON.parse(JSON.stringify((item || modelo || { dados: {} }).dados || {}));
  const cl = d.cliente || {}, ev = d.evento || {}, sm = d.sim || {};
  const { v, liga } = useCampos(() => {
    const maior = (pega().propostas || []).reduce((m, x) => Math.max(m, parseInt(x.numero, 10) || 0), 0);
    return {
      numero: item ? item.numero || "" : (maior ? String(maior + 1) : ""), data: item ? d.data || "" : hojeIso(), validade: item ? d.validade || "" : "",
      emitente: d.emitente || "",
      cNome: modelo ? "" : cl.nome || "", cCnpj: modelo ? "" : cl.cnpj || "", cEnd: modelo ? "" : cl.endereco || "", cRep: modelo ? "" : cl.representante || "",
      eNome: modelo ? "" : ev.nome || "", eData: modelo ? "" : ev.data || "", eLocal: modelo ? "" : ev.local || "", ePart: ev.participantes ? String(ev.participantes) : "",
      obs: d.obs || "",
      sPat: sm.patrocinio ? reais(sm.patrocinio) : "", sIns: sm.inscricao ? reais(sm.inscricao) : "", sImp: sm.imposto == null ? "" : String(sm.imposto), sFx: sm.faixas || "",
    };
  });
  const [texto, setTexto] = useState(() => textoDosItens(d.itens || []));
  const [M, setM] = useState<Item[]>(() => agrupa(itensDe(textoDosItens(d.itens || [])).itens));
  const [salvando, setSalvando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const etapa = item ? etapaDe(item) : "rascunho";

  const r = itensDe(texto), s = somaItens(r.itens);
  const base = parseInt(v.ePart, 10) || 0;
  const onTexto = (t: string) => { setTexto(t); setM(agrupa(itensDe(t).itens)); };
  const grava = (novo: Item[]) => { const g = agrupa(novo); setM(g); setTexto(textoDosItens(g)); marcaSujo(); };
  const mudaItem = (idx: number, p: Partial<Item>) => grava(M.map((x, j) => (j === idx ? { ...x, ...p } : x)));

  function marcarVariaveis() {
    if (!base) return aviso("Informe o número de participantes do evento primeiro.", true);
    let n = 0;
    const t = texto.split(/\r?\n/).map((l) => {
      const x = itensDe(l);
      if (x.itens.length !== 1 || x.itens[0].pp || x.itens[0].qtd < base) return l;
      n++;
      return l.replace(/\s*$/, "") + " | variável";
    }).join("\n");
    onTexto(t);
    marcaSujo();
    aviso(n ? n + (n === 1 ? " item marcado" : " itens marcados") + " como variável. Confira e ajuste à mão o que for preciso." : "Nenhum item novo com quantidade igual ou maior que " + base + ".");
  }

  function guardarNoMinutario() {
    if (!M.length) return aviso("Inclua pelo menos um item primeiro.", true);
    pergunta("Guardar os itens desta proposta no minutário?", "Os itens que ainda não estão lá entram como padrão; os que já estão ficam com o valor e a quantidade desta proposta.", "Guardar no minutário").then((sim) => {
      if (!sim) return;
      setGuardando(true);
      let novos = 0, mudados = 0;
      carregaMinutario().then(() => M.reduce((fila: Promise<unknown>, i) => fila.then(() => {
        const linha = { categoria: i.cat, descricao: i.desc, dados: { unit: i.unit, qtd: i.qtd, pp: !!i.pp, base } };
        const min = pega().minutario || [];
        const ja = min.filter((m) => chaveItem(m.descricao) === chaveItem(i.desc))[0];
        if (!ja) return api<ItemMinutario>("POST", "minutario", linha).then((sv) => { muda((e) => ({ minutario: [...(e.minutario || []), sv] })); novos++; });
        if (JSON.stringify([ja.categoria, ja.dados]) === JSON.stringify([linha.categoria, linha.dados])) return null;
        return api<ItemMinutario>("PUT", "minutario/" + encodeURIComponent(ja.id), linha).then((sv) => { muda((e) => ({ minutario: (e.minutario || []).map((x) => (x.id === sv.id ? sv : x)) })); mudados++; });
      }), Promise.resolve())).then(() => {
        setGuardando(false);
        aviso("Minutário atualizado: " + novos + (novos === 1 ? " item novo" : " itens novos") + " e " + mudados + (mudados === 1 ? " atualizado." : " atualizados."));
      }).catch((e) => { setGuardando(false); muda({ minutario: null }); falha(e); });
    });
  }

  function salvar() {
    if (!v.cNome.trim()) return aviso("Informe o nome do cliente.", true);
    if (r.erros.length) return aviso("Corrija as linhas dos itens que não foram entendidas antes de salvar.", true);
    if (!r.itens.length) return aviso("Inclua pelo menos um item.", true);
    const linha = {
      numero: v.numero.trim(), cliente: v.cNome.trim(), evento: v.eNome.trim(),
      dados: {
        data: v.data, validade: v.validade, emitente: v.emitente.trim(),
        cliente: { nome: v.cNome.trim(), cnpj: v.cCnpj.trim(), endereco: v.cEnd.trim(), representante: v.cRep.trim() },
        evento: { nome: v.eNome.trim(), data: v.eData, local: v.eLocal.trim(), participantes: parseInt(v.ePart, 10) || 0 },
        itens: r.itens, obs: v.obs.trim(),
        sim: { patrocinio: numBR(v.sPat), inscricao: numBR(v.sIns), imposto: v.sImp === "" ? null : Number(v.sImp) || 0, faixas: v.sFx.trim() },
      } as DadosProposta,
    };
    // Editando: o andamento (etapa, datas e dados do contrato) continua o mesmo; duplicando, começa do zero
    if (item) (["etapa", "marcos", "contrato"] as const).forEach((k) => { if (d[k] !== undefined) (linha.dados as Record<string, unknown>)[k] = d[k]; });
    setSalvando(true);
    const q = item ? api<Proposta>("PUT", "propostas/" + encodeURIComponent(item.id), linha) : api<Proposta>("POST", "propostas", linha);
    q.then((salva) => {
      muda((e) => ({ propostas: [salva].concat((e.propostas || []).filter((x) => x.id !== salva.id)) }));
      voltarPara("proposta/" + enc(salva.id));
      aviso("Proposta salva. Total: " + reais(s.total) + ".");
    }).catch((err) => { setSalvando(false); falha(err); });
  }

  // Simulador interno: custo, arrecadação e resultado para outros números de participantes (não sai na proposta)
  let sim: ReactNode;
  if (!base || !r.itens.length) sim = <p className="muted">Informe o número de participantes do evento e os itens para simular.</p>;
  else {
    let faixas = numerosDe(v.sFx);
    if (faixas.indexOf(base) < 0) faixas.unshift(base);
    faixas = faixas.filter((x, i) => faixas.indexOf(x) === i).sort((a, b) => a - b).slice(0, 20);
    const variaveis = r.itens.filter((i) => i.pp).length;
    const pat = numBR(v.sPat), ins = numBR(v.sIns), imp = Math.min(Math.max(Number(v.sImp) || 0, 0), 100);
    sim = <>
      <Tabela cab={["Participantes", "Valor do evento", "Custo por participante", "Arrecadação", "Resultado bruto", "Resultado líquido", "Inscrição de equilíbrio"]} linhas={faixas.map((n) => {
        const c = valorParaParticipantes(r.itens, base, n), arr = pat + ins * n, bruto = arr - c, liq = bruto > 0 ? bruto * (1 - imp / 100) : bruto;
        const eq = (c - pat) / n;
        return [<strong>{n.toLocaleString("pt-BR") + (n === base ? " (proposta)" : "")}</strong>, reais(c), reais(c / n),
          ins ? reais(arr) : "—", <span className={bruto < 0 ? "proposta-sim__neg" : undefined}>{ins ? reais(bruto) : "—"}</span>, ins ? reais(liq) : "—", reais(Math.max(eq, 0))];
      })} />
      <p className="muted">{(variaveis ? variaveis + (variaveis === 1 ? " item variável" : " itens variáveis") + " (quantidade proporcional aos participantes, arredondada para cima); os demais ficam fixos." : "Nenhum item está marcado como variável: o valor do evento fica igual em todas as faixas. Marque com \"| variável\" no fim da linha.") +
        " Arrecadação = patrocínio + inscrição × participantes. Resultado líquido = bruto menos " + String(imp).replace(".", ",") + "% de imposto. Inscrição de equilíbrio = (valor do evento − patrocínio) ÷ participantes."}</p>
    </>;
  }

  // Tabela de itens agrupada por categoria
  const cats = catsDe(M);
  let n = 0;
  const editor = !M.length ? <p className="muted">Nenhum item ainda. Use "Adicionar do minutário" ou "Item avulso".</p> : (
    <div className="painel-tab">
      <table>
        <thead><tr>{["Nº", "Item", "Qtd.", "Valor unitário", "Total", "Variável", ""].map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {cats.map((c) => [
            <tr className="proposta-itens__cat" key={"c:" + c}><th colSpan={7}>{c}</th></tr>,
            ...M.map((i, idx) => ({ i, idx })).filter((x) => x.i.cat === c).map(({ i, idx }) => {
              n++;
              const num = n;
              return (
                <tr key={idx}>
                  <td className="proposta-itens__n">{num}</td>
                  <td><CelulaItem desc={i.desc} /></td>
                  <td className="proposta-itens__q"><CelulaNum valor={i.qtd} fmt={qtdTxt} aceita={(x) => x > 0} onValor={(x) => mudaItem(idx, { qtd: x })} rotulo={"Quantidade do item " + num} /></td>
                  <td className="proposta-itens__u"><CelulaNum valor={i.unit} fmt={reais} aceita={() => true} onValor={(x) => mudaItem(idx, { unit: x })} rotulo={"Valor unitário do item " + num} /></td>
                  <td className="proposta-itens__n">{reais(arred(i.qtd * i.unit))}</td>
                  <td className="proposta-itens__v"><input type="checkbox" checked={!!i.pp} aria-label={"Item " + num + " varia com o número de participantes"} onChange={(e) => mudaItem(idx, { pp: e.target.checked })} /></td>
                  <td>
                    <Acoes>
                      <Botao onClick={() => dialogoItem("Editar item", i, catsDe(M)).then((x) => { if (x) mudaItem(idx, x); })}>Editar</Botao>
                      <Botao cls="orc__email painel-perigo" onClick={() => grava(M.filter((_, j) => j !== idx))}>Remover</Botao>
                    </Acoes>
                  </td>
                </tr>
              );
            }),
          ])}
        </tbody>
      </table>
    </div>
  );

  const titulo = item ? "Editar proposta" : (modelo ? "Duplicar proposta" : "Nova proposta");
  return (
    <>
      <Trilha aba="propostas" atual={titulo} />
      <Card passo={item ? "Editar proposta" : "Nova proposta"} titulo={item ? item.cliente : "Proposta comercial"}>
        {etapa === "assinado" ? <p className="assess-alerta">O contrato desta proposta já foi assinado, então ela não muda mais. Para um acréscimo ou mudança, use "Duplicar" e faça uma proposta de aditivo.</p>
          : etapa === "contrato" ? <p className="assess-alerta">O contrato desta proposta já foi gerado. Se mudar itens ou valores, gere o PDF do contrato de novo no passo 4 antes de mandar assinar.</p> : null}
        <Form onSubmit={salvar}>
          <Campo rotulo="Número da proposta"><input type="text" maxLength={20} {...liga("numero")} /></Campo>
          <Campo rotulo="Data da proposta"><input type="date" {...liga("data")} /></Campo>
          <Campo rotulo="Válida até"><input type="date" {...liga("validade")} /></Campo>
          <Campo rotulo="Responsável e contato (sai no cabeçalho)"><input type="text" maxLength={200} placeholder="Ex.: Nome do responsável · telefone · e-mail" {...liga("emitente")} /></Campo>
          <Secao titulo="Cliente" />
          <Campo rotulo="Nome ou razão social"><input type="text" maxLength={160} required {...liga("cNome")} /></Campo>
          <Campo rotulo="CNPJ ou CPF"><input type="text" maxLength={20} {...liga("cCnpj")} /></Campo>
          <Campo rotulo="Endereço"><input type="text" maxLength={200} {...liga("cEnd")} /></Campo>
          <Campo rotulo="Representante"><input type="text" maxLength={160} placeholder="Nome e cargo de quem assina" {...liga("cRep")} /></Campo>
          <Secao titulo="Evento" />
          <Campo rotulo="Nome do evento"><input type="text" maxLength={200} {...liga("eNome")} /></Campo>
          <Campo rotulo="Data do evento"><input type="date" {...liga("eData")} /></Campo>
          <Campo rotulo="Local"><input type="text" maxLength={200} {...liga("eLocal")} /></Campo>
          <Campo rotulo="Participantes"><input type="number" min={0} step={1} {...liga("ePart")} /></Campo>
          <Secao titulo="Itens" sub="Traga os itens do minutário e ajuste a quantidade e o valor de cada um. O painel calcula o total de cada linha, de cada categoria e o geral." />
          <div className="proposta-itens assess-grid__full">{editor}</div>
          <Acoes className="assess-grid__full">
            <Botao cls="btn btn--line" onClick={() => {
              escolheDoMinutario().then((sel) => {
                if (!sel.length) return;
                const novos = sel.map((m): Item => {
                  const dd = m.dados || {};
                  let q = Number(dd.qtd) || 1;
                  // Item variável: ajusta a quantidade de referência ao número de participantes desta proposta
                  if (dd.pp && (dd.base || 0) > 0 && base > 0) q = Math.ceil(q * base / (dd.base || 1));
                  return { cat: m.categoria || "Itens", desc: m.descricao, qtd: q, unit: Number(dd.unit) || 0, pp: !!dd.pp };
                });
                grava([...M, ...novos]);
                aviso(sel.length + (sel.length === 1 ? " item adicionado." : " itens adicionados.") + " Confira as quantidades.");
              }).catch(falha);
            }}>Adicionar do minutário</Botao>
            <Botao onClick={() => { const cs = catsDe(M); dialogoItem("Item avulso", { cat: cs[cs.length - 1] || "" }, cs).then((x) => { if (x) grava([...M, x]); }); }}>Item avulso</Botao>
            <Botao disabled={guardando} onClick={guardarNoMinutario}>Guardar estes itens no minutário</Botao>
          </Acoes>
          <details className="proposta-texto assess-grid__full">
            <summary>Colar ou editar como texto</summary>
            <Campo rotulo={"Uma linha por item: categoria | descrição | quantidade | valor unitário (com \"| variável\" no fim, se a quantidade acompanha os participantes)"} cheio>
              <textarea rows={16} value={texto} onChange={(e) => onTexto(e.target.value)}
                placeholder={"Estrutura do evento | Pórtico de largada/chegada em Box Truss 6,0m x 4,0m | 1 | R$ 1.000,00\nEstrutura do evento | Tenda 4,0m x 4,0m piramidal | 7 | R$ 380,00\nSonorização | Sonorização do palco com DJ e técnico | 1 | R$ 2.800,00"} />
            </Campo>
          </details>
          <div className="proposta-resumo assess-grid__full" role="status">
            {r.erros.length ? <p className="assess-alerta">{"Não entendi " + (r.erros.length === 1 ? "a linha " : "as linhas ") + r.erros.join(", ") + ". Cada linha precisa de: categoria | descrição | quantidade | valor unitário."}</p> : null}
            {s.cats.length ? <>
              <ul>
                {s.cats.map((x) => <li key={x.nome}><span>{x.nome + " (" + x.itens.length + (x.itens.length === 1 ? " item)" : " itens)")}</span><b>{reais(x.total)}</b></li>)}
                <li className="proposta-resumo__total"><span>Total geral</span><b>{reais(s.total)}</b></li>
              </ul>
              <p className="muted">{extenso(s.total)}</p>
            </> : null}
          </div>
          <Secao titulo="Simulador por participantes" sub={"Uso interno: não aparece na proposta impressa nem no site. Mostra como o valor do evento e o resultado mudam com mais ou menos inscritos. Itens com \"| variável\" no fim da linha (kit, medalha, hidratação) acompanham o número de participantes."} />
          <Campo rotulo="Patrocínios (R$)"><input type="text" placeholder="R$ 0,00" inputMode="decimal" {...liga("sPat")} /></Campo>
          <Campo rotulo="Valor da inscrição (R$)"><input type="text" placeholder="R$ 100,00" inputMode="decimal" {...liga("sIns")} /></Campo>
          <Campo rotulo="Imposto sobre o resultado (%)"><input type="number" min={0} max={100} step={0.5} placeholder="6" {...liga("sImp")} /></Campo>
          <Campo rotulo="Faixas de participantes" dica="Separadas por vírgula."><input type="text" maxLength={200} placeholder="1000, 2000, 3000, 5000" {...liga("sFx")} /></Campo>
          <div className="assess-grid__full"><Botao onClick={marcarVariaveis}>Marcar como variáveis os itens com quantidade igual ou maior que o nº de participantes</Botao></div>
          <div className="proposta-sim assess-grid__full">{sim}</div>
          <Campo rotulo="Observações" cheio><textarea rows={4} maxLength={3000} placeholder="Uma observação por linha: validade, forma de pagamento, o que não está incluso..." {...liga("obs")} /></Campo>
          <BarraForm>
            <button type="submit" className="btn btn--red btn--lg" disabled={salvando || etapa === "assinado"}>Salvar proposta</button>
            <Botao onClick={() => cancelar(item ? "proposta/" + enc(item.id) : "propostas")}>Cancelar</Botao>
          </BarraForm>
        </Form>
      </Card>
    </>
  );
}

// ---------- Minutário: itens padrão das propostas (tabela minutario) ----------
export function TelaMinutario() {
  const { minutario } = usaEstado();
  const [erro, setErro] = useState(false);
  useEffect(() => { carregaMinutario().catch((e) => { setErro(true); falha(e); }); }, []);
  const cats = () => { const l: string[] = []; (pega().minutario || []).forEach((m) => { if (l.indexOf(m.categoria) < 0) l.push(m.categoria); }); return l; };
  const linhaDe = (r: Item, antigo?: ItemMinutario) => {
    const da = (antigo && antigo.dados) || {};
    return { categoria: r.cat, descricao: r.desc, dados: { unit: r.unit, qtd: r.qtd, pp: !!r.pp, base: Number(da.base) || 0 } };
  };
  const ordena = (l: ItemMinutario[]) => l.slice().sort((a, b) => String(a.categoria).localeCompare(String(b.categoria), "pt-BR", { sensitivity: "base" }));
  let lista: ReactNode = null;
  if (minutario) {
    lista = !minutario.length ? <p className="muted">Nenhum item ainda. Cadastre com "Novo item" ou abra uma proposta pronta e use "Guardar estes itens no minutário".</p> : cats().map((cat) => {
      const itens = minutario.filter((m) => m.categoria === cat);
      return (
        <div key={cat}>
          <h3 className="minutario-cat">{(cat || "Itens") + " (" + itens.length + ")"}</h3>
          <Tabela cab={["Item", "Qtd. de referência", "Valor unitário", "Variável", ""]} ids={itens.map((m) => m.id)} linhas={itens.map((m) => {
            const dd = m.dados || {};
            return [<CelulaItem desc={m.descricao} />, qtdTxt(dd.qtd || 1) + (dd.pp && dd.base ? " para " + Number(dd.base).toLocaleString("pt-BR") + " participantes" : ""), reais(dd.unit), dd.pp ? "Sim" : "",
              <Acoes>
                <Botao onClick={() => {
                  dialogoItem("Editar item do minutário", { cat: m.categoria, desc: m.descricao, qtd: dd.qtd || 1, unit: dd.unit, pp: dd.pp }, cats()).then((r) => {
                    if (!r) return;
                    api<ItemMinutario>("PUT", "minutario/" + encodeURIComponent(m.id), linhaDe(r, m)).then((sv) => {
                      muda((e) => ({ minutario: ordena((e.minutario || []).map((x) => (x.id === sv.id ? sv : x))) })); aviso("Item salvo.");
                    }).catch(falha);
                  });
                }}>Editar</Botao>
                <Botao cls="orc__email painel-perigo" onClick={() => {
                  pergunta("Excluir este item do minutário?", tituloItem(m.descricao) + ". As propostas já salvas não mudam.", "Excluir item").then((sim) => {
                    if (!sim) return;
                    api("DELETE", "minutario/" + encodeURIComponent(m.id)).then(() => {
                      muda((e) => ({ minutario: (e.minutario || []).filter((x) => x.id !== m.id) })); aviso("Item excluído.");
                    }).catch(falha);
                  });
                }}>Excluir</Botao>
              </Acoes>];
          })} />
        </div>
      );
    });
  }
  return (
    <>
      <Trilha aba="propostas" atual="Minutário" />
      <Card passo="Comercial" titulo="Minutário">
        <p className="muted">Os itens padrão das propostas, com a descrição completa, o valor unitário e a quantidade de referência. Na proposta, "Adicionar do minutário" traz o item pronto e você só ajusta a quantidade. Mudar um item aqui não altera as propostas já salvas.</p>
        <Acoes>
          <Botao cls="btn btn--red" onClick={() => {
            dialogoItem("Novo item do minutário", null, cats()).then((r) => {
              if (!r) return;
              api<ItemMinutario>("POST", "minutario", linhaDe(r)).then((sv) => { muda((e) => ({ minutario: ordena([...(e.minutario || []), sv]) })); aviso("Item salvo no minutário."); }).catch(falha);
            });
          }}>Novo item</Botao>
          <Botao onClick={() => ir("propostas")}>Voltar para as propostas</Botao>
        </Acoes>
        {erro ? <p className="assess-alerta">Não consegui ler o minutário. Se a tabela ainda não existe no banco: npx wrangler d1 execute tardim --remote --file d1/migracoes/011-minutario.sql</p>
          : !minutario ? <p className="muted">Carregando...</p> : null}
        <div>{lista}</div>
      </Card>
    </>
  );
}

// ---------- Empresa e modelo do contrato (configuracoes.contrato) ----------
const CAMPOS_EMPRESA: [keyof Empresa, string, number, string?, boolean?][] = [
  ["razao", "Razão social", 160], ["cnpj", "CNPJ", 20], ["endereco", "Endereço", 200, "Rua, número, bairro, cidade/UF, CEP", true],
  ["rep_nome", "Quem assina pela empresa", 160], ["rep_cargo", "Cargo", 80, "Ex.: Diretor"], ["rep_cpf", "CPF de quem assina", 20], ["rep_rg", "RG de quem assina", 30],
];
const empresaVazia = (e: Partial<Empresa> = {}): Empresa => ({ razao: e.razao || "", cnpj: e.cnpj || "", endereco: e.endereco || "", rep_nome: e.rep_nome || "", rep_cargo: e.rep_cargo || "", rep_cpf: e.rep_cpf || "", rep_rg: e.rep_rg || "" });

function FormModelo({ cfg }: { cfg: ConfigContrato }) {
  const [empresas, setEmpresas] = useState<(Empresa & { k: number })[]>(() =>
    (cfg.empresas && cfg.empresas.length ? cfg.empresas : [{ razao: site.razaoSocial || "", cnpj: site.cnpj || "" }]).map((e, k) => ({ ...empresaVazia(e), k })));
  const prox = useRef(empresas.length);
  const [foro, setForo] = useState(cfg.foro || "Belo Horizonte/MG");
  const [modelo, setModelo] = useState(cfg.modelo || MODELO_CONTRATO);
  const [salvando, setSalvando] = useState(false);
  function salvar() {
    const lista = empresas.map(({ k: _k, ...e }) => { const o = {} as Empresa; (Object.keys(e) as (keyof Empresa)[]).forEach((c) => { o[c] = String(e[c] || "").trim(); }); return o; }).filter((o) => o.razao);
    if (!lista.length) return aviso("Cadastre pelo menos uma empresa, com a razão social.", true);
    const texto = modelo.replace(/\r/g, "").trim();
    setSalvando(true);
    // Texto igual ao padrão não é guardado: assim as melhorias do modelo padrão chegam sozinhas
    api<ConfigContrato>("PUT", "config/contrato", { empresas: lista, foro: foro.trim() || "Belo Horizonte/MG", modelo: texto === MODELO_CONTRATO ? "" : texto }).then((cfgNova) => {
      muda({ config: cfgNova });
      voltarPara("propostas");
      aviso("Dados do contrato salvos.");
    }).catch((e) => { setSalvando(false); falha(e); });
  }
  return (
    <Form onSubmit={salvar}>
      <Secao titulo="Sua empresa (contratada)" sub="Se a Tardim assina por mais de uma empresa, cadastre todas; em cada contrato você escolhe qual." />
      <div className="assess-grid__full modelo-empresas">
        {empresas.map((e) => (
          <fieldset className="modelo-empresa" key={e.k}>
            <legend>Empresa</legend>
            <div className="assess-grid">
              {CAMPOS_EMPRESA.map(([c, rotulo, max, ph, cheio]) => (
                <Campo key={c} rotulo={rotulo} cheio={cheio}>
                  <input type="text" maxLength={max} placeholder={ph} value={e[c]} onChange={(ev) => setEmpresas(empresas.map((x) => (x.k === e.k ? { ...x, [c]: ev.target.value } : x)))} />
                </Campo>
              ))}
            </div>
            <Acoes><Botao cls="orc__email painel-perigo" onClick={() => { setEmpresas(empresas.filter((x) => x.k !== e.k)); marcaSujo(); }}>Remover esta empresa</Botao></Acoes>
          </fieldset>
        ))}
      </div>
      <Acoes className="assess-grid__full"><Botao onClick={() => { setEmpresas([...empresas, { ...empresaVazia(), k: prox.current++ }]); marcaSujo(); }}>Adicionar outra empresa</Botao></Acoes>
      <Secao titulo="Texto do contrato" />
      <Campo rotulo="Cidade do foro"><input type="text" maxLength={80} value={foro} onChange={(e) => setForo(e.target.value)} /></Campo>
      <ul className="assess-grid__full modelo-ajuda">
        <li>Uma linha por parágrafo. Linhas que começam com CLÁUSULA viram título e são numeradas sozinhas (PRIMEIRA, SEGUNDA...).</li>
        <li>{"O painel preenche: {{CONTRATANTE}}, {{CONTRATADA}}, {{EVENTO}}, {{DATA_EVENTO}}, {{LOCAL}}, {{PARTICIPANTES}}, {{VALOR}} (em algarismos e por extenso), {{PAGAMENTO}}, {{VIGENCIA}}, {{FORO}} e {{CONDICOES}}."}</li>
        <li>Linhas que começam com [SE ANEXO II] só entram quando o contrato tem o Anexo II; as que começam com [SE CONDIÇÕES], só quando há condições específicas.</li>
        <li>A qualificação das partes, as assinaturas e os anexos o painel monta sozinho.</li>
        <li>O modelo padrão é um ponto de partida: peça ao advogado da empresa para revisar antes do primeiro uso.</li>
      </ul>
      <Campo rotulo="Cláusulas" cheio><textarea rows={24} maxLength={60000} value={modelo} onChange={(e) => setModelo(e.target.value)} /></Campo>
      <Acoes className="assess-grid__full">
        <Botao onClick={() => {
          pergunta("Voltar ao modelo padrão?", "O texto das cláusulas volta ao original do painel. Só muda depois de Salvar.", "Voltar ao padrão").then((sim) => {
            if (sim) { setModelo(MODELO_CONTRATO); marcaSujo(); }
          });
        }}>Voltar ao modelo padrão</Botao>
      </Acoes>
      <BarraForm>
        <button type="submit" className="btn btn--red btn--lg" disabled={salvando}>Salvar</button>
        <Botao onClick={() => cancelar("propostas")}>Cancelar</Botao>
      </BarraForm>
    </Form>
  );
}

export function TelaModeloContrato() {
  const [cfg, setCfg] = useState<ConfigContrato | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => { carregaConfig().then(setCfg).catch((e) => { setErro(true); falha(e); }); }, []);
  return (
    <>
      <Trilha aba="propostas" atual="Empresa e modelo do contrato" />
      <Card passo="Contratos" titulo="Empresa e modelo do contrato">
        <p className="muted">Preencha uma vez. Todo contrato usa estes dados e este texto; cada contrato guarda a empresa escolhida no momento em que foi gerado.</p>
        {erro ? <p className="assess-alerta">Não consegui ler os dados do contrato. Se a tabela ainda não existe no banco: npx wrangler d1 execute tardim --remote --file d1/migracoes/012-contratos.sql</p>
          : !cfg ? <p className="muted">Carregando...</p> : <FormModelo cfg={cfg} />}
      </Card>
    </>
  );
}
