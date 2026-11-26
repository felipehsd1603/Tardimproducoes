// Listas editáveis em linhas (uma linha por item, com botões), no lugar do texto com separadores ("a | b").
import type { ReactNode } from "react";
import { marcaSujo } from "./loja.tsx";
import { Acoes, Botao } from "./ui.tsx";

/**
 * Tabela em que cada linha é um item editável. celulas() devolve as células da linha (os campos);
 * as últimas colunas são Subir, Descer e Remover.
 */
export function LinhasEditaveis<T>({ linhas, onChange, novo, textoNovo, cab, celulas, vazio }: {
  linhas: T[]; onChange: (l: T[]) => void; novo: () => T; textoNovo: string; cab: string[];
  celulas: (l: T, muda: (p: Partial<T>) => void, i: number) => ReactNode[]; vazio?: string;
}) {
  const muda = (i: number) => (p: Partial<T>) => onChange(linhas.map((x, n) => (n === i ? { ...x, ...p } : x)));
  const troca = (i: number, j: number) => {
    if (j < 0 || j >= linhas.length) return;
    const l = linhas.slice(); [l[i], l[j]] = [l[j], l[i]]; onChange(l); marcaSujo();
  };
  return (
    <div className="painel-linhas">
      {linhas.length ? (
        <div className="painel-tab">
          <table>
            <thead><tr>{cab.map((h) => <th key={h}>{h}</th>)}<th><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={i}>
                  {celulas(l, muda(i), i).map((c, k) => <td key={k}>{c}</td>)}
                  <td>
                    <Acoes className="painel-linhas__acoes">
                      <Botao title="Subir" disabled={i === 0} onClick={() => troca(i, i - 1)}>↑</Botao>
                      <Botao title="Descer" disabled={i === linhas.length - 1} onClick={() => troca(i, i + 1)}>↓</Botao>
                      <Botao cls="orc__email painel-perigo" onClick={() => { onChange(linhas.filter((_, n) => n !== i)); marcaSujo(); }}>Remover</Botao>
                    </Acoes>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : vazio ? <p className="muted">{vazio}</p> : null}
      <Acoes><Botao cls="btn btn--line btn--sm" onClick={() => { onChange([...linhas, novo()]); marcaSujo(); }}>{textoNovo}</Botao></Acoes>
    </div>
  );
}

/** Lista de textos simples (percursos, itens do kit): uma linha por item */
export function ListaTextos({ itens, onChange, rotulo, placeholder, textoNovo, max }: {
  itens: string[]; onChange: (l: string[]) => void; rotulo: string; placeholder?: string; textoNovo: string; max?: number;
}) {
  return (
    <LinhasEditaveis linhas={itens.map((t) => ({ t }))} onChange={(l) => onChange(l.map((x) => x.t))} novo={() => ({ t: "" })}
      textoNovo={textoNovo} cab={[rotulo]}
      celulas={(l, muda, i) => [<input type="text" value={l.t} maxLength={max} placeholder={i === 0 ? placeholder : undefined}
        aria-label={rotulo + " " + (i + 1)} onChange={(e) => muda({ t: e.target.value })} />]} />
  );
}
