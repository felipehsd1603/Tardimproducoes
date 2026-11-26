// Aba Convites: um parceiro numa prova, com cupom, comissão, cortesias e (assessoria/equipe) a inscrição
// coletiva. Do convite saem os links (atletas, kit, coletiva) e a mensagem pronta para o WhatsApp.
import { useRef, useState } from "react";
import { api } from "../api.ts";
import { aviso, cancelar, falha, filtros, ir, muda, nav, usaEstado, voltarPara } from "../loja.tsx";
import { camposDa, opcoesProvas, parceiroPorId, provaPorId } from "../dados.ts";
import { Acoes, BarraForm, Bloco, Botao, Campo, Card, Escolha, Form, LinkExt, Situacao, Tabela, Trilha, pergunta, useCampos } from "../ui.tsx";
import { base, COMISSAO_PADRAO, copiar, dataDe, enc, hoje, numeroWa, quando, slug, TIPOS } from "../util.ts";
import type { Coletiva, Convite, AvisoPlataforma } from "../tipos.ts";

const coletivaDe = (cv: Partial<Convite>): Coletiva => (cv.coletiva && !Array.isArray(cv.coletiva) ? cv.coletiva as Coletiva : {});
const ehEquipe = (tipo?: string) => tipo === "assessoria" || tipo === "equipe";

// Resposta da assessoria ao convite de prova, dada no sistema dela (API v1)
function SeloConviteApi({ cv }: { cv: Convite }) {
  const [enviando, setEnviando] = useState(false);
  if (!cv.api_situacao) return null;
  const t = cv.api_situacao === "aceito" ? ["Aceito no sistema" + (cv.api_modo_pagamento === "ticketsports" ? " (paga na Ticket Sports)" : cv.api_modo_pagamento === "assessoria" ? " (PIX na assessoria)" : ""), "is-pub"]
    : cv.api_situacao === "recusado" ? ["Recusado no sistema", "is-off"] : ["Aguardando resposta no sistema", "is-rasc"];
  return (
    <span>
      {" "}<Situacao cls={t[1]} title={cv.api_motivo ? "Motivo: " + cv.api_motivo : undefined}>{t[0]}</Situacao>
      {/^erro/.test(cv.api_aviso || "") ? <>
        {" "}<Situacao cls="is-off" title={cv.api_aviso}>Aviso não entregue</Situacao>{" "}
        <Botao disabled={enviando} onClick={() => {
          setEnviando(true);
          api<{ aviso: AvisoPlataforma | null; convite: Convite }>("POST", "convites/" + encodeURIComponent(cv.id) + "/avisar", {}).then((r) => {
            muda((e) => ({ convites: e.convites.map((x) => (x.id === cv.id ? r.convite : x)) }));
            aviso(r.aviso && r.aviso.ok ? "Aviso entregue." : "Ainda não entregou: " + ((r.aviso && r.aviso.erro) || "erro") + ".", !(r.aviso && r.aviso.ok));
            setEnviando(false);
          }).catch((err) => { setEnviando(false); falha(err); });
        }}>Reenviar aviso</Botao>
      </> : null}
    </span>
  );
}

function excluirConvite(cv: Convite) {
  pergunta("Excluir o convite do cupom " + cv.cupom + "?", "O parceiro deixa de ver este convite. O cupom na Ticket Sports continua existindo.", "Excluir convite").then((sim) => {
    if (!sim) return;
    api("DELETE", "convites/" + encodeURIComponent(cv.id)).then(() => {
      muda((e) => ({ convites: e.convites.filter((x) => x.id !== cv.id) }));
      aviso("Convite excluído.");
    }).catch(falha);
  });
}

