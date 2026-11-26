// Aba Depoimentos: o que clientes e atletas disseram (os publicados aparecem no site: js/ui.js).
import { useState } from "react";
import { api } from "../api.ts";
import { aviso, cancelar, falha, ir, muda, nav, usaEstado, voltarPara } from "../loja.tsx";
import { Acoes, BarraForm, Botao, Campo, Card, Escolha, Form, Marcador, Situacao, Tabela, Trilha, pergunta, useCampos } from "../ui.tsx";
import { enc } from "../util.ts";
import type { Depoimento } from "../tipos.ts";

const ONDE: [string, string][] = [["empresas", "Página Para empresas (ao lado do orçamento)"], ["inicio", "Página inicial"], ["ambas", "Nas duas"]];
const NOME_ONDE: Record<string, string> = { empresas: "Para empresas", inicio: "Página inicial", ambas: "Nas duas" };

function excluirDepoimento(d: Depoimento) {
  pergunta("Excluir o depoimento de " + d.nome + "?", "Ele sai do site e do painel.", "Excluir depoimento").then((sim) => {
    if (!sim) return;
    api("DELETE", "depoimentos/" + encodeURIComponent(d.id)).then(() => {
      muda((e) => ({ depoimentos: e.depoimentos.filter((x) => x.id !== d.id) }));
      aviso("Depoimento excluído.");
    }).catch(falha);
  });
}

export function AbaDepoimentos() {
  const { depoimentos, semDepoimentos } = usaEstado();
  return (
    <Card passo="Prova social" titulo="Depoimentos">
      <p className="muted">O que clientes e atletas disseram sobre a Tardim Produções. Os publicados aparecem no site: na página inicial (seção "Quem viveu conta", até 6) e na página Para empresas, ao lado do pedido de orçamento (os 2 mais recentes).</p>
      {semDepoimentos ? <p className="assess-alerta">Falta criar a tabela de depoimentos no banco: npx wrangler d1 execute tardim --remote --file d1/migracoes/008-depoimentos.sql</p> : <>
        <Acoes><Botao cls="btn btn--red" onClick={() => ir("depoimento/novo")}>Novo depoimento</Botao></Acoes>
        {!depoimentos.length ? <p className="muted">Nenhum depoimento cadastrado ainda.</p> : (
          <Tabela cab={["Quem", "Depoimento", "Aparece em", "Situação", ""]} ids={depoimentos.map((d) => d.id)} linhas={depoimentos.map((d) => [
            <div><strong>{d.nome}</strong>{d.cargo ? <small className="muted">{" · " + d.cargo}</small> : null}</div>,
            <span className="painel-detalhe" title={d.texto}>{d.texto}</span>,
            NOME_ONDE[d.onde] || d.onde,
            d.publicado ? <Situacao cls="is-pub">Publicado</Situacao> : <Situacao cls="is-rasc">Oculto</Situacao>,
            <Acoes>
              <Botao onClick={() => ir("depoimento/" + enc(d.id))}>Editar</Botao>
              <Botao cls="orc__email painel-perigo" onClick={() => excluirDepoimento(d)}>Excluir</Botao>
            </Acoes>,
          ])} />
        )}
      </>}
    </Card>
  );
}

export function FormDepoimento({ d }: { d: Depoimento | null }) {
  const { v, liga, muda: mudaCampo } = useCampos(() => ({ texto: d?.texto || "", nome: d?.nome || "", cargo: d?.cargo || "", onde: d?.onde || "empresas" }));
  const [publicado, setPublicado] = useState(d ? !!d.publicado : true);
  const [salvando, setSalvando] = useState(false);
  function salvar() {
    if (!v.texto.trim()) return aviso("Escreva o depoimento.", true);
    if (!v.nome.trim()) return aviso("Informe o nome de quem falou.", true);
    const linha = { texto: v.texto.trim(), nome: v.nome.trim(), cargo: v.cargo.trim(), onde: v.onde, publicado };
    setSalvando(true);
    const q = !d ? api<Depoimento>("POST", "depoimentos", linha) : api<Depoimento>("PUT", "depoimentos/" + encodeURIComponent(d.id), linha);
    q.then((salvo) => {
      muda((e) => ({ depoimentos: [salvo].concat(e.depoimentos.filter((x) => x.id !== salvo.id)) }));
      nav.destaque = salvo.id;
      voltarPara("depoimentos");
      aviso(salvo.publicado ? "Depoimento salvo e já no site (pode levar até 1 minuto para aparecer)." : "Depoimento salvo como oculto: ele não aparece no site.");
    }).catch((err) => { setSalvando(false); falha(err); });
  }
  return (
    <>
      <Trilha aba="depoimentos" atual={d ? "Editar depoimento" : "Novo depoimento"} />
      <Card passo={d ? "Editar depoimento" : "Novo depoimento"} titulo="Depoimento">
        <Form onSubmit={salvar}>
          <Campo rotulo="Depoimento" dica="Até 600 caracteres, sem aspas (o site coloca). Use só com a autorização de quem falou." cheio>
            <textarea maxLength={600} rows={5} required placeholder="Ex.: A Tardim cuidou de tudo, das licenças à chegada. Foi a nossa melhor edição." {...liga("texto")} />
          </Campo>
          <Campo rotulo="Nome de quem falou"><input type="text" maxLength={120} required placeholder="Ex.: Maria Souza" {...liga("nome")} /></Campo>
          <Campo rotulo="Cargo e instituição" dica={"Opcional. Para atleta, pode ser a prova: \"Atleta · Volta Noturna da Lagoa\"."}>
            <input type="text" maxLength={160} placeholder="Ex.: Diretora de eventos · CREA-MG" {...liga("cargo")} />
          </Campo>
          <Campo rotulo="Aparece em"><Escolha opcoes={ONDE} value={v.onde} onChange={(x) => mudaCampo("onde", x)} /></Campo>
          <div className="assess-grid__full"><Marcador texto="Publicado (aparece no site)" checked={publicado} onChange={setPublicado} /></div>
          <BarraForm>
            <button type="submit" className="btn btn--red btn--lg" disabled={salvando}>Salvar depoimento</button>
            <Botao onClick={() => cancelar("depoimentos")}>Cancelar</Botao>
          </BarraForm>
        </Form>
      </Card>
    </>
  );
}
