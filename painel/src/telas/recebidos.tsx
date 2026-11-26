// O que chega pelo site: inscrições coletivas (planilha e sistema da assessoria, com a conferência dos atletas),
// pedidos de "Me avise quando abrir" e pedidos de orçamento.
import { useEffect, useRef, useState } from "react";
import { api } from "../api.ts";
import { aviso, falha, muda, pega, redesenha, usaEstado, type Estado } from "../loja.tsx";
import { camposDa, provaPorId, todasProvas } from "../dados.ts";
import { Acoes, Botao, Campo, Card, Escolha, LinkExt, Situacao, Tabela, pergunta, perguntaTexto } from "../ui.tsx";
import { baixaPlanilha, curta, dataDe, dataHora, hoje, linkWa, quando, slug } from "../util.ts";
import type { AvisoPlataforma, Atleta, Inscricao, ResumoAviso } from "../tipos.ts";

const semXlsx = () => aviso("A biblioteca de planilhas não carregou. Recarregue a página.", true);

/** Lê a lista da API uma vez (fica guardada até "Atualizar dados") */
function useCarrega<K extends "inscricoes" | "orcamentos" | "avisos">(chave: K, caminho: string, sempre = false): Estado[K] {
  const s = usaEstado();
  const [lendo, setLendo] = useState(sempre || !s[chave]);
  useEffect(() => {
    if (!sempre && pega()[chave]) return;
    api<Estado[K]>("GET", caminho).then((d) => { muda({ [chave]: d } as Partial<Estado>); setLendo(false); })
      .catch((e) => { setLendo(false); falha(e); });
  }, []);
  return lendo ? null : s[chave];
}

// ---------- Inscrições coletivas ----------
const SIT_AT: Record<string, [string, string]> = { recebido: ["Recebido", "is-rasc"], aguardando_pagamento: ["Aguardando pagamento", "is-rasc"], inscrito: ["Inscrito", "is-pub"], recusado: ["Recusado", "is-off"], cancelado: ["Cancelado", "is-off"] };

function BaixarAtletas({ i }: { i: Inscricao }) {
  const [lendo, setLendo] = useState(false);
  return (
    <Botao disabled={lendo} onClick={() => {
      setLendo(true);
      api<Atleta[]>("GET", "inscricoes/" + encodeURIComponent(i.id) + "/atletas").then((at) => {
        setLendo(false);
        if (!baixaPlanilha(at.map((a) => ({
          Nome: a.nome, CPF: a.cpf, Nascimento: a.nascimento, Sexo: a.sexo, "Distância": a.distancia, Camiseta: a.camiseta, "E-mail": a.email, Telefone: a.telefone, Equipe: a.equipe || i.equipe,
        })), "Atletas", "Inscricao_" + slug(i.equipe) + "_" + slug(i.prova_nome) + ".xlsx")) semXlsx();
      }).catch((e) => { setLendo(false); falha(e); });
    }}>Baixar atletas (Excel)</Botao>
  );
}

export function AbaInscricoes() {
  const lista0 = useCarrega("inscricoes", "inscricoes");
  const [prova, setProva] = useState("");
  const [conferindo, setConferindo] = useState<{ i: Inscricao; n: number } | null>(null);
  let conteudo = null;
  if (lista0) {
    const nomes: Record<string, string> = {};
    lista0.forEach((i) => { if (!(i.prova_id in nomes)) nomes[i.prova_id] = i.prova_nome; });
    const opcoes = ([["", "Todas as provas"]] as [string, string][]).concat(Object.keys(nomes).map((id): [string, string] => [id, nomes[id]]));
    const lista = lista0.filter((i) => !prova || i.prova_id === prova);
    const total = lista.reduce((a, i) => a + (Number(i.atletas) || Number(i.total) || 0), 0);
    conteudo = (
      <>
        <div className="painel-filtros"><Campo rotulo="Prova"><Escolha opcoes={opcoes} value={prova} onChange={setProva} /></Campo></div>
        <div>
          {!lista.length ? <p className="muted">Nenhuma inscrição coletiva recebida ainda.</p> : <>
            <p className="assess-status">{lista.length + (lista.length === 1 ? " envio · " : " envios · ") + total + (total === 1 ? " atleta" : " atletas")}</p>
            <Tabela cab={["Recebida", "Prova", "Equipe", "Responsável", "Atletas", "Canal", ""]} linhas={lista.map((i) => {
              const daApi = i.origem === "api";
              const canal = daApi ? "Sistema da assessoria" + (i.modo_pagamento === "ticketsports" ? " · paga na Ticket Sports" : i.modo_pagamento === "assessoria" ? " · PIX na assessoria" : "") : i.canal === "site" ? "Pago pelo site" + (i.modo_pagamento === "cartao" ? " · cartão" : " · PIX") : i.canal === "email" ? "E-mail" : "WhatsApp";
              return [dataHora(i.criado_em), i.prova_nome, <strong>{i.equipe}</strong>,
                <div>{i.responsavel || ""}{i.telefone ? <>{" "}<LinkExt href={linkWa(i.telefone)}>{i.telefone}</LinkExt></> : null}</div>,
                String(i.atletas != null ? i.atletas : i.total), canal,
                <Acoes>
                  {daApi ? <Botao cls="btn btn--red" onClick={() => setConferindo({ i, n: (conferindo?.n || 0) + 1 })}>Conferir</Botao> : null}
                  <BaixarAtletas i={i} />
                </Acoes>];
            })} />
          </>}
          {conferindo ? <ConfereEnvio key={conferindo.i.id + ":" + conferindo.n} i={conferindo.i} /> : null}
        </div>
      </>
    );
  }
  return (
    <Card passo="Recebidas pelo site" titulo="Inscrições coletivas">
      <p className="muted">Planilhas que as assessorias conferiram e enviaram pela página de inscrição coletiva. Os dados dos atletas são pessoais: baixe só quando for fazer as inscrições.</p>
      {lista0 ? conteudo : <p className="muted">Carregando...</p>}
    </Card>
  );
}

