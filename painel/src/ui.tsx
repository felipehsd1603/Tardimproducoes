// Peças de tela do painel, com as mesmas classes do painel antigo (css/style.css e css/painel.css).
import { Children, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type ChangeEvent } from "react";
import { abreDialogo, cancelar, definePerguntaSair, fechaAviso, marcaSujo, nav, tiraDialogo, usaEstado, type Dialogo } from "./loja.tsx";

export const NOME_ABA: Record<string, string> = {
  provas: "Provas", parceiros: "Parceiros", convites: "Convites", apuracao: "Apuração", inscricoes: "Inscrições coletivas", pagamentos: "Pagas no site",
  avisos: "Me avise", orcamentos: "Orçamentos", propostas: "Propostas", depoimentos: "Depoimentos", medicao: "Medição",
};

export function Campo({ rotulo, dica, cheio, className, children }: { rotulo: ReactNode; dica?: ReactNode; cheio?: boolean; className?: string; children?: ReactNode }) {
  return (
    <label className={"orc__field" + (cheio ? " assess-grid__full" : "") + (className ? " " + className : "")}>
      <span>{rotulo}</span>
      {children}
      {dica ? <small className="assess-dica">{dica}</small> : null}
    </label>
  );
}
/** Igual ao Campo, mas em <div> (para quando há botões ou mais de uma entrada dentro) */
export function Bloco({ rotulo, dica, cheio, className, children }: { rotulo: ReactNode; dica?: ReactNode; cheio?: boolean; className?: string; children?: ReactNode }) {
  return (
    <div className={"orc__field" + (cheio ? " assess-grid__full" : "") + (className ? " " + className : "")}>
      <span>{rotulo}</span>
      {children}
      {dica ? <small className="assess-dica">{dica}</small> : null}
    </div>
  );
}

export function Card({ passo, titulo, className, children }: { passo?: ReactNode; titulo?: ReactNode; className?: string; children?: ReactNode }) {
  return (
    <section className={"assess-card" + (className ? " " + className : "")}>
      {passo ? <p className="assess-card__step">{passo}</p> : null}
      {titulo ? <h2>{titulo}</h2> : null}
      {children}
    </section>
  );
}

export function Situacao({ cls, title, children }: { cls: string; title?: string; children: ReactNode }) {
  return <span className={"painel-sit " + cls} title={title}>{children}</span>;
}

export function Acoes({ className, children }: { className?: string; children?: ReactNode }) {
  return <div className={"painel-acoes-linha" + (className ? " " + className : "")}>{Children.toArray(children).filter(Boolean)}</div>;
}
export function BarraForm({ children }: { children?: ReactNode }) {
  return <Acoes className="painel-barra">{children}</Acoes>;
}

type BotaoProps = { cls?: string; onClick?: (b: HTMLButtonElement) => void; disabled?: boolean; children: ReactNode; title?: string };
export function Botao({ cls, onClick, disabled, children, title }: BotaoProps) {
  return <button type="button" className={cls ?? "orc__email"} disabled={disabled} title={title} onClick={(e) => onClick?.(e.currentTarget)}>{children}</button>;
}
/** Botão que fica desabilitado enquanto a ação (promessa) roda; texto opcional durante a espera */
export function BotaoAcao({ cls, acao, children, esperando }: { cls?: string; acao: () => Promise<unknown> | void; children: ReactNode; esperando?: ReactNode }) {
  const [rodando, setRodando] = useState(false);
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);
  return (
    <button type="button" className={cls ?? "orc__email"} disabled={rodando} onClick={() => {
      const r = acao();
      if (r && typeof (r as Promise<unknown>).then === "function") {
        setRodando(true);
        (r as Promise<unknown>).then(() => { if (vivo.current) setRodando(false); }, () => { if (vivo.current) setRodando(false); });
      }
    }}>{rodando && esperando ? esperando : children}</button>
  );
}
export function LinkExt({ href, cls, children }: { href: string; cls?: string; children: ReactNode }) {
  return <a className={cls ?? "orc__email"} href={href} target="_blank" rel="noopener">{children}</a>;
}

export function Marcador({ texto, checked, onChange, className }: { texto: ReactNode; checked: boolean; onChange: (v: boolean) => void; className?: string }) {
  return (
    <label className={"assess-toggle" + (className ? " " + className : "")}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{texto}</span>
    </label>
  );
}

export function Escolha({ opcoes, value, onChange, ...resto }: { opcoes: [string, string][]; value: string; onChange: (v: string) => void; "aria-label"?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} {...resto}>
      {opcoes.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}
    </select>
  );
}