export function AbaConvites() {
  const { convites, parceiros } = usaEstado();
  const [prova, setProva] = useState(filtros.prova);
  filtros.prova = prova;
  const lista = convites.filter((x) => !prova || x.prova_id === prova);
  return (
    <Card passo="Divulgação" titulo="Convites">
      <p className="muted">Um convite liga um parceiro a uma prova, com o cupom criado na Ticket Sports. Dele saem o link para os atletas, o kit de divulgação e a mensagem pronta.</p>
      <div className="painel-filtros">
        <Campo rotulo="Prova"><Escolha opcoes={opcoesProvas(true)} value={prova} onChange={setProva} /></Campo>
        <Botao cls="btn btn--red" onClick={() => ir("convite/novo" + (prova ? "?prova=" + enc(prova) : ""))}>Novo convite</Botao>
      </div>
      <div>
        {!parceiros.length ? <p className="assess-alerta">Cadastre primeiro os parceiros na aba Parceiros.</p> : null}
        {!lista.length ? <p className="muted">{"Nenhum convite" + (prova ? " nesta prova." : " ainda.")}</p> : (
          <Tabela cab={["Prova", "Parceiro", "Cupom", "Comissão", "Cortesias", ""]} ids={lista.map((cv) => cv.id)} linhas={lista.map((cv) => {
            const pv = provaPorId(cv.prova_id), pa = parceiroPorId(cv.parceiro_id);
            return [
              pv ? pv.nome : cv.prova_id,
              <div><strong>{pa ? pa.nome : "(parceiro apagado)"}</strong>{pa ? <small className="muted">{" · " + TIPOS[pa.tipo]}</small> : null}<SeloConviteApi cv={cv} /></div>,
              <code className="painel-cupom">{cv.cupom}</code>,
              Number(cv.comissao_pct) ? String(cv.comissao_pct).replace(".", ",") + "%" : "—",
              cv.cortesias ? String(cv.cortesias) : "—",
              <Acoes>
                <Botao onClick={() => ir("convite/" + enc(cv.id) + "/links")}>Links e mensagem</Botao>
                <Botao onClick={() => ir("convite/" + enc(cv.id))}>Editar</Botao>
                <Botao cls="orc__email painel-perigo" onClick={() => excluirConvite(cv)}>Excluir</Botao>
              </Acoes>,
            ];
          })} />
        )}
      </div>
    </Card>
  );
}

const BENEFICIOS: [string, string][] = [["t", "Espaço para tenda"], ["k", "Retirada de kits em lote"], ["f", "Foto oficial da equipe"], ["e", "Ponto de encontro"]];