// Envio do sistema da assessoria (API v1): conferir cada atleta. Cada mudança avisa o sistema dela.
function ConfereEnvio({ i }: { i: Inscricao }) {
  const [at, setAt] = useState<Atleta[] | null>(null);
  const [n, setN] = useState(0);
  const caixa = useRef<HTMLDivElement>(null);
  const peitos = useRef<Record<number, string>>({});
  const recarrega = () => setN((x) => x + 1);
  useEffect(() => {
    api<Atleta[]>("GET", "inscricoes/" + encodeURIComponent(i.id) + "/atletas").then((d) => {
      setAt(d);
      requestAnimationFrame(() => caixa.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }).catch((e) => { setAt([]); falha(e); });
  }, [n]);
  if (!at) return <div ref={caixa}><p className="muted">Carregando atletas...</p></div>;
  const pend = at.filter((a) => a.situacao === "recebido" || a.situacao === "aguardando_pagamento").length;
  return (
    <div ref={caixa}>
      <h3 style={{ marginTop: "1.5rem" }}>{"Conferir: " + i.equipe + " · " + i.prova_nome}</h3>
      <p className="muted">Confirme quem já foi inscrito oficialmente (com o número de peito, se já tiver) ou recuse com o motivo. A assessoria vê a resposta no sistema dela na hora.</p>
      {pend ? <Acoes><BotaoEspera cls="btn btn--red" acao={() => api<{ confirmados: number; avisos: AvisoPlataforma[] }>("POST", "inscricoes/" + encodeURIComponent(i.id) + "/confirmar", {}).then((r) => {
        const falhou = (r.avisos || []).some((x) => !x.ok);
        aviso(r.confirmados + " confirmados." + (falhou ? " O aviso ao sistema da assessoria não foi entregue." : " A assessoria já foi avisada."), falhou);
        recarrega();
      })}>{"Confirmar os " + pend + " recebidos"}</BotaoEspera></Acoes> : null}
      <Tabela cab={["Atleta", "Percurso", "Camiseta", "Situação", "Nº de peito", ""]} ids={at.map((a) => a.id)} linhas={at.map((a) => linhaAtleta(a, peitos.current, recarrega))} />
    </div>
  );
}

function BotaoEspera({ cls, acao, children }: { cls?: string; acao: () => Promise<unknown>; children: string }) {
  const [esperando, setEsperando] = useState(false);
  return <Botao cls={cls} disabled={esperando} onClick={() => { setEsperando(true); acao().then(() => setEsperando(false), (e) => { setEsperando(false); falha(e); }); }}>{children}</Botao>;
}

function Peito({ a, onChange }: { a: Atleta; onChange: (v: string) => void }) {
  const [v, setV] = useState(a.numero_peito || "");
  return <input type="text" maxLength={10} placeholder="—" style={{ maxWidth: "6rem" }} aria-label={"Número de peito de " + a.nome} value={v} onChange={(e) => { setV(e.target.value); onChange(e.target.value); }} />;
}

function linhaAtleta(a: Atleta, peitos: Record<number, string>, depois: () => void) {
  const s = SIT_AT[a.situacao] || [a.situacao || "—", "is-rasc"];
  const grava = (dados: Partial<Atleta>) => api<{ aviso: AvisoPlataforma | null }>("PUT", "atletas/" + a.id, dados).then((r) => {
    aviso(r.aviso && !r.aviso.ok ? "Salvo, mas o aviso ao sistema da assessoria não foi entregue." : "Salvo. A assessoria foi avisada.", !!(r.aviso && !r.aviso.ok));
    depois();
  });
  const ativo = a.situacao !== "cancelado";
  return [
    <div><strong>{a.nome}</strong><small className="muted">{" · " + (a.sexo || "") + " · " + (a.nascimento || "")}</small></div>,
    a.distancia, a.camiseta,
    <div>
      <Situacao cls={s[1]}>{s[0]}</Situacao>
      {a.motivo ? <small className="muted">{" " + a.motivo}</small> : null}
      {/^erro/.test(a.aviso || "") ? <>{" "}<Situacao cls="is-off" title={a.aviso}>Aviso não entregue</Situacao></> : null}
    </div>,
    <Peito a={a} onChange={(x) => { peitos[a.id] = x; }} />,
    ativo ? <Acoes>
      <BotaoEspera acao={() => grava({ situacao: "inscrito", numero_peito: (peitos[a.id] ?? a.numero_peito ?? "").trim(), motivo: "" })}>{a.situacao === "inscrito" ? "Salvar nº" : "Confirmar"}</BotaoEspera>
      {a.situacao !== "recusado" ? <Botao cls="orc__email painel-perigo" onClick={() => {
        perguntaTexto("Recusar " + a.nome + "?", "A assessoria vê o motivo no sistema dela.", "Recusar", "Motivo").then((mot) => {
          if (mot === null) return;
          grava({ situacao: "recusado", motivo: mot.trim() || "Recusado pela organização" }).catch(falha);
        });
      }}>Recusar</Botao> : null}
    </Acoes> : null,
  ];
}

// ---------- "Me avise quando abrir" (functions/api/aviso.ts): quem está esperando o link de cada prova ----------
function enviaAvisos(provaId: string, corpo: Record<string, unknown>) {
  return api<{ enviados: number; falhas: number }>("POST", "avisos/" + encodeURIComponent(provaId) + "/enviar", corpo).then((r) => {
    aviso(r.enviados + (r.enviados === 1 ? " e-mail enviado" : " e-mails enviados") + (r.falhas ? "; " + r.falhas + " ficaram para depois (clique de novo)" : "") + ".");
    redesenha();
  });
}

function Avisar({ rotulo, titulo, msg, corpo, provaId }: { rotulo: string; titulo: string; msg: () => string; corpo: () => Record<string, unknown>; provaId: string }) {
  const [enviando, setEnviando] = useState(false);
  return (
    <Botao cls="btn btn--red btn--sm" disabled={enviando} onClick={() => {
      pergunta(titulo, msg(), "Enviar e-mails").then((sim) => {
        if (!sim) return;
        setEnviando(true);
        enviaAvisos(provaId, corpo()).catch((e) => { setEnviando(false); falha(e); });
      });
    }}>{enviando ? "Enviando..." : rotulo}</Botao>
  );
}

function NovaEdicao({ p, pend, novas }: { p: { id: string; nome: string }; pend: number; novas: ReturnType<typeof todasProvas> }) {
  const [qual, setQual] = useState(novas[0].id);
  const n = provaPorId(qual) || novas[0];
  const no = camposDa(n) as { local?: string; inscricao?: string };
  return (
    <Acoes>
      <Escolha aria-label="Nova edição para avisar" opcoes={novas.map((x): [string, string] => [x.id, x.nome + " · " + curta(x.data)])} value={qual} onChange={setQual} />
      <Avisar provaId={p.id} rotulo={"Avisar da nova edição (" + pend + ")"} titulo="Avisar da nova edição?"
        msg={() => "O e-mail \"Inscrições abertas: " + n.nome + "\" vai para " + pend + (pend === 1 ? " pessoa" : " pessoas") + " que pediram aviso na página da " + p.nome + ". Cada pessoa recebe uma vez só."}
        corpo={() => ({ nome: n.nome, data: quando(n.data), local: no.local || "", link: no.inscricao, pagina_id: n.id })} />
    </Acoes>
  );
}

export function AbaAvisos() {
  // Lido de novo a cada vez que a aba abre
  const avisos = useCarrega("avisos", "avisos", true);
  let conteudo = null;
  if (avisos) {
    const porProva: Record<string, ResumoAviso> = {};
    avisos.forEach((a) => { porProva[a.prova_id] = a; });
    const todas = todasProvas();
    const lista: { id: string; nome: string; data: string }[] = todas.filter((p) => porProva[p.id]);
    // Pedidos de provas que não estão mais na lista (removidas)
    Object.keys(porProva).forEach((id) => { if (!lista.some((p) => p.id === id)) lista.push({ id, nome: id, data: "" }); });
    conteudo = !lista.length ? <p className="muted">Ninguém pediu aviso ainda.</p> : (
      <Tabela cab={["Prova", "Data", "Esperando", "Já avisados", "Link de inscrição", ""]} linhas={lista.map((p) => {
        const o = camposDa(provaPorId(p.id)) as { local?: string; inscricao?: string };
        const a = porProva[p.id];
        const pend = Number(a.pendentes) || 0;
        const link = o.inscricao || "";
        const cab = [<strong>{p.nome}</strong>, curta(p.data), String(pend), String(Number(a.enviados) || 0)];
        // Prova já realizada: quem pediu aviso quer a próxima edição; escolhe-se a prova nova para mandar o link dela
        if (pend && p.data && dataDe(p.data) < hoje()) {
          const novas = todas.filter((n) => n.id !== p.id && dataDe(n.data) >= hoje() && camposDa(n).inscricao);
          if (!novas.length) return [...cab, <span className="muted">prova realizada</span>, <span className="muted">cadastre a nova edição com o link de inscrição</span>];
          return [...cab, <span className="muted">prova realizada</span>, <NovaEdicao p={p} pend={pend} novas={novas} />];
        }
        return [...cab, link ? <LinkExt href={link}>Abrir</LinkExt> : <span className="muted">ainda sem link</span>,
          pend && link ? <Avisar provaId={p.id} rotulo={"Avisar por e-mail (" + pend + ")"} titulo="Avisar por e-mail?"
            msg={() => "O e-mail \"Inscrições abertas\" vai para " + pend + (pend === 1 ? " pessoa" : " pessoas") + " que pediram aviso da " + p.nome + ". Cada pessoa recebe uma vez só."}
            corpo={() => ({ nome: p.nome, data: quando(p.data), local: o.local || "", link })} /> : ""];
      })} />
    );
  }
  return (
    <Card passo="Recebidos pelo site" titulo="Me avise quando abrir">
      <p className="muted">Pessoas que pediram aviso nas provas com "Inscrições em breve" ou, em provas já realizadas, o aviso da próxima edição. Depois de colocar o link da Ticket Sports na prova e publicar o site, clique em "Avisar por e-mail": cada pessoa recebe o link uma vez.</p>
      {avisos ? conteudo : <p className="muted">Carregando...</p>}
    </Card>
  );
}

// ---------- Orçamentos ----------
export function AbaOrcamentos() {
  const lista = useCarrega("orcamentos", "orcamentos");
  return (
    <Card passo="Recebidos pelo site" titulo="Pedidos de orçamento">
      <p className="muted">Cópia de cada pedido feito no formulário "Peça seu orçamento". O contato em si chega no WhatsApp ou no e-mail que a pessoa escolheu.</p>
      {!lista ? <p className="muted">Carregando...</p> : !lista.length ? <p className="muted">Nenhum pedido recebido ainda.</p> : <>
        <Acoes><Botao cls="btn btn--line" onClick={() => {
          if (!baixaPlanilha(lista.map((o) => ({
            Recebido: dataHora(o.criado_em), Canal: o.canal, "Serviço": o.servico, Nome: o.nome, Contratante: o.contratante, Empresa: o.empresa, Cidade: o.cidade, Quando: o.quando, "Público": o.publico, Detalhes: o.detalhes,
          })), "Orçamentos", "Orcamentos_Tardim.xlsx")) semXlsx();
        }}>Baixar todos (Excel)</Botao></Acoes>
        <Tabela cab={["Recebido", "Serviço", "Quem", "Cidade", "Quando", "Público", "Detalhes"]} linhas={lista.map((o) => [
          dataHora(o.criado_em), o.servico,
          <div><strong>{o.nome}</strong>{o.empresa || o.contratante ? <small className="muted">{" · " + [o.contratante, o.empresa].filter(Boolean).join(" · ")}</small> : null}</div>,
          o.cidade, o.quando, o.publico, <span className="painel-detalhe" title={o.detalhes || ""}>{o.detalhes || ""}</span>,
        ])} />
      </>}
    </Card>
  );
}
