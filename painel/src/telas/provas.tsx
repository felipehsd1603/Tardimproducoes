// Aba Provas: lista (painel + js/eventos.js) e formulário completo da prova.
import { useEffect, useRef, useState } from "react";
import { api, enviaImagem } from "../api.ts";
import { aviso, cancelar, falha, ir, muda, nav, pega, usaEstado, voltarPara } from "../loja.tsx";
import { todasProvas } from "../dados.ts";
import { Acoes, BarraForm, Botao, Bloco, Campo, Card, Form, LinkExt, Marcador, Situacao, Tabela, Trilha, pergunta, useCampos } from "../ui.tsx";
import { LinhasEditaveis, ListaTextos } from "../editores.tsx";
import { base, comprime, curta, dataDe, enc, hoje, slug } from "../util.ts";
import type { Prova, ProvaLista, Valor } from "../tipos.ts";

const NOMES = { publicada: ["Publicada", "is-pub"], rascunho: ["Rascunho", "is-rasc"], codigo: ["No código (eventos.js)", "is-off"] } as const;

export function AbaProvas() {
  const { convites } = usaEstado();
  const lista = todasProvas();
  return (
    <Card passo="Calendário" titulo="Provas">
      <p className="muted">Cadastre a prova e marque como publicada: a página da prova, o kit de divulgação e o card para stories saem prontos na hora.</p>
      <Acoes><Botao cls="btn btn--red" onClick={() => ir("prova/novo")}>Nova prova</Botao></Acoes>
      {!lista.length ? <p className="muted">Nenhuma prova cadastrada ainda.</p> : (
        <Tabela cab={["Prova", "Data", "Situação", "Divulgadores", ""]} ids={lista.map((p) => p.id)} linhas={lista.map((p) => {
          const n = convites.filter((x) => x.prova_id === p.id).length;
          const passada = dataDe(p.data) < hoje();
          return [
            <div><strong>{p.nome}</strong>{passada ? <small className="muted"> (realizada)</small> : null}</div>,
            curta(p.data), <Situacao cls={NOMES[p.fonte][1]}>{NOMES[p.fonte][0]}</Situacao>, String(n),
            <Acoes>
              <Botao onClick={() => ir("prova/" + enc(p.id))}>{p.fonte === "codigo" ? "Trazer para o painel" : "Editar"}</Botao>
              <LinkExt href={base() + "kit.html?p=" + encodeURIComponent(p.id)}>Kit</LinkExt>
              {p.fonte !== "rascunho" ? <LinkExt href={base() + "prova-" + p.id + ".html"}>Página</LinkExt> : null}
            </Acoes>,
          ];
        })} />
      )}
    </Card>
  );
}

function deObjeto(p: ProvaEventos): Prova {
  return {
    id: p.id, nome: p.nome, data: p.data, hora: p.hora || "", local: p.local || "",
    percursos: Array.isArray(p.percursos) ? p.percursos : (p.percursos ? [p.percursos] : []),
    resumo: p.resumo || "", poster: p.poster || "", inscricao: p.inscricao || "", valores: p.valores || [],
    kit: p.kit || { itens: [], retirada: "" }, programacao: p.programacao || [], premiacao: p.premiacao || "",
    percurso_mapa: p.percursoMapa || "", regulamento: p.regulamento || "", resultados: p.resultados || "",
    fotos: p.fotos || "", realizacao: p.realizacao || "", texto_divulgacao: p.textoDivulgacao || "",
    hashtags: p.hashtags || "", faq: p.faq || [], publicada: true,
  };
}

function excluirProva(id: string) {
  const n = pega().convites.filter((x) => x.prova_id === id).length;
  pergunta("Excluir esta prova?", "Ela sai do site e do painel." + (n === 1 ? " O convite dela continua guardado." : n ? " Os " + n + " convites dela continuam guardados." : ""), "Excluir prova").then((sim) => {
    if (!sim) return;
    api("DELETE", "provas/" + encodeURIComponent(id)).then(() => {
      muda((e) => ({ provas: e.provas.filter((x) => x.id !== id) }));
      voltarPara("provas");
      aviso("Prova excluída do painel.");
    }).catch(falha);
  });
}

interface LinhaValor { nome: string; valor: string; detalhe: string; esgotado: boolean; ate: string }
interface LinhaFaq { p: string; r: string }
interface LinhaProg { h: string; a: string }