/** ids (opcional): um por linha, para destacar o item recém-salvo */
export function Tabela({ cab, linhas, ids }: { cab: ReactNode[]; linhas: ReactNode[][]; ids?: (string | number)[] }) {
  const corpo = useRef<HTMLTableSectionElement>(null);
  useLayoutEffect(() => {
    if (nav.destaque == null || !corpo.current) return;
    const tr = corpo.current.querySelector('tr[data-id="' + String(nav.destaque).replace(/["\\]/g, "") + '"]');
    if (tr) { nav.destaque = null; tr.classList.add("is-novo"); tr.scrollIntoView({ block: "center" }); }
  }, []);
  return (
    <div className="painel-tab">
      <table>
        <thead><tr>{cab.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody ref={corpo}>
          {linhas.map((cels, n) => (
            <tr key={ids && ids[n] != null ? String(ids[n]) : n} data-id={ids && ids[n] != null ? String(ids[n]) : undefined}>
              {cels.map((c, i) => <td key={i}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** "← Voltar" e o caminho (Convites › Editar convite) no topo de cada formulário */
export function Trilha({ aba, atual }: { aba: string; atual: string }) {
  return (
    <nav className="painel-trilha" aria-label="Você está em">
      <Botao cls="painel-voltar" onClick={() => cancelar(aba)}>← Voltar</Botao>
      <ol>
        <li><a href={"#" + aba}>{NOME_ABA[aba]}</a></li>
        <li aria-current="page">{atual}</li>
      </ol>
    </nav>
  );
}

export function Secao({ titulo, sub }: { titulo: string; sub?: string }) {
  return <div className="assess-grid__full convite-sec"><h3>{titulo}</h3>{sub ? <p className="muted">{sub}</p> : null}</div>;
}

/** Formulário do painel: marca como alterado ao digitar (para avisar antes de sair sem salvar) */
export function Form({ onSubmit, className, children }: { onSubmit: () => void; className?: string; children: ReactNode }) {
  return (
    <form className={className ?? "assess-grid"} noValidate onInput={marcaSujo} onChange={marcaSujo}
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      {children}
    </form>
  );
}

/** Estado de um formulário: v = valores, liga("campo") = { value, onChange } para <input>/<textarea>/<select> */
export function useCampos<T extends Record<string, unknown>>(inicial: () => T) {
  const [v, setV] = useState<T>(inicial);
  const muda = <K extends keyof T>(k: K, x: T[K]) => setV((a) => ({ ...a, [k]: x }));
  const liga = (k: keyof T & string) => ({
    value: (v[k] ?? "") as string,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => muda(k, e.target.value as T[typeof k]),
  });
  return { v, muda, liga, setV };
}

// ---------- aviso flutuante ----------
export function AvisoFlutuante() {
  const { aviso } = usaEstado();
  if (!aviso) return null;
  return (
    <div key={aviso.id} className={"painel-aviso" + (aviso.erro ? " is-erro" : "")} role={aviso.erro ? "alert" : "status"}>
      <span>{aviso.msg}</span>
      {aviso.link ? <Botao cls="painel-aviso__link" onClick={aviso.link[1]}>{aviso.link[0]}</Botao> : null}
      <Botao cls="painel-aviso__x" onClick={fechaAviso}>Fechar</Botao>
    </div>
  );
}

// ---------- caixas de diálogo ----------
function CaixaDialogo({ d }: { d: Dialogo }) {
  const ref = useRef<HTMLDialogElement>(null);
  const valor = useRef<unknown>(d.padrao);
  useEffect(() => {
    const dlg = ref.current!;
    const fechou = () => { tiraDialogo(d.id); d.resolve(valor.current); };
    dlg.addEventListener("close", fechou);
    if (!dlg.open) dlg.showModal();
    const foco = dlg.querySelector<HTMLElement>("[data-foco]");
    if (foco) foco.focus();
    return () => dlg.removeEventListener("close", fechou);
  }, [d]);
  const fecha = (v: unknown) => { valor.current = v; ref.current?.close(); };
  return <dialog ref={ref} className={d.classe}>{d.render(fecha)}</dialog>;
}
export function Dialogos() {
  const { dialogos } = usaEstado();
  return <>{dialogos.map((d) => <CaixaDialogo key={d.id} d={d} />)}</>;
}

function Pergunta({ titulo, texto, sim, nao, campo, valorInicial, fecha }: {
  titulo: string; texto?: string; sim: string; nao?: string; campo?: string; valorInicial?: string; fecha: (v: boolean | string | null) => void;
}) {
  const [txt, setTxt] = useState(valorInicial || "");
  return (
    <form onSubmit={(e) => { e.preventDefault(); fecha(campo ? txt : true); }}>
      <h2>{titulo}</h2>
      {texto ? <p>{texto}</p> : null}
      {campo ? <Campo rotulo={campo}><textarea maxLength={300} rows={3} value={txt} onChange={(e) => setTxt(e.target.value)} data-foco /></Campo> : null}
      <div className="painel-dialogo__acoes">
        <button type="button" className="btn btn--line" onClick={() => fecha(campo ? null : false)} data-foco={campo ? undefined : true}>{nao || "Cancelar"}</button>
        <button type="submit" className="btn btn--red">{sim}</button>
      </div>
    </form>
  );
}
/** Confirmação dentro da página. Devolve true/false. */
export function pergunta(titulo: string, texto: string, sim: string, op: { nao?: string } = {}): Promise<boolean> {
  return abreDialogo<boolean>(false, (fecha) => <Pergunta titulo={titulo} texto={texto} sim={sim} nao={op.nao} fecha={(v) => fecha(!!v)} />);
}
/** Confirmação com um campo de texto. Devolve o texto digitado ou null se cancelar. */
export function perguntaTexto(titulo: string, texto: string, sim: string, campo: string, valor = ""): Promise<string | null> {
  return abreDialogo<string | null>(null, (fecha) => <Pergunta titulo={titulo} texto={texto} sim={sim} campo={campo} valorInicial={valor} fecha={(v) => fecha(typeof v === "string" ? v : null)} />);
}
definePerguntaSair(() => pergunta("Sair sem salvar?", "O que você digitou neste formulário vai se perder.", "Sair sem salvar", { nao: "Continuar editando" }));