export function FormConvite({ cv: original, padrao }: { cv: Convite | null; padrao?: { prova_id?: string; parceiro_id?: string } }) {
  const { parceiros } = usaEstado();
  const cv: Partial<Convite> = original || Object.assign({ desconto: "", comissao_pct: COMISSAO_PADRAO, cortesias: 0 }, padrao || {});
  const ativos = parceiros.filter((p) => p.ativo || p.id === cv.parceiro_id);
  const futuras = opcoesProvas(false);
  const co = coletivaDe(cv);
  const provaInicial = cv.prova_id || (futuras.filter((o) => { const p = provaPorId(o[0]); return !!p && dataDe(p.data) >= hoje(); })[0] || futuras[0] || [""])[0];
  const { v, liga, muda: mudaCampo } = useCampos(() => ({
    prova_id: provaInicial, parceiro_id: cv.parceiro_id || (ativos[0] ? ativos[0].id : ""), cupom: cv.cupom || "", desconto: cv.desconto || "",
    comissao_pct: String(cv.comissao_pct ?? 0), cortesias: String(cv.cortesias ?? 0), contrapartida: cv.contrapartida || "", condicoes: cv.condicoes || "",
    d: co.d || "", i: co.i || "", m: co.m ? String(co.m) : "", val: co.v ? String(co.v) : "", g: co.g || "", kt: co.kt || "", pe: co.pe || "",
  }));
  const [faixas, setFaixas] = useState<[string, string][]>([0, 1, 2].map((i) => { const p = (co.f || [])[i] || []; return [p[0] ? String(p[0]) : "", p[1] ? String(p[1]) : ""]; }));
  const [benef, setBenef] = useState(String(co.b || ""));
  const [salvando, setSalvando] = useState(false);
  const cupomRef = useRef<HTMLInputElement>(null);

  if (!ativos.length) {
    return (
      <>
        <Trilha aba="convites" atual={original ? "Editar convite" : "Novo convite"} />
        <Card passo={original ? "Editar convite" : "Novo convite"} titulo="Parceiro na prova">
          <p className="assess-alerta">Cadastre um parceiro antes de criar convites.</p>
          <Botao cls="btn btn--red" onClick={() => ir("parceiros")}>Ir para Parceiros</Botao>
        </Card>
      </>
    );
  }
  const pa = parceiroPorId(v.parceiro_id);
  const coletiva = !!pa && ehEquipe(pa.tipo);

  function salvar() {
    const cod = v.cupom.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,40}$/.test(cod)) return aviso("O cupom precisa ter de 3 a 40 letras, números, hífen ou sublinhado, sem espaços nem acentos.", true);
    if (!v.prova_id) return aviso("Escolha a prova.", true);
    const linha = {
      prova_id: v.prova_id, parceiro_id: v.parceiro_id, cupom: cod, desconto: v.desconto.trim(),
      comissao_pct: Number(v.comissao_pct) || 0, cortesias: parseInt(v.cortesias, 10) || 0,
      contrapartida: v.contrapartida.trim(), condicoes: v.condicoes.trim(),
      coletiva: {
        d: v.d, m: parseInt(v.m, 10) || 0, i: v.i,
        v: Number(v.val) > 0 ? Math.round(Number(v.val) * 100) / 100 : 0,
        f: faixas.map((p): [number, number] => [Math.floor(Number(p[0])) || 0, Number(p[1]) || 0])
          .filter((p) => p[0] > 0 && p[1] > 0 && p[1] <= 100).sort((a, b) => a[0] - b[0]),
        g: v.g.trim(), b: BENEFICIOS.map((b) => b[0]).filter((k) => benef.indexOf(k) >= 0).join(""),
        kt: v.kt.trim(), pe: v.pe.trim(),
      },
    };
    const pvEsc = provaPorId(v.prova_id);
    if (linha.coletiva.d && pvEsc && pvEsc.data && linha.coletiva.d > pvEsc.data) return aviso("O prazo da inscrição coletiva não pode ser depois da data da prova.", true);
    setSalvando(true);
    const q = original ? api<Convite>("PUT", "convites/" + encodeURIComponent(original.id), linha) : api<Convite>("POST", "convites", linha);
    q.then((salvo) => {
      muda((e) => ({ convites: [salvo].concat(e.convites.filter((x) => x.id !== salvo.id)) }));
      filtros.prova = salvo.prova_id;
      // O formulário sai do histórico: Voltar a partir dos links leva à lista
      nav.sujo = false;
      location.replace("#convite/" + enc(salvo.id) + "/links");
      aviso("Convite salvo. Confira se o cupom " + cod + " existe na Ticket Sports.");
    }).catch((err) => { setSalvando(false); falha(err); });
  }

  return (
    <>
      <Trilha aba="convites" atual={original ? "Editar convite" : "Novo convite"} />
      <Card passo={original ? "Editar convite" : "Novo convite"} titulo="Parceiro na prova">
        <Form onSubmit={salvar}>
          <Campo rotulo="Prova"><Escolha opcoes={futuras} value={v.prova_id} onChange={(x) => mudaCampo("prova_id", x)} /></Campo>
          <Campo rotulo="Parceiro"><Escolha opcoes={ativos.map((p): [string, string] => [p.id, p.nome + " · " + TIPOS[p.tipo]])} value={v.parceiro_id} onChange={(x) => mudaCampo("parceiro_id", x)} /></Campo>
          <Bloco rotulo="Cupom" dica="Crie igualzinho na Ticket Sports: Promover > Cupons de desconto, tipo individual, vinculado às modalidades.">
            <input ref={cupomRef} type="text" maxLength={40} required placeholder="Ex.: ANA10" aria-label="Cupom" value={v.cupom} onChange={(e) => {
              const el = e.target, pos = el.selectionStart;
              mudaCampo("cupom", el.value.toUpperCase());
              requestAnimationFrame(() => { if (pos != null && document.activeElement === el) el.setSelectionRange(pos, pos); });
            }} />
            <Botao onClick={() => {
              const primeiro = slug(pa ? pa.nome : "").split("-")[0] || "TARDIM";
              mudaCampo("cupom", (primeiro.toUpperCase().slice(0, 12) + (v.desconto.replace(/\D/g, "") || "")).slice(0, 40));
            }}>Sugerir cupom</Botao>
          </Bloco>
          <Campo rotulo="Desconto do cupom" dica="Só para aparecer na mensagem e no kit. O desconto de verdade é o da Ticket Sports."><input type="text" placeholder="10%" maxLength={20} {...liga("desconto")} /></Campo>
          <Campo rotulo="Comissão (% por inscrição paga)" dica="10% para todas as categorias, para ninguém ter benefício maior que o outro."><input type="number" min={0} max={100} step={0.5} {...liga("comissao_pct")} /></Campo>
          <Campo rotulo="Cortesias" dica="Inscrições gratuitas para o próprio parceiro."><input type="number" min={0} max={50} step={1} {...liga("cortesias")} /></Campo>
          <Campo rotulo="Contrapartida da cortesia" cheio><input type="text" maxLength={300} placeholder="Ex.: 2 posts no feed e 3 stories até 01/12" {...liga("contrapartida")} /></Campo>
          <Campo rotulo="Outras condições" dica="Vão na mensagem do convite." cheio><textarea maxLength={1000} {...liga("condicoes")} /></Campo>

          {/* Inscrição coletiva (só assessoria e equipe): as condições que vão no link de assessorias.html */}
          {coletiva ? <>
            <div className="assess-grid__full convite-sec">
              <h3>Inscrição coletiva</h3>
              <p className="muted">Só para assessoria e equipe. Tudo opcional: o que ficar em branco não aparece para a assessoria. As cortesias são as do campo acima.</p>
            </div>
            <Campo rotulo="Prazo para enviar a planilha" dica="Depois dessa data o link para de funcionar."><input type="date" {...liga("d")} /></Campo>
            <Campo rotulo="Limite de atletas"><input type="number" min={0} step={1} placeholder="Sem limite" {...liga("m")} /></Campo>
            <Campo rotulo="Prazo interno dos atletas" dica="Aparece na página da equipe. Em branco, usa o prazo acima."><input type="date" {...liga("i")} /></Campo>
            <Campo rotulo="Valor por atleta (R$)" dica="A assessoria vê o combinado e o total estimado."><input type="number" min={0} step={0.01} placeholder="Ex.: 89,90" {...liga("val")} /></Campo>
            <Bloco rotulo="Desconto por volume (até 3 faixas)" cheio>
              <div className="convite-faixas">
                {faixas.map((f, i) => (
                  <div className="convite-faixa" key={i}>
                    <span>A partir de</span>
                    <input type="number" min={0} step={1} placeholder="Atletas" aria-label={"Faixa " + (i + 1) + ": a partir de quantos atletas"} value={f[0]}
                      onChange={(e) => setFaixas(faixas.map((x, n) => (n === i ? [e.target.value, x[1]] : x)))} />
                    <span>atletas:</span>
                    <input type="number" min={0} step={0.5} placeholder="% desc." aria-label={"Faixa " + (i + 1) + ": desconto em %"} value={f[1]}
                      onChange={(e) => setFaixas(faixas.map((x, n) => (n === i ? [x[0], e.target.value] : x)))} />
                    <span>%</span>
                  </div>
                ))}
              </div>
            </Bloco>
            <Campo rotulo="Forma de pagamento" cheio><input type="text" maxLength={80} placeholder="Ex.: Pix único até 5 dias antes da prova" {...liga("g")} /></Campo>
            <Bloco rotulo="Benefícios no dia da prova" cheio>
              <div className="convite-benef">
                {BENEFICIOS.map((b) => (
                  <label className="assess-toggle" key={b[0]}>
                    <input type="checkbox" value={b[0]} checked={benef.indexOf(b[0]) >= 0}
                      onChange={(e) => setBenef(e.target.checked ? benef + b[0] : benef.split(b[0]).join(""))} />{" " + b[1]}
                  </label>
                ))}
              </div>
            </Bloco>
            <Campo rotulo="Retirada de kits (dia, horário, local)"><input type="text" maxLength={90} placeholder="Ex.: sábado, 9h às 10h, na loja X" {...liga("kt")} /></Campo>
            <Campo rotulo="Ponto de encontro"><input type="text" maxLength={90} placeholder="Ex.: ao lado do pórtico, às 6h30" {...liga("pe")} /></Campo>
          </> : null}
          <BarraForm>
            <button type="submit" className="btn btn--red btn--lg" disabled={salvando}>Salvar convite</button>
            <Botao onClick={() => cancelar("convites")}>Cancelar</Botao>
          </BarraForm>
        </Form>
      </Card>
    </>
  );
}

