// Aba Apuração: o relatório de inscritos da Ticket Sports (Excel ou CSV) é lido só no navegador;
// soma as inscrições pagas por cupom e calcula a comissão de cada parceiro.
import { useState } from "react";
import { aviso, filtros, usaEstado } from "../loja.tsx";
import { opcoesProvas, parceiroPorId, provaPorId } from "../dados.ts";
import { Acoes, Botao, Campo, Card, Escolha, Marcador, Tabela } from "../ui.tsx";
import { reais, slug, TIPOS, valorNum } from "../util.ts";

interface Planilha { arquivo: string; cab: string[]; linhas: unknown[][] }

export function AbaApuracao() {
  const provas = opcoesProvas(false);
  const [prova, setProva] = useState(filtros.prova || "");
  const [dados, setDados] = useState<Planilha | null>(null);
  const [sobre, setSobre] = useState(false);
  const provaAtual = prova || (provas[0] ? provas[0][0] : "");

  function le(file: File) {
    const X = window.XLSX;
    if (!X) return aviso("A biblioteca de planilhas não carregou. Recarregue a página.", true);
    const rd = new FileReader();
    rd.onload = () => {
      try {
        // CSV: lê cada célula como texto. Sem isso, "89,91" (vírgula decimal) vira 8991 e a comissão sai cem vezes maior
        const wb = X.read(new Uint8Array(rd.result as ArrayBuffer), { type: "array", raw: /\.(csv|txt)$/i.test(file.name) });
        const rows = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: true });
        const h = rows.findIndex((r) => r.filter((x) => String(x).trim()).length >= 3);
        if (h < 0) throw new Error("não achei o cabeçalho");
        setDados({ arquivo: file.name, cab: rows[h].map((x) => String(x).trim()), linhas: rows.slice(h + 1).filter((r) => r.some((x) => String(x).trim())) });
      } catch (e) { aviso("Não consegui ler o arquivo: " + (e as Error).message, true); }
    };
    rd.readAsArrayBuffer(file);
  }

  return (
    <Card passo="Comissões" titulo="Apuração">
      <p className="muted">Exporte o relatório de inscritos da prova na Ticket Sports e solte o arquivo aqui. O painel soma as inscrições pagas por cupom e calcula a comissão de cada parceiro. O arquivo é lido só no seu navegador.</p>
      <div className="painel-filtros">
        <Campo rotulo="Prova"><Escolha opcoes={provas} value={provaAtual} onChange={(x) => { setProva(x); filtros.prova = x; }} /></Campo>
      </div>
      <label className={"assess-drop" + (sobre ? " is-over" : "")}
        onDragOver={(e) => { e.preventDefault(); setSobre(true); }} onDragEnter={(e) => { e.preventDefault(); setSobre(true); }}
        onDragLeave={() => setSobre(false)}
        onDrop={(e) => { e.preventDefault(); setSobre(false); if (e.dataTransfer.files[0]) le(e.dataTransfer.files[0]); }}>
        <b>Solte o relatório aqui</b>
        <span>ou clique para escolher (Excel ou CSV)</span>
        <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => { if (e.target.files?.[0]) le(e.target.files[0]); }} />
      </label>
      <div>{dados ? <Resultado key={dados.arquivo + dados.linhas.length} dados={dados} prova={provaAtual} /> : null}</div>
    </Card>
  );
}

