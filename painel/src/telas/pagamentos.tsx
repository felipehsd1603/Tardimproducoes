// Inscrições coletivas pagas pelo site (assessorias.html com PAGAMENTO_SITE = ligado): situação do pagamento,
// equipe, atletas e valor de cada pedido, com o botão de conferir no banco e as planilhas para baixar.
// Os valores (cheio, desconto, taxa do cartão) só aparecem aqui no painel.
import { useEffect, useState } from "react";
import { api } from "../api.ts";
import { aviso, falha } from "../loja.tsx";
import { Acoes, Botao, Campo, Card, Escolha, LinkExt, Situacao, Tabela } from "../ui.tsx";
import { baixaPlanilha, curta, dataHora, linkWa, plural, reais, slug } from "../util.ts";
import type { PagamentoSite } from "../tipos.ts";

const semXlsx = () => aviso("A biblioteca de planilhas não carregou. Recarregue a página.", true);
const dinheiro = (centavos: number) => reais((Number(centavos) || 0) / 100);
const vigente = (p: PagamentoSite) => p.situacao === "aguardando" && p.expira_em > new Date().toISOString();

/** [texto, classe] da situação, em palavras simples */
function situacao(p: PagamentoSite): [string, string] {
  if (p.situacao === "pago") return ["Pago", "is-pub"];
  if (p.situacao === "cortesia") return ["Cortesia", "is-pub"];
  if (p.situacao === "cancelado") return ["Cancelado", "is-off"];
  if (vigente(p)) return [p.valor_pago ? "Pago a menos" : "Aguardando pagamento", p.valor_pago ? "is-off" : "is-rasc"];
  return ["Vencido sem pagamento", "is-off"];
}

const FILTROS: [string, string][] = [["", "Todas"], ["pagas", "Pagas"], ["aguardando", "Aguardando pagamento"], ["vencidas", "Vencidas"]];
function passa(p: PagamentoSite, f: string): boolean {
  if (f === "pagas") return p.situacao === "pago" || p.situacao === "cortesia";
  if (f === "aguardando") return vigente(p);
  if (f === "vencidas") return p.situacao === "expirado" || (p.situacao === "aguardando" && !vigente(p));
  return true;
}

function BaixarAtletas({ p }: { p: PagamentoSite }) {
  const [lendo, setLendo] = useState(false);
  return (
    <Botao disabled={lendo} onClick={() => {
      setLendo(true);
      api<Record<string, string>[]>("GET", "pagamentos-site/" + encodeURIComponent(p.id) + "/atletas").then((at) => {
        setLendo(false);
        if (!baixaPlanilha(at.map((a) => ({
          Nome: a.nome, CPF: a.cpf, Nascimento: a.nasc, Sexo: a.sexo, "Distância": a.dist, Camiseta: a.cam, "E-mail": a.email, Telefone: a.tel, Equipe: a.equipe || p.equipe,
        })), "Atletas", "Pago-no-site_" + slug(p.equipe) + "_" + slug(p.prova_nome) + ".xlsx")) semXlsx();
      }).catch((e) => { setLendo(false); falha(e); });
    }}>{lendo ? "Baixando..." : "Baixar atletas (Excel)"}</Botao>
  );
}

function Conferir({ p, depois }: { p: PagamentoSite; depois: (novo: PagamentoSite) => void }) {
  const [lendo, setLendo] = useState(false);
  return (
    <Botao cls="btn btn--red" disabled={lendo} onClick={() => {
      setLendo(true);
      api<PagamentoSite>("POST", "pagamentos-site/" + encodeURIComponent(p.id) + "/conferir", {}).then((novo) => {
        setLendo(false);
        const pago = novo.situacao === "pago";
        aviso(pago ? "Pagamento confirmado. Os atletas já estão em Inscrições coletivas." : "O pagamento ainda não aparece no " + (p.forma === "cartao" ? "Mercado Pago." : "banco."), !pago);
        depois(novo);
      }).catch((e) => { setLendo(false); falha(e); });
    }}>{lendo ? "Conferindo..." : "Conferir pagamento"}</Botao>
  );
}