function linksConvite(cv: Convite): { atleta: string; kit: string; coletiva?: string } {
  const pa = parceiroPorId(cv.parceiro_id) || { nome: "", tipo: "", id: "", responsavel: "", whatsapp: "", cor: "", logo: "" };
  const b = base();
  const l: { atleta: string; kit: string; coletiva?: string } = {
    atleta: b + "prova-" + cv.prova_id + ".html?cupom=" + encodeURIComponent(cv.cupom),
    kit: b + "kit.html?p=" + encodeURIComponent(cv.prova_id) + "&c=" + encodeURIComponent(cv.cupom) + "&n=" + encodeURIComponent(pa.nome) +
      (cv.desconto ? "&d=" + encodeURIComponent(cv.desconto) : ""),
  };
  if (ehEquipe(pa.tipo) && window.CONVITE) {
    const co = coletivaDe(cv);
    l.coletiva = b + "assessorias.html?c=" + window.CONVITE.gera({
      p: cv.prova_id, e: pa.nome, d: co.d || "", m: co.m || 0, a: pa.id, t: pa.responsavel || "",
      w: numeroWa(pa.whatsapp), c: (pa.cor || "").replace(/^#/, ""), l: pa.logo || "", k: cv.cortesias || 0,
      v: co.v, f: co.f, g: co.g, b: co.b, kt: co.kt, pe: co.pe, i: co.i,
    });
  }
  return l;
}

function mensagem(cv: Convite): string {
  const pa = parceiroPorId(cv.parceiro_id) || { nome: "", responsavel: "" };
  const pv = provaPorId(cv.prova_id) || { nome: cv.prova_id, data: "" };
  const l = linksConvite(cv);
  const partes = ["Olá, " + (pa.responsavel || pa.nome) + "! Aqui está o seu material de divulgação da " + pv.nome + (pv.data ? " (" + quando(pv.data) + ")" : "") + "."];
  partes.push("Seu link para os atletas:\n" + l.atleta);
  partes.push("Seu cupom: " + cv.cupom + (cv.desconto ? " (" + cv.desconto + " de desconto)" : ""));
  partes.push("Kit com a arte, textos prontos e card para stories:\n" + l.kit);
  if (l.coletiva) partes.push("Inscrição coletiva da equipe (planilha):\n" + l.coletiva);
  const cond = [];
  if (Number(cv.comissao_pct)) cond.push("comissão de " + String(cv.comissao_pct).replace(".", ",") + "% sobre cada inscrição paga com o seu cupom");
  if (cv.cortesias) cond.push(cv.cortesias + (cv.cortesias > 1 ? " inscrições" : " inscrição") + " de cortesia para você" + (cv.contrapartida ? ", em troca de: " + cv.contrapartida : ""));
  if (cond.length) partes.push("Condições: " + cond.join("; ") + ".");
  if (cv.condicoes) partes.push(cv.condicoes);
  partes.push("Regras do programa:\n" + base() + "programa-embaixadores.html");
  partes.push("Tardim Produções");
  return partes.join("\n\n");
}

function BotaoCopiar({ texto, cls, children }: { texto: string; cls?: string; children: string }) {
  return <Botao cls={cls} onClick={(b) => copiar(texto, b)}>{children}</Botao>;
}

export function DetalheConvite({ cv }: { cv: Convite }) {
  const pa = parceiroPorId(cv.parceiro_id) || { nome: "", whatsapp: "", responsavel: "" };
  const pv = provaPorId(cv.prova_id);
  const [msg, setMsg] = useState(() => mensagem(cv));
  const l = linksConvite(cv);
  const numero = numeroWa(pa.whatsapp);
  const links: [string, string][] = [["Link para os atletas", l.atleta], ["Kit de divulgação", l.kit]];
  if (l.coletiva) links.push(["Inscrição coletiva", l.coletiva]);
  return (
    <>
      <Trilha aba="convites" atual="Links e mensagem" />
      <Card passo="Convite pronto" titulo={pa.nome}>
        <p className="muted">{(pv ? pv.nome : cv.prova_id) + " · cupom " + cv.cupom}</p>
        {pv && pv.fonte === "rascunho" ? <p className="assess-alerta">Esta prova está como rascunho: a página dela só existe depois de publicada.</p> : null}
        {!camposDa(pv).inscricao ? <p className="assess-alerta">Esta prova ainda não tem o link da Ticket Sports: o botão de inscrição vai abrir o Linktree.</p> : null}
        <div className="painel-links">
          {links.map((x) => (
            <div className="convite-link" key={x[0]}>
              <span className="painel-links__t">{x[0]}</span>
              <input type="text" readOnly value={x[1]} aria-label={x[0]} onFocus={(e) => e.target.select()} />
              <Acoes><BotaoCopiar texto={x[1]}>Copiar</BotaoCopiar><LinkExt href={x[1]}>Abrir</LinkExt></Acoes>
            </div>
          ))}
        </div>
        <Campo rotulo="Mensagem para o parceiro (pode editar antes de enviar)" cheio className="painel-msg">
          <textarea value={msg} onChange={(e) => setMsg(e.target.value)} />
        </Campo>
        <Acoes>
          <a className="btn btn--wa" target="_blank" rel="noopener" href={"https://wa.me/" + numero + "?text=" + encodeURIComponent(msg)}>
            {numero ? "Enviar no WhatsApp de " + (pa.responsavel || pa.nome) : "Enviar no WhatsApp"}
          </a>
          <BotaoCopiar texto={msg} cls="btn btn--line">Copiar mensagem</BotaoCopiar>
          <Botao onClick={() => ir("convite/" + enc(cv.id))}>Editar convite</Botao>
          <Botao onClick={() => voltarPara("convites")}>Voltar para os convites</Botao>
        </Acoes>
      </Card>
    </>
  );
}