function Resultado({ dados, prova }: { dados: Planilha; prova: string }) {
  const { convites } = usaEstado();
  const acha = (re: RegExp) => { const i = dados.cab.findIndex((h) => re.test(h)); return i < 0 ? "" : String(i); };
  const [colCupom, setColCupom] = useState(() => acha(/cupom|voucher|promo/i));
  const [colValor, setColValor] = useState(() => acha(/valor.*(pago|l[ií]quido|total)|^valor$|total pago|pre[çc]o/i));
  const [colSit, setColSit] = useState(() => acha(/status|situa[çc]/i));
  const [marcadas, setMarcadas] = useState<Record<string, boolean>>({});
  const ops: [string, string][] = ([["", "— não usar —"]] as [string, string][]).concat(dados.cab.map((h, i): [string, string] => [String(i), h || "Coluna " + (i + 1)]));
  const sitDe = (r: unknown[]) => String(r[Number(colSit)]).trim() || "(vazio)";

  // Situações encontradas e se contam como paga (o palpite inicial pelo nome; depois, o que foi marcado)
  const vals: Record<string, number> = {};
  if (colSit !== "") dados.linhas.forEach((r) => { const v = sitDe(r); vals[v] = (vals[v] || 0) + 1; });
  const paga = (v: string) => (marcadas[v] != null ? marcadas[v] : /pag|aprov|confirm|conclu|ativ|efetiv/i.test(v) && !/n[aã]o|cancel|estorn|pend|recus|expir|devol|aguard/i.test(v));

  let corpo;
  if (colCupom === "") corpo = <p className="assess-alerta">Escolha a coluna do cupom.</p>;
  else {
    const convs = convites.filter((x) => x.prova_id === prova);
    const porCupom: Record<string, { cv: typeof convs[number]; n: number; total: number }> = {};
    convs.forEach((cv) => { porCupom[cv.cupom] = { cv, n: 0, total: 0 }; });
    const soltos: Record<string, number> = {};
    let pagas = 0;
    dados.linhas.forEach((r) => {
      const cod = String(r[Number(colCupom)]).trim().toUpperCase();
      if (!cod) return;
      if (colSit !== "" && !paga(sitDe(r))) return;
      pagas++;
      const v = colValor === "" ? 0 : valorNum(r[Number(colValor)]);
      if (porCupom[cod]) { porCupom[cod].n++; porCupom[cod].total += v; }
      else soltos[cod] = (soltos[cod] || 0) + 1;
    });
    const linhasRes = Object.keys(porCupom).map((k) => {
      const x = porCupom[k], pa = parceiroPorId(x.cv.parceiro_id) || { nome: "?", tipo: "", pix: "" };
      const pct = Number(x.cv.comissao_pct) || 0;
      return { parceiro: pa.nome, tipo: TIPOS[pa.tipo] || "", pix: pa.pix || "", cupom: k, inscricoes: x.n, valor: x.total, pct, comissao: Math.round(x.total * pct) / 100 };
    }).sort((a, b) => b.inscricoes - a.inscricoes);
    const tot = linhasRes.reduce((a, x) => { a.n += x.inscricoes; a.v += x.valor; a.c += x.comissao; return a; }, { n: 0, v: 0, c: 0 });
    const ks = Object.keys(soltos);
    corpo = (
      <>
        {!convs.length ? <p className="assess-alerta">Esta prova não tem convites cadastrados.</p> : null}
        <div className="assess-nums">
          {[[String(pagas), "inscrições com cupom contadas"], [String(tot.n), "dos parceiros"], [reais(tot.c), "de comissão a pagar"]].map((n) => (
            <div className="assess-num" key={n[1]}><b>{n[0]}</b><span>{n[1]}</span></div>
          ))}
        </div>
        {linhasRes.length ? (
          <Tabela cab={["Parceiro", "Cupom", "Inscrições", "Valor pago", "Comissão", "A pagar"]} linhas={linhasRes.map((x) => [
            x.parceiro + (x.tipo ? " · " + x.tipo : ""), x.cupom, String(x.inscricoes), colValor === "" ? "—" : reais(x.valor),
            x.pct ? String(x.pct).replace(".", ",") + "%" : "—", colValor === "" ? "—" : reais(x.comissao),
          ])} />
        ) : null}
        {ks.length ? <p className="assess-alerta">{"Cupons usados que não são de nenhum convite desta prova: " + ks.map((k) => k + " (" + soltos[k] + ")").join(", ") + ". Podem ser cortesias ou cupons gerais."}</p> : null}
        {colValor === "" ? <p className="muted">Sem a coluna do valor, o painel só conta as inscrições.</p> : null}
        {linhasRes.length && window.XLSX ? (
          <Acoes><Botao cls="btn btn--red" onClick={() => {
            const X = window.XLSX!;
            const pv = provaPorId(prova) || { id: prova, nome: prova };
            const ws = X.utils.json_to_sheet(linhasRes.map((x) => ({
              Parceiro: x.parceiro, Tipo: x.tipo, Cupom: x.cupom, "Inscrições pagas": x.inscricoes, "Valor pago (R$)": Math.round(x.valor * 100) / 100,
              "Comissão (%)": x.pct, "A pagar (R$)": x.comissao, Pix: x.pix,
            })));
            const wb = X.utils.book_new();
            X.utils.book_append_sheet(wb, ws, "Apuração");
            X.writeFile(wb, "Apuracao_" + slug(pv.nome) + ".xlsx");
          }}>Baixar apuração (Excel)</Botao></Acoes>
        ) : null}
      </>
    );
  }

  return (
    <>
      <p className="assess-status">{dados.arquivo + ": " + dados.linhas.length + (dados.linhas.length === 1 ? " linha." : " linhas.")}</p>
      <div className="assess-grid">
        <Campo rotulo="Coluna do cupom"><Escolha opcoes={ops} value={colCupom} onChange={setColCupom} /></Campo>
        <Campo rotulo="Coluna do valor pago"><Escolha opcoes={ops} value={colValor} onChange={setColValor} /></Campo>
        <Campo rotulo="Coluna da situação do pagamento" dica="Para contar só as inscrições pagas."><Escolha opcoes={ops} value={colSit} onChange={setColSit} /></Campo>
        <div className="assess-grid__full painel-sits">
          {colSit !== "" ? <>
            <span className="painel-sits__t">Conta como paga:</span>
            {Object.keys(vals).sort().map((v) => (
              <Marcador key={v} texto={v + " (" + vals[v] + ")"} checked={paga(v)} onChange={(c) => setMarcadas((m) => ({ ...m, [v]: c }))} />
            ))}
          </> : null}
        </div>
      </div>
      <div>{corpo}</div>
    </>
  );
}
