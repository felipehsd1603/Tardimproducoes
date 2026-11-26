// Aba Medição: totais do site por página (js/ui.js -> functions/api/evento.ts), sem identificar ninguém.
import { useEffect, useState } from "react";
import { api } from "../api.ts";
import { falha, filtros } from "../loja.tsx";
import { provaPorId } from "../dados.ts";
import { Campo, Card, Escolha, Tabela } from "../ui.tsx";
import type { LinhaMedicao } from "../tipos.ts";

export function AbaMedicao() {
  const [dias, setDias] = useState(filtros.dias);
  const [linhas, setLinhas] = useState<LinhaMedicao[] | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    filtros.dias = dias;
    setLinhas(null); setErro(false);
    api<LinhaMedicao[]>("GET", "medicao?dias=" + dias).then(setLinhas).catch((e) => { setErro(true); falha(e); });
  }, [dias]);
  let area;
  if (erro) area = <p className="assess-alerta">Não consegui ler a medição. Se a tabela ainda não existe no banco: npx wrangler d1 execute tardim --remote --file d1/migracoes/009-medicao-faq.sql</p>;
  else if (!linhas) area = <p className="muted">Carregando...</p>;
  else if (!linhas.length) area = <p className="muted">Nada medido neste período ainda.</p>;
  else {
    const porRef: Record<string, Record<string, number>> = {};
    linhas.forEach((l) => { (porRef[l.ref] = porRef[l.ref] || {})[l.evento] = Number(l.n) || 0; });
    const refs = Object.keys(porRef).sort((a, b) => (porRef[b].visita || 0) + (porRef[b].inscricao || 0) - (porRef[a].visita || 0) - (porRef[a].inscricao || 0));
    const num = (n: number | undefined) => (n ? Number(n).toLocaleString("pt-BR") : "—");
    area = (
      <Tabela cab={["Página", "Visitas", "Cliques em inscrição", "Taxa", "WhatsApp", "Orçamentos enviados", "Agenda", "Compartilhar"]} linhas={refs.map((r) => {
        const m = porRef[r], pv = provaPorId(r);
        const taxa = m.visita && m.inscricao ? (Math.min(m.inscricao / m.visita, 1) * 100).toFixed(1).replace(".", ",") + "%" : "—";
        return [<strong>{pv ? pv.nome : r}</strong>, num(m.visita), num(m.inscricao), taxa, num(m.whatsapp), num(m.orcamento), num(m.agenda), num(m.compartilhar)];
      })} />
    );
  }
  return (
    <Card passo="Resultados do site" titulo="Medição">
      <p className="muted">Quantas vezes cada página foi aberta e quantos toques os botões receberam. São só totais por dia, sem identificar ninguém. "Visitas" conta as páginas das provas e a página Para empresas; os cliques feitos no calendário da página inicial entram na linha da prova.</p>
      <div className="painel-filtros">
        <Campo rotulo="Período"><Escolha opcoes={[["7", "Últimos 7 dias"], ["30", "Últimos 30 dias"], ["90", "Últimos 90 dias"], ["365", "Último ano"]]} value={dias} onChange={setDias} /></Campo>
      </div>
      <div>{area}</div>
    </Card>
  );
}
