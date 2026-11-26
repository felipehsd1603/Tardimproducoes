// Cada tela tem endereço próprio: #provas, #prova/<id>, #prova/novo, #parceiro/<id>, #convite/novo?prova=<id>,
// #convite/<id>, #convite/<id>/links, #depoimento/<id>, #proposta/<id>, #proposta/<id>/editar, #proposta/novo?de=<id>,
// #minutario, #modelo-contrato (os mesmos do painel antigo: links antigos continuam funcionando).
import { useEffect, useLayoutEffect, type ReactNode } from "react";
import { api } from "./api.ts";
import { falha, ir, muda, nav, naoAchou, partesDa, pega, usaEstado } from "./loja.tsx";
import { porId, provaPorId } from "./dados.ts";
import { NOME_ABA } from "./ui.tsx";
import type { Proposta } from "./tipos.ts";
import { AbaProvas, FormProva } from "./telas/provas.tsx";
import { AbaParceiros, FormParceiro } from "./telas/parceiros.tsx";
import { AbaConvites, DetalheConvite, FormConvite } from "./telas/convites.tsx";
import { AbaApuracao } from "./telas/apuracao.tsx";
import { AbaAvisos, AbaInscricoes, AbaOrcamentos } from "./telas/recebidos.tsx";
import { AbaDepoimentos, FormDepoimento } from "./telas/depoimentos.tsx";
import { AbaMedicao } from "./telas/medicao.tsx";
import { AbaPropostas, FormProposta, TelaMinutario, TelaModeloContrato } from "./telas/propostas.tsx";
import { TelaAndamento } from "./telas/andamento.tsx";

// Toda tela abre do começo (sem ficar no meio da página anterior). Vem antes da tela para o
// destaque do item salvo (Tabela) poder rolar até ele depois.
function RolaTopo() {
  useLayoutEffect(() => {
    const app = document.getElementById("painel");
    if (!app) return;
    const y = app.getBoundingClientRect().top + window.scrollY - 72;
    if (window.scrollY > y) window.scrollTo(0, Math.max(0, y));
  }, []);
  return null;
}
function NaoAchou({ aba, msg }: { aba: string; msg: string }) {
  useEffect(() => { naoAchou(aba, msg); }, []);
  return null;
}

// As propostas são lidas só quando a aba é aberta; o endereço direto de uma proposta espera a leitura
function TelaProposta({ id, extra, de }: { id: string; extra?: string; de: string | null }) {
  const { propostas } = usaEstado();
  useEffect(() => {
    if (!propostas) api<Proposta[]>("GET", "propostas").then((d) => muda({ propostas: d })).catch((e) => { falha(e); ir("propostas"); });
  }, []);
  if (!propostas) return <p className="muted">Carregando...</p>;
  const base = id === "novo" ? (de ? porId(propostas, de) || null : null) : porId(propostas, id);
  if (id !== "novo" && !base) return <NaoAchou aba="propostas" msg="Essa proposta não está mais no painel." />;
  // #proposta/<id> = andamento (do orçamento ao contrato assinado); #proposta/<id>/editar = itens e valores
  if (id === "novo") return <FormProposta item={null} modelo={base || null} />;
  if (extra === "editar") return <FormProposta item={base!} modelo={null} />;
  return <TelaAndamento x={base!} />;
}

function tela(rota: string): { titulo: string; conteudo: ReactNode } {
  const { tipo, id, extra, params, aba } = partesDa(rota);
  const S = pega();
  let titulo = NOME_ABA[aba];
  let conteudo: ReactNode = null;
  if (tipo === aba) {
    conteudo = ({ provas: <AbaProvas />, parceiros: <AbaParceiros />, convites: <AbaConvites />, apuracao: <AbaApuracao />,
      inscricoes: <AbaInscricoes />, avisos: <AbaAvisos />, orcamentos: <AbaOrcamentos />, depoimentos: <AbaDepoimentos />,
      medicao: <AbaMedicao />, propostas: <AbaPropostas /> } as Record<string, ReactNode>)[aba];
  } else if (tipo === "proposta") {
    conteudo = <TelaProposta id={id} extra={extra} de={params.get("de")} />;
    titulo = id === "novo" ? "Nova proposta" : (extra === "editar" ? "Editar proposta" : "Proposta");
  } else if (tipo === "minutario") {
    conteudo = <TelaMinutario />; titulo = "Minutário";
  } else if (tipo === "modelo-contrato") {
    conteudo = <TelaModeloContrato />; titulo = "Empresa e modelo do contrato";
  } else if (tipo === "depoimento") {
    const dp = id === "novo" ? null : porId(S.depoimentos, id);
    if (id !== "novo" && !dp) conteudo = <NaoAchou aba="depoimentos" msg="Esse depoimento não está mais no painel." />;
    else { conteudo = <FormDepoimento d={dp || null} />; titulo = dp ? "Depoimento de " + dp.nome : "Novo depoimento"; }
  } else if (tipo === "prova") {
    const pv = id === "novo" ? null : provaPorId(id);
    if (id !== "novo" && !pv) conteudo = <NaoAchou aba="provas" msg="Essa prova não está mais no painel." />;
    else { conteudo = <FormProva item={pv || null} />; titulo = pv ? pv.nome : "Nova prova"; }
  } else if (tipo === "parceiro") {
    const pa = id === "novo" ? null : porId(S.parceiros, id);
    if (id !== "novo" && !pa) conteudo = <NaoAchou aba="parceiros" msg="Esse parceiro não está mais no painel." />;
    else { conteudo = <FormParceiro p={pa || null} />; titulo = pa ? pa.nome : "Novo parceiro"; }
  } else if (tipo === "convite") {
    if (id === "novo") {
      const padrao: { prova_id?: string; parceiro_id?: string } = {};
      if (params.get("prova")) padrao.prova_id = params.get("prova")!;
      if (params.get("parceiro")) padrao.parceiro_id = porId(S.parceiros, params.get("parceiro"))?.id;
      conteudo = <FormConvite cv={null} padrao={padrao} />; titulo = "Novo convite";
    } else {
      const cv = porId(S.convites, id);
      if (!cv) conteudo = <NaoAchou aba="convites" msg="Esse convite não está mais no painel." />;
      else { conteudo = extra === "links" ? <DetalheConvite cv={cv} /> : <FormConvite cv={cv} />; titulo = "Convite " + cv.cupom; }
    }
  }
  return { titulo, conteudo };
}

export function Rotas({ rota }: { rota: string }) {
  const { valida } = partesDa(rota);
  const { titulo, conteudo } = tela(rota);
  useEffect(() => {
    nav.destaque = null;
    if (!valida) { history.replaceState(null, "", "#provas"); muda({ rota: "provas" }); }
  }, []);
  useEffect(() => { document.title = titulo + " · Painel Tardim"; }, [titulo]);
  return <><RolaTopo />{conteudo}</>;
}
