// Painel: confere a sessão, mostra o login ou o painel (topo, abas e a tela da rota).
import { useEffect, useRef, useState } from "react";
import { api } from "./api.ts";
import { abre, aviso, falha, hashchange, ir, muda, nav, pega, rotaDoEndereco, telaLogin, usaEstado } from "./loja.tsx";
import { AvisoFlutuante, Botao, Campo, Card, Dialogos, NOME_ABA } from "./ui.tsx";
import { Rotas } from "./Rotas.tsx";
import type { Dados } from "./tipos.ts";

const ABAS = Object.keys(NOME_ABA);

export async function carregar(): Promise<void> {
  const d = await api<Dados>("GET", "dados");
  muda({
    provas: d.provas, parceiros: d.parceiros, convites: d.convites,
    depoimentos: d.depoimentos || [], semDepoimentos: !d.depoimentos, // null = banco sem a tabela
    orcamentos: null, inscricoes: null, propostas: null, minutario: null, config: null,
  });
}
// Cadastros feitos pelo site (parceiro.html) que ainda não foram aprovados nem recusados
export const pendentes = () => pega().parceiros.filter((p) => p.situacao === "pendente");

function entrar(): void {
  carregar().then(() => {
    const n = pendentes().length;
    const inicial = rotaDoEndereco() || (n ? "parceiros" : "provas");
    history.replaceState(null, "", "#" + inicial);
    nav.rotaAnterior = "";
    muda({ tela: "painel" });
    abre(inicial);
    if (n) aviso(n === 1 ? "1 cadastro novo de parceiro aguardando aprovação." : n + " cadastros novos de parceiros aguardando aprovação.",
      false, pega().aba !== "parceiros" ? ["Ver agora", () => ir("parceiros")] : null);
  }).catch(falha);
}
function sair(): void { api("POST", "sair").then(() => telaLogin(), () => telaLogin()); }

function Login({ msg }: { msg: string }) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(msg);
  const [entrando, setEntrando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => { campo.current?.focus(); }, []);
  return (
    <Card passo="Área restrita" titulo="Entrar no painel">
      <form className="assess-grid" noValidate onSubmit={(e) => {
        e.preventDefault();
        if (!senha) { setErro("Informe a senha."); return; }
        setEntrando(true);
        api("POST", "login", { senha }).then(entrar).catch((err: Error) => {
          setEntrando(false);
          setErro(err.message || "Não consegui entrar.");
          campo.current?.select();
        });
      }}>
        <Campo rotulo="Senha do painel" cheio>
          <input ref={campo} type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        </Campo>
        <button type="submit" className="btn btn--red btn--lg assess-grid__full" disabled={entrando}>{entrando ? "Entrando..." : "Entrar"}</button>
      </form>
      <p className="orc__erro" hidden={!erro}>{erro}</p>
    </Card>
  );
}

function SemApi({ msg }: { msg: string }) {
  return (
    <Card passo="Primeiro acesso" titulo="Ligar o painel ao Cloudflare">
      {msg ? <p className="assess-alerta">{msg}</p> : null}
      <ol className="painel-passos">
        <li>O painel funciona no site publicado no Cloudflare Pages (com o banco D1 "tardim" ligado como DB), ou localmente com npx wrangler pages dev.</li>
        <li>Crie as tabelas do painel: npx wrangler d1 execute tardim --remote --file d1/painel.sql</li>
        <li>Defina a senha do painel e o segredo da sessão: npx wrangler pages secret put ADMIN_SENHA e npx wrangler pages secret put SESSAO_SEGREDO (um texto longo e aleatório).</li>
        <li>Publique o site de novo e abra esta página.</li>
      </ol>
    </Card>
  );
}

function Painel() {
  const s = usaEstado();
  const [atualizando, setAtualizando] = useState(false);
  const n = s.parceiros.filter((p) => p.situacao === "pendente").length;
  const abas = useRef<HTMLElement>(null);
  useEffect(() => {
    window.addEventListener("hashchange", hashchange);
    const antesDeSair = (e: BeforeUnloadEvent) => { if (nav.sujo) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", antesDeSair);
    return () => { window.removeEventListener("hashchange", hashchange); window.removeEventListener("beforeunload", antesDeSair); };
  }, []);
  useEffect(() => {
    const ativa = abas.current?.querySelector('[aria-current="page"]');
    if (ativa && ativa.scrollIntoView) ativa.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [s.aba]);
  return (
    <>
      <div className="painel-top">
        <div className="painel-top__tit">
          <h1>Painel</h1>
          <p className="muted">Provas, parceiros, convites e o que chega pelo site.</p>
        </div>
        <div className="painel-acoes-linha">
          <Botao cls="btn btn--line btn--sm" disabled={atualizando} onClick={() => {
            setAtualizando(true);
            carregar().then(() => { setAtualizando(false); abre(pega().rota); aviso("Dados atualizados."); })
              .catch((e) => { setAtualizando(false); falha(e); });
          }}>Atualizar dados</Botao>
          <Botao onClick={sair}>Sair</Botao>
        </div>
      </div>
      {/* As abas são links (#provas, #parceiros...): o Voltar do navegador e o F5 mantêm a tela */}
      <nav className="cal-tabs painel-abas" aria-label="Seções do painel" ref={abas}>
        {ABAS.map((a) => {
          const atual = a === s.aba;
          return (
            <a key={a} className="cal-tab" href={"#" + a} data-aba={a} aria-current={atual ? "page" : undefined} aria-pressed={atual ? "true" : "false"}>
              {NOME_ABA[a]}
              {a === "parceiros" && n ? <span className="cal-tab__n" title={n === 1 ? "1 cadastro novo" : n + " cadastros novos"}>{n}</span> : null}
            </a>
          );
        })}
      </nav>
      <div className="painel-corpo">
        <Rotas key={s.rota + ":" + s.versao} rota={s.rota} />
      </div>
    </>
  );
}

export function App() {
  const s = usaEstado();
  useEffect(() => {
    fetch("api/admin/sessao", { credentials: "same-origin" }).then(async (r) => {
      const t = await r.text();
      let j: { mensagem?: string } | null = null;
      try { j = JSON.parse(t); } catch (e) { j = null; }
      if (r.ok && j) return entrar();
      if (r.status === 401 && j) return telaLogin();
      muda({ tela: "semApi", msgTela: j && j.mensagem ? j.mensagem : "" });
    }).catch(() => muda({ tela: "semApi", msgTela: "" }));
  }, []);
  return (
    <>
      <AvisoFlutuante />
      {s.tela === "carregando" ? <p className="muted">Carregando...</p>
        : s.tela === "login" ? <Login key={s.msgTela + s.versao} msg={s.msgTela} />
        : s.tela === "semApi" ? <SemApi msg={s.msgTela} />
        : <Painel />}
      <Dialogos />
    </>
  );
}