export function FormProva({ item }: { item: ProvaLista | null }) {
  const existe = !!(item && item.linha);
  const r0: Partial<Prova> = item ? (item.linha || deObjeto(item.obj!)) : {};
  const { v, liga, muda: mudaCampo } = useCampos(() => ({
    nome: r0.nome || "", id: r0.id || "", data: r0.data || "", hora: r0.hora || "", local: r0.local || "", resumo: r0.resumo || "",
    poster: r0.poster || "", inscricao: r0.inscricao || "", retirada: (r0.kit || { retirada: "" }).retirada || "", premiacao: r0.premiacao || "",
    percurso_mapa: r0.percurso_mapa || "", regulamento: r0.regulamento || "", resultados: r0.resultados || "", fotos: r0.fotos || "",
    realizacao: r0.realizacao || "", texto_divulgacao: r0.texto_divulgacao || "", hashtags: r0.hashtags || "",
  }));
  const [percursos, setPercursos] = useState<string[]>(r0.percursos || []);
  const [kitItens, setKitItens] = useState<string[]>((r0.kit || { itens: [] }).itens || []);
  const [valores, setValores] = useState<LinhaValor[]>((r0.valores || []).map((x: Valor) => ({ nome: x.nome || "", valor: x.valor || "", detalhe: x.detalhe || "", esgotado: !!x.esgotado, ate: x.ate || "" })));
  const [programacao, setProgramacao] = useState<LinhaProg[]>((r0.programacao || []).map((p) => ({ h: p[0] || "", a: p[1] || "" })));
  const faqAntes = (r0.faq || []).length > 0;
  const [faq, setFaq] = useState<LinhaFaq[]>((r0.faq || []).map((q) => ({ p: q[0] || "", r: q[1] || "" })));
  const [publicada, setPublicada] = useState(r0.publicada == null ? true : !!r0.publicada);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState(r0.poster || "");
  const [salvando, setSalvando] = useState(false);
  const idManual = useRef(!!item);
  const nomeRef = useRef<HTMLInputElement>(null);
  useEffect(() => { nomeRef.current?.focus({ preventScroll: true }); }, []);

  const geraId = (nome: string, data: string) => {
    if (idManual.current) return;
    const ano = (data || "").slice(0, 4);
    mudaCampo("id", slug(nome) + (ano && nome.indexOf(ano) < 0 ? "-" + ano : ""));
  };
  const titulo = existe ? "Editar prova" : (item ? "Trazer para o painel" : "Nova prova");

  function salvar() {
    const ident = v.id.trim();
    if (!v.nome.trim()) return aviso("Informe o nome da prova.", true);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(ident)) return aviso("O identificador só pode ter letras minúsculas, números e hífen.", true);
    if (!v.data) return aviso("Informe a data da prova.", true);
    const vals = valores.filter((x) => x.nome.trim() || x.valor.trim() || x.detalhe.trim() || x.ate);
    if (vals.some((x) => !x.nome.trim())) return aviso("Nos valores, cada linha precisa do nome (ex.: 1º lote).", true);
    const linha: Partial<Prova> & { id: string } = {
      id: ident, nome: v.nome.trim(), data: v.data, hora: v.hora.trim(), local: v.local.trim(),
      percursos: percursos.map((x) => x.trim()).filter(Boolean), resumo: v.resumo.trim(), poster: v.poster.trim(), inscricao: v.inscricao.trim(),
      valores: vals.map((x) => {
        const o: Valor = { nome: x.nome.trim(), valor: x.valor.trim() };
        if (x.detalhe.trim()) o.detalhe = x.detalhe.trim();
        if (x.esgotado) o.esgotado = true;
        if (x.ate) o.ate = x.ate;
        return o;
      }),
      kit: { itens: kitItens.map((x) => x.trim()).filter(Boolean), retirada: v.retirada.trim() },
      programacao: programacao.filter((p) => p.h.trim() || p.a.trim()).map((p): [string, string] => [p.h.trim(), p.a.trim()]),
      premiacao: v.premiacao.trim(), percurso_mapa: v.percurso_mapa.trim(), regulamento: v.regulamento.trim(),
      resultados: v.resultados.trim(), fotos: v.fotos.trim(), realizacao: v.realizacao.trim(),
      texto_divulgacao: v.texto_divulgacao.trim(), hashtags: v.hashtags.trim(), publicada,
    };
    // Só envia as perguntas quando há o que gravar ou apagar: banco ainda sem a coluna faq continua salvando a prova
    const perguntas = faq.filter((q) => q.p.trim() || q.r.trim());
    if (perguntas.length || faqAntes) {
      if (perguntas.some((q) => !q.p.trim() || !q.r.trim())) return aviso("Nas perguntas frequentes, cada linha precisa ter a pergunta e a resposta.", true);
      linha.faq = perguntas.map((q): [string, string] => [q.p.trim(), q.r.trim()]);
    }
    setSalvando(true);
    const enviaArte = arquivo ? comprime(arquivo).then((blob) => enviaImagem("provas", ident, blob, "image/jpeg")).then((c) => { linha.poster = "arquivos/" + c; }) : Promise.resolve();
    enviaArte.then(() => (existe ? api<Prova>("PUT", "provas/" + encodeURIComponent(ident), linha) : api<Prova>("POST", "provas", linha)))
      .then((salva) => {
        muda((e) => ({ provas: e.provas.filter((x) => x.id !== ident).concat([salva]) }));
        nav.destaque = ident;
        voltarPara("provas");
        aviso(linha.publicada ? "Prova salva e já no site (pode levar até 1 minuto para aparecer)." : "Prova salva como rascunho: ela não aparece no site.");
      }).catch((err) => { setSalvando(false); falha(err); });
  }

  return (
    <>
      <Trilha aba="provas" atual={titulo} />
      <Card passo={titulo} titulo={item ? r0.nome : "Dados da prova"}>
        {item && !existe ? <p className="muted">Esta prova está no js/eventos.js. Ao salvar, ela passa a ser editada por aqui e a versão do painel vale no site.</p> : null}
        <Form onSubmit={salvar}>
          <Campo rotulo="Nome da prova" cheio>
            <input ref={nomeRef} type="text" maxLength={120} required {...liga("nome")} onChange={(e) => { mudaCampo("nome", e.target.value); geraId(e.target.value, v.data); }} />
          </Campo>
          <Campo rotulo="Identificador (vai no endereço)" dica={item ? "Não muda depois de criado." : "Gerado pelo nome; só letras minúsculas, números e hífen."}>
            <input type="text" maxLength={60} required disabled={!!item} {...liga("id")} onChange={(e) => { idManual.current = true; mudaCampo("id", e.target.value); }} />
          </Campo>
          <Campo rotulo="Data"><input type="date" required {...liga("data")} onChange={(e) => { mudaCampo("data", e.target.value); geraId(v.nome, e.target.value); }} /></Campo>
          <Campo rotulo="Horário da largada"><input type="text" placeholder="08h00" maxLength={10} {...liga("hora")} /></Campo>
          <Campo rotulo="Local da largada"><input type="text" maxLength={200} {...liga("local")} /></Campo>
          <Campo rotulo="Resumo" dica="Uma ou duas frases sobre a prova."><textarea maxLength={400} {...liga("resumo")} /></Campo>
          <Bloco rotulo="Percursos" dica="Um por linha. Ex.: Caminhada 3 km, Corrida 5 km, Corrida 10 km.">
            <ListaTextos itens={percursos} onChange={setPercursos} rotulo="Percurso" placeholder="Corrida 5 km" textoNovo="Adicionar percurso" />
          </Bloco>
          <Bloco rotulo="Arte da prova" dica="De preferência JPG em pé (como o pôster). O painel reduz para até 1600 px.">
            <div className="painel-poster">{previa ? <img src={previa} alt="Arte atual" /> : null}</div>
            <input type="file" accept="image/*" aria-label="Arquivo da arte" onChange={(e) => { const f = e.target.files?.[0] || null; setArquivo(f); if (f) setPrevia(URL.createObjectURL(f)); }} />
            <input type="text" placeholder="Envie a arte acima ou cole um endereço" aria-label="Endereço da arte" {...liga("poster")} />
          </Bloco>
          <Campo rotulo="Link de inscrição (Ticket Sports)" dica="O link público da página do evento, não o da ficha." cheio>
            <input type="url" placeholder="https://www.ticketsports.com.br/e/..." {...liga("inscricao")} />
          </Campo>
          <Bloco rotulo="Valores" cheio dica={"O último dia é opcional e só vai nos lotes, na ordem em que acontecem: o site passa para o lote seguinte sozinho e mostra \"1º lote até 21/02\". Linhas sem data valem sempre."}>
            <LinhasEditaveis linhas={valores} onChange={setValores} textoNovo="Adicionar valor"
              novo={() => ({ nome: "", valor: "", detalhe: "", esgotado: false, ate: "" })}
              cab={["Nome", "Valor", "Detalhe", "Esgotado", "Último dia do lote"]}
              celulas={(l, m, i) => [
                <input type="text" value={l.nome} placeholder={i === 0 ? "1º lote" : undefined} aria-label={"Nome do valor " + (i + 1)} onChange={(e) => m({ nome: e.target.value })} />,
                <input type="text" value={l.valor} placeholder={i === 0 ? "R$ 80,00" : undefined} aria-label={"Valor " + (i + 1)} onChange={(e) => m({ valor: e.target.value })} />,
                <input type="text" value={l.detalhe} placeholder={i === 0 ? "conforme a lei" : undefined} aria-label={"Detalhe do valor " + (i + 1)} onChange={(e) => m({ detalhe: e.target.value })} />,
                <input type="checkbox" checked={l.esgotado} aria-label={"Valor " + (i + 1) + " esgotado"} onChange={(e) => m({ esgotado: e.target.checked })} />,
                <input type="date" value={l.ate} aria-label={"Último dia do lote " + (i + 1)} onChange={(e) => m({ ate: e.target.value })} />,
              ]} />
          </Bloco>
          <Bloco rotulo="Itens do kit">
            <ListaTextos itens={kitItens} onChange={setKitItens} rotulo="Item do kit" placeholder="Camiseta" textoNovo="Adicionar item do kit" />
          </Bloco>
          <Campo rotulo="Retirada do kit" dica="Local, datas e horários."><input type="text" maxLength={300} {...liga("retirada")} /></Campo>
          <Bloco rotulo="Programação" cheio>
            <LinhasEditaveis linhas={programacao} onChange={setProgramacao} textoNovo="Adicionar horário" novo={() => ({ h: "", a: "" })}
              cab={["Hora", "Atividade"]}
              celulas={(l, m, i) => [
                <input type="text" value={l.h} placeholder={i === 0 ? "06h30" : undefined} aria-label={"Hora " + (i + 1)} onChange={(e) => m({ h: e.target.value })} />,
                <input type="text" value={l.a} placeholder={i === 0 ? "Concentração" : undefined} aria-label={"Atividade " + (i + 1)} onChange={(e) => m({ a: e.target.value })} />,
              ]} />
          </Bloco>
          <Campo rotulo="Premiação"><input type="text" maxLength={300} {...liga("premiacao")} /></Campo>
          <Campo rotulo="Mapa do percurso (link)"><input type="url" {...liga("percurso_mapa")} /></Campo>
          <Campo rotulo="Regulamento (link)"><input type="url" {...liga("regulamento")} /></Campo>
          <Campo rotulo="Resultados (link)"><input type="url" {...liga("resultados")} /></Campo>
          <Campo rotulo="Fotos (link)"><input type="url" {...liga("fotos")} /></Campo>
          <Campo rotulo="Realização" dica="Quem realiza ou contrata a prova."><input type="text" maxLength={120} {...liga("realizacao")} /></Campo>
          <Campo rotulo="Hashtags" dica="Vão nos textos do kit de divulgação."><input type="text" placeholder="#corridaderua #bh" maxLength={200} {...liga("hashtags")} /></Campo>
          <Bloco rotulo="Perguntas frequentes" cheio dica={"Aparecem na página da prova, na seção \"Perguntas frequentes\". Sem perguntas, a seção não aparece."}>
            <LinhasEditaveis linhas={faq} onChange={setFaq} textoNovo="Adicionar pergunta" novo={() => ({ p: "", r: "" })}
              cab={["Pergunta", "Resposta"]}
              celulas={(l, m, i) => [
                <input type="text" value={l.p} placeholder={i === 0 ? "Posso retirar o kit de outra pessoa?" : undefined} aria-label={"Pergunta " + (i + 1)} onChange={(e) => m({ p: e.target.value })} />,
                <textarea rows={2} value={l.r} placeholder={i === 0 ? "Sim, com documento com foto e autorização assinada." : undefined} aria-label={"Resposta " + (i + 1)} onChange={(e) => m({ r: e.target.value })} />,
              ]} />
          </Bloco>
          <Campo rotulo="Texto de divulgação" dica="Opcional. Vazio = o kit monta o texto sozinho com os dados da prova." cheio>
            <textarea maxLength={1500} {...liga("texto_divulgacao")} />
          </Campo>
          <div className="assess-grid__full"><Marcador texto="Publicada (aparece no site)" checked={publicada} onChange={setPublicada} /></div>
          <BarraForm>
            <button type="submit" className="btn btn--red btn--lg" disabled={salvando}>{salvando ? "Salvando..." : "Salvar prova"}</button>
            <Botao onClick={() => cancelar("provas")}>Cancelar</Botao>
            {existe ? <Botao cls="orc__email painel-perigo" onClick={() => excluirProva(r0.id!)}>Excluir prova</Botao> : null}
          </BarraForm>
        </Form>
      </Card>
    </>
  );
}