export function AbaPagamentos() {
  const [lista, setLista] = useState<PagamentoSite[] | null>(null);
  const [n, setN] = useState(0);
  const [prova, setProva] = useState("");
  const [filtro, setFiltro] = useState("");
  useEffect(() => {
    api<PagamentoSite[]>("GET", "pagamentos-site").then(setLista).catch((e) => { setLista([]); falha(e); });
  }, [n]);
  const troca = (novo: PagamentoSite) => setLista((l) => (l || []).map((x) => (x.id === novo.id ? novo : x)));

  let conteudo = <p className="muted">Carregando...</p>;
  if (lista) {
    const nomes: Record<string, string> = {};
    lista.forEach((p) => { if (!(p.prova_id in nomes)) nomes[p.prova_id] = p.prova_nome; });
    const opcoes = ([["", "Todas as provas"]] as [string, string][]).concat(Object.keys(nomes).map((id): [string, string] => [id, nomes[id]]));
    const vis = lista.filter((p) => (!prova || p.prova_id === prova) && passa(p, filtro));
    const pagas = vis.filter((p) => p.situacao === "pago" || p.situacao === "cortesia");
    const atletas = pagas.reduce((a, p) => a + (Number(p.n_atletas) || 0), 0);
    const recebido = pagas.reduce((a, p) => a + (Number(p.valor_pago) || 0), 0);
    const exporta = () => {
      if (!baixaPlanilha(vis.map((p) => ({
        Criado: dataHora(p.criado_em), Prova: p.prova_nome, "Data da prova": curta(p.prova_data), Equipe: p.equipe, "Responsável": p.responsavel,
        WhatsApp: p.telefone, "E-mail": p.email, Atletas: p.n_atletas, Cortesias: p.cortesias, "Valor por atleta": (p.valor_atleta || 0) / 100,
        "Desconto por volume (%)": p.desconto_pct, "Valor cheio": (p.valor_cheio || 0) / 100, Desconto: (p.desconto || 0) / 100,
        "Taxa do cartão": (p.acrescimo || 0) / 100, "Valor cobrado": (p.valor || 0) / 100, "Valor recebido": (p.valor_pago || 0) / 100,
        Forma: p.forma === "cartao" ? "Cartão (Mercado Pago)" : "PIX", "Situação": situacao(p)[0], "Pago em": dataHora(p.pago_em),
        "Identificador do pagamento": p.e2e_id || p.mp_pagamento || "",
      })), "Pagas no site", "Inscricoes-pagas-no-site.xlsx")) semXlsx();
    };
    conteudo = (
      <>
        <div className="painel-filtros">
          <Campo rotulo="Prova"><Escolha opcoes={opcoes} value={prova} onChange={setProva} /></Campo>
          <Campo rotulo="Situação"><Escolha opcoes={FILTROS} value={filtro} onChange={setFiltro} /></Campo>
        </div>
        {!vis.length ? <p className="muted">{lista.length ? "Nada com esse filtro." : "Nenhuma equipe pagou pelo site ainda."}</p> : <>
          <p className="assess-status">{plural(pagas.length, " pedido pago", " pedidos pagos") + " · " + plural(atletas, " atleta", " atletas") + " · " + dinheiro(recebido) + " recebidos"}</p>
          <Acoes>
            <Botao cls="btn btn--line" onClick={exporta}>Baixar a lista (Excel)</Botao>
            <Botao onClick={() => { setLista(null); setN((x) => x + 1); }}>Atualizar</Botao>
          </Acoes>
          <Tabela cab={["Pedido", "Prova", "Equipe", "Atletas", "Valor", "Situação", ""]} ids={vis.map((p) => p.id)} linhas={vis.map((p) => {
            const s = situacao(p);
            const aberto = p.situacao === "aguardando" || p.situacao === "expirado";
            return [
              dataHora(p.criado_em),
              <div>{p.prova_nome}{p.prova_data ? <small className="muted">{" · " + curta(p.prova_data)}</small> : null}</div>,
              <div><strong>{p.equipe}</strong><br /><small>{p.responsavel}{p.telefone ? <>{" "}<LinkExt href={linkWa(p.telefone)}>{p.telefone}</LinkExt></> : null}</small></div>,
              <div>{String(p.n_atletas)}{p.cortesias ? <small className="muted">{" (" + plural(p.cortesias, " cortesia", " cortesias") + ")"}</small> : null}</div>,
              <div>
                <strong>{p.valor ? dinheiro(p.valor) : "Cortesia"}</strong>
                <small className="muted">{" · " + (p.forma === "cartao" ? "cartão" : "PIX")}</small><br />
                <small className="muted">
                  {dinheiro(p.valor_atleta) + " por atleta" + (p.desconto_pct ? ", " + String(p.desconto_pct).replace(".", ",") + "% de desconto" : "") +
                    (p.desconto ? " · desconto total " + dinheiro(p.desconto) : "") + (p.acrescimo ? " · taxa do cartão " + dinheiro(p.acrescimo) : "")}
                </small>
              </div>,
              <div>
                <Situacao cls={s[1]}>{s[0]}</Situacao>
                <small className="muted">{p.pago_em ? " " + dataHora(p.pago_em) : vigente(p) ? " até " + dataHora(p.expira_em) : ""}</small>
                {p.valor_pago && p.valor_pago !== p.valor ? <><br /><small className="muted">{"Recebido: " + dinheiro(p.valor_pago)}</small></> : null}
                {/^erro/.test(p.aviso_email || "") ? <><br /><small className="muted">E-mail de confirmação não foi entregue</small></> : null}
              </div>,
              <Acoes>
                {aberto ? <Conferir p={p} depois={troca} /> : null}
                <BaixarAtletas p={p} />
              </Acoes>,
            ];
          })} />
        </>}
      </>
    );
  }
  return (
    <Card passo="Recebidas pelo site" titulo="Inscrições pagas pelo site">
      <p className="muted">Equipes que conferiram a planilha e pagaram por PIX ou cartão aqui no site. Quando o pagamento confirma, os atletas também aparecem em Inscrições coletivas. A lista confere sozinha os pagamentos em aberto; use "Conferir pagamento" para olhar um agora.</p>
      {conteudo}
    </Card>
  );
}
