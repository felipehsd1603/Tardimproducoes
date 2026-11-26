// Aba Parceiros: cadastros aguardando aprovação, lista com filtros, formulário (CREF6, Instagram, YouTube, logo e cor)
// e a integração com o sistema da assessoria (API v1: convite de conexão, reenviar, cancelar, desconectar).
import { useEffect, useRef, useState } from "react";
import { api, enviaImagem, urlArquivo } from "../api.ts";
import { aviso, cancelar, falha, filtros, ir, muda, nav, pega, usaEstado, voltarPara } from "../loja.tsx";
import { Acoes, BarraForm, Bloco, Botao, Campo, Card, Escolha, Form, LinkExt, Marcador, Situacao, Tabela, Trilha, pergunta, perguntaTexto, useCampos } from "../ui.tsx";
import { base, cidadeUf, comprimeLogo, dataCurtaHora, enc, linkWa, mascaraTel, PROFISSOES, semArroba, seguidoresTxt, slug, TIPOS, UFS } from "../util.ts";
import type { Conexao, Integracao, Integracoes, Parceiro } from "../tipos.ts";

const opcoesTipo = Object.keys(TIPOS).map((k): [string, string] => [k, TIPOS[k]]);
const linkInsta = (u: string) => "https://www.instagram.com/" + semArroba(u) + "/";

// Instagram conferido pela API da Meta (functions/_lib/instagram.ts, rota parceiros/<id>/instagram)
function SelosInsta({ p }: { p: Parceiro }) {
  if (!p.instagram) return null;
  if (p.ig_situacao === "ok") {
    const titulo = "Conferido em " + new Date(p.ig_conferido_em).toLocaleDateString("pt-BR") + " · " + Number(p.ig_posts || 0).toLocaleString("pt-BR") + " posts";
    return (
      <span>
        {" "}<Situacao cls="is-pub" title={titulo}>{"Instagram: " + seguidoresTxt(p.ig_seguidores || 0)}</Situacao>
        {/* estimativa do cadastro bem acima do real */}
        {p.seguidores && p.seguidores > (p.ig_seguidores || 0) * 1.3 ? <>{" "}<Situacao cls="is-rasc">{"Informou " + Number(p.seguidores).toLocaleString("pt-BR")}</Situacao></> : null}
      </span>
    );
  }
  if (p.ig_situacao === "nao_encontrado") {
    return <span>{" "}<Situacao cls="is-rasc" title="Conta pessoal, privada ou @ errado. Só conta Comercial ou Criador de conteúdo aparece.">Instagram não encontrado</Situacao></span>;
  }
  return null;
}

function BotaoInsta({ p }: { p: Parceiro }) {
  const [consultando, setConsultando] = useState(false);
  if (!p.instagram) return null;
  return (
    <Botao disabled={consultando} onClick={() => {
      setConsultando(true);
      api<{ resultado: { ok: boolean; erro?: string; encontrado?: boolean; usuario?: string; seguidores?: number }; parceiro: Parceiro }>("POST", "parceiros/" + encodeURIComponent(p.id) + "/instagram", {}).then((r) => {
        const res = r.resultado || { ok: false };
        setConsultando(false);
        if (!res.ok) {
          return aviso(({
            config: "Falta configurar a API do Instagram (segredos IG_USER_ID e IG_TOKEN). Veja o README.",
            token: "O token do Instagram (IG_TOKEN) é inválido ou expirou. Gere outro no Gerenciador de Negócios da Meta.",
            usuario: "O @ do Instagram deste parceiro é inválido.",
          } as Record<string, string>)[res.erro || ""] || "A API do Instagram não respondeu. Tente de novo em alguns minutos.", true);
        }
        muda((e) => ({ parceiros: e.parceiros.map((x) => (x.id === p.id ? r.parceiro : x)) }));
        aviso(res.encontrado ? "@" + res.usuario + ": " + seguidoresTxt(res.seguidores) + "." : "@" + res.usuario + " não encontrado. Pode ser conta pessoal ou @ errado.", !res.encontrado);
      }).catch((e) => { setConsultando(false); falha(e); });
    }}>{consultando ? "Consultando..." : "Conferir Instagram"}</Botao>
  );
}

// YouTube conferido pela YouTube Data API (functions/_lib/youtube.ts, rota parceiros/<id>/youtube)
const linkYoutube = (c: string) => "https://www.youtube.com/" + (/^UC/.test(c) ? "channel/" + c : "@" + semArroba(c));
const nomeCanal = (c: string) => (/^UC/.test(c) ? "YouTube" : "@" + semArroba(c));

function SelosYoutube({ p }: { p: Parceiro }) {
  if (!p.youtube) return null;
  const conferido = p.yt_conferido_em ? "Conferido em " + new Date(p.yt_conferido_em).toLocaleDateString("pt-BR") + " · " +
    Number(p.yt_videos || 0).toLocaleString("pt-BR") + " vídeos · " + Number(p.yt_views || 0).toLocaleString("pt-BR") + " visualizações" : "";
  if (p.yt_situacao === "ok") return <span>{" "}<Situacao cls="is-pub" title={conferido + ". O YouTube arredonda os inscritos."}>{"YouTube: " + Number(p.yt_inscritos || 0).toLocaleString("pt-BR") + " inscritos"}</Situacao></span>;
  if (p.yt_situacao === "oculto") return <span>{" "}<Situacao cls="is-rasc" title={conferido + "."}>YouTube: inscritos ocultos</Situacao></span>;
  if (p.yt_situacao === "nao_encontrado") return <span>{" "}<Situacao cls="is-rasc" title="Confira o @ ou o link do canal.">YouTube não encontrado</Situacao></span>;
  return null;
}

function BotaoYoutube({ p }: { p: Parceiro }) {
  const [consultando, setConsultando] = useState(false);
  if (!p.youtube) return null;
  return (
    <Botao disabled={consultando} onClick={() => {
      setConsultando(true);
      api<{ resultado: { ok: boolean; erro?: string; detalhe?: string; encontrado?: boolean; canal?: string; nome?: string; inscritos?: number; oculto?: boolean }; parceiro: Parceiro }>("POST", "parceiros/" + encodeURIComponent(p.id) + "/youtube", {}).then((r) => {
        const res = r.resultado || { ok: false };
        setConsultando(false);
        if (!res.ok) {
          return aviso((({
            config: "Falta configurar a API do YouTube (segredo YOUTUBE_API_KEY). Veja o README.",
            chave: "A chave do YouTube (YOUTUBE_API_KEY) é inválida ou a YouTube Data API v3 não está ativada no Google Cloud.",
            cota: "A cota diária da API do YouTube acabou. Tente amanhã.",
            canal: "O canal do YouTube deste parceiro é inválido.",
          } as Record<string, string>)[res.erro || ""] || "A API do YouTube não respondeu. Tente de novo em alguns minutos.") + (res.detalhe ? " (Google: " + res.detalhe + ")" : ""), true);
        }
        muda((e) => ({ parceiros: e.parceiros.map((x) => (x.id === p.id ? r.parceiro : x)) }));
        aviso(!res.encontrado ? "Canal " + res.canal + " não encontrado. Confira o @ ou o link."
          : (res.nome || res.canal) + ": " + (res.oculto ? "o canal esconde os inscritos." : Number(res.inscritos || 0).toLocaleString("pt-BR") + " inscritos."), !res.encontrado);
      }).catch((e) => { setConsultando(false); falha(e); });
    }}>{consultando ? "Consultando..." : "Conferir YouTube"}</Botao>
  );
}

function Contato({ p, comEmail }: { p: Parceiro; comEmail?: boolean }) {
  const partes = [];
  if (comEmail && p.email) partes.push(<LinkExt key="e" href={"mailto:" + p.email}>{p.email}</LinkExt>);
  if (p.whatsapp) partes.push(<LinkExt key="w" href={linkWa(p.whatsapp)}>{p.whatsapp}</LinkExt>);
  if (p.instagram) partes.push(<LinkExt key="i" href={linkInsta(p.instagram)}>{"@" + semArroba(p.instagram)}</LinkExt>);
  if (p.youtube) partes.push(<LinkExt key="y" href={linkYoutube(p.youtube)}>{"YouTube " + nomeCanal(p.youtube)}</LinkExt>);
  return <div>{partes.flatMap((x, i) => (i ? [" ", x] : [x]))}</div>;
}

// Cadastros novos (feitos em parceiro.html): aprovar libera a área do parceiro; recusar guarda o motivo
async function decide(p: Parceiro, sit: "aprovado" | "recusado"): Promise<void> {
  let dados: Partial<Parceiro>;
  if (sit === "recusado") {
    const motivo = await perguntaTexto("Recusar o cadastro de " + p.nome + "?", "Ele não vai poder receber convites. Se quiser, explique o motivo: o parceiro vê esta mensagem na área dele.",
      "Recusar cadastro", "Motivo (opcional)");
    if (motivo === null) return;
    dados = { situacao: sit, ativo: false, motivo_recusa: motivo.trim().slice(0, 300) };
  } else dados = { situacao: sit, ativo: true, motivo_recusa: "" };
  try {
    const salvo = await api<Parceiro>("PUT", "parceiros/" + encodeURIComponent(p.id), dados);
    muda((e) => ({ parceiros: e.parceiros.map((x) => (x.id === p.id ? salvo : x)) }));
    aviso(sit === "aprovado" ? p.nome + " aprovado. Avise pelo WhatsApp e crie o primeiro convite." : "Cadastro de " + p.nome + " recusado.",
      false, sit === "aprovado" && p.whatsapp ? ["Avisar no WhatsApp", () => {
        window.open(linkWa(p.whatsapp, "Olá, " + (p.responsavel || p.nome) + "! Seu cadastro de parceiro da Tardim Produções foi aprovado. Entre na sua área para ver os convites: " + base() + "parceiro.html"), "_blank", "noopener");
      }] : null);
  } catch (err) { falha(err); }
}

function BotaoDecide({ p, sit }: { p: Parceiro; sit: "aprovado" | "recusado" }) {
  const [esperando, setEsperando] = useState(false);
  return (
    <Botao cls={sit === "aprovado" ? "btn btn--red" : "orc__email painel-perigo"} disabled={esperando}
      onClick={() => { setEsperando(true); decide(p, sit).finally(() => setEsperando(false)); }}>
      {sit === "aprovado" ? "Aprovar" : "Recusar"}
    </Botao>
  );
}

function CardPendentes({ lista }: { lista: Parceiro[] }) {
  return (
    <Card passo="Cadastros pelo site" titulo={lista.length === 1 ? "1 cadastro aguardando aprovação" : lista.length + " cadastros aguardando aprovação"} className="painel-pendentes">
      <p className="muted">Confira os dados (Instagram, WhatsApp, CREF quando houver) antes de aprovar. Aprovado, o parceiro passa a ver na área dele os convites que você criar.</p>
      <Tabela cab={["Recebido", "Nome", "Tipo", "Contato", "Cidade", ""]} linhas={lista.map((p) => [
        p.criado_em ? new Date(p.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "",
        <div>
          <strong>{p.nome}</strong>
          {p.responsavel ? <small className="muted">{" · " + p.responsavel}</small> : null}
          {p.seguidores && p.ig_situacao !== "ok" ? <small className="muted">{" · " + seguidoresTxt(p.seguidores) + " (informado)"}</small> : null}
          <SelosInsta p={p} />
          <SelosYoutube p={p} />
        </div>,
        TIPOS[p.tipo] || p.tipo, <Contato p={p} comEmail />, cidadeUf(p),
        <Acoes>
          <BotaoDecide p={p} sit="aprovado" />
          <BotaoDecide p={p} sit="recusado" />
          <Botao onClick={() => ir("parceiro/" + enc(p.id))}>Editar</Botao>
          <BotaoInsta p={p} />
          <BotaoYoutube p={p} />
        </Acoes>,
      ])} />
    </Card>
  );
}

export function AbaParceiros() {
  const { parceiros, convites } = usaEstado();
  const [tipo, setTipo] = useState(filtros.tipo);
  const [busca, setBusca] = useState(filtros.busca);
  filtros.tipo = tipo; filtros.busca = busca;
  const pend = parceiros.filter((p) => p.situacao === "pendente");
  const termo = slug(busca).replace(/-/g, " ");
  const lista = parceiros.filter((p) => {
    if (tipo && p.tipo !== tipo) return false;
    if (!termo) return true;
    return slug([p.nome, p.responsavel, p.cidade, p.uf, p.instagram, p.youtube].join(" ")).replace(/-/g, " ").indexOf(termo) >= 0;
  });
  return (
    <>
      {pend.length ? <CardPendentes lista={pend} /> : null}
      <Card passo="Cadastro" titulo="Parceiros">
        <p className="muted">Embaixadores, influenciadores, assessorias e equipes. Cada parceiro pode ter convites em várias provas.</p>
        <div className="painel-filtros">
          <Campo rotulo="Tipo"><Escolha opcoes={([["", "Todos os tipos"]] as [string, string][]).concat(opcoesTipo)} value={tipo} onChange={setTipo} /></Campo>
          <Campo rotulo="Busca"><input type="search" placeholder="Buscar por nome, cidade ou Instagram" value={busca} onChange={(e) => setBusca(e.target.value)} /></Campo>
          <Botao cls="btn btn--red" onClick={() => ir("parceiro/novo")}>Novo parceiro</Botao>
        </div>
        <div>
          {!lista.length ? <p className="muted">{parceiros.length ? "Nenhum parceiro com esse filtro." : "Nenhum parceiro cadastrado ainda."}</p> : (
            <Tabela cab={["Nome", "Tipo", "Contato", "Convites", "Situação", ""]} ids={lista.map((p) => p.id)} linhas={lista.map((p) => {
              const okCref = !!p.registro_conferido_em && /^ATIVO$/i.test(p.registro_situacao);
              return [
                <div>
                  <strong>{p.nome}</strong>
                  {p.responsavel ? <small className="muted">{" · " + p.responsavel}</small> : null}
                  {p.profissao === PROFISSOES[0] ? <>{" "}<Situacao cls={okCref ? "is-pub" : "is-rasc"}>{okCref ? "CREF6 ativo" : (p.registro_conferido_em ? "CREF6: " + (p.registro_situacao || "?") : "CREF6 não conferido")}</Situacao></> : null}
                  <SelosInsta p={p} />
                  <SelosYoutube p={p} />
                </div>,
                TIPOS[p.tipo], <Contato p={p} />,
                String(convites.filter((x) => x.parceiro_id === p.id).length),
                p.situacao === "pendente" ? <Situacao cls="is-rasc">Aguardando aprovação</Situacao>
                  : p.situacao === "recusado" ? <Situacao cls="is-off">Recusado</Situacao>
                  : <Situacao cls={p.ativo ? "is-pub" : "is-off"}>{p.ativo ? "Ativo" : "Inativo"}</Situacao>,
                <Acoes>
                  <Botao onClick={() => ir("parceiro/" + enc(p.id))}>Editar</Botao>
                  {p.ativo ? <Botao onClick={() => ir("convite/novo?parceiro=" + enc(p.id))}>Novo convite</Botao> : null}
                  {p.tipo === "influenciador" ? <><BotaoInsta p={p} /><BotaoYoutube p={p} /></> : null}
                </Acoes>,
              ];
            })} />
          )}
        </div>
      </Card>
    </>
  );
}

function excluirParceiro(p: Parceiro) {
  const n = pega().convites.filter((x) => x.parceiro_id === p.id).length;
  pergunta("Excluir " + p.nome + "?", (n ? (n === 1 ? "O convite deste parceiro também será apagado. " : "Os " + n + " convites deste parceiro também serão apagados. ") : "") + "Para só esconder, desmarque \"Ativo\" e salve.", "Excluir parceiro").then((sim) => {
    if (!sim) return;
    api("DELETE", "parceiros/" + encodeURIComponent(p.id)).then(() => {
      muda((e) => ({ parceiros: e.parceiros.filter((x) => x.id !== p.id), convites: e.convites.filter((x) => x.parceiro_id !== p.id) }));
      voltarPara("parceiros");
      aviso("Parceiro excluído.");
    }).catch(falha);
  });
}

interface ConfCref { registro: string; situacao: string; nome: string; em: string; categoria: string }

export function FormParceiro({ p: original }: { p: Parceiro | null }) {
  const p: Partial<Parceiro> = original || { tipo: "embaixador", ativo: true };
  const { v, liga, muda: mudaCampo } = useCampos(() => ({
    tipo: p.tipo || "embaixador", nome: p.nome || "", responsavel: p.responsavel || "", whatsapp: mascaraTel(p.whatsapp), email: p.email || "",
    instagram: p.instagram || "", youtube: p.youtube || "", cidade: p.cidade || "", uf: p.uf || "", seguidores: p.seguidores ? String(p.seguidores) : "",
    documento: p.documento || "", pix: p.pix || "", observacoes: p.observacoes || "", profissao: p.profissao || "", registro: p.registro || "",
    cor: "#" + (/^[0-9a-f]{6}$/i.test(p.cor || "") ? p.cor : "24325a"),
  }));
  const [ativo, setAtivo] = useState(!!p.ativo);
  const [usaCor, setUsaCor] = useState(/^[0-9a-f]{6}$/i.test(p.cor || ""));
  const [logoAtual, setLogoAtual] = useState(p.logo || "");
  const [logoNovo, setLogoNovo] = useState<File | null>(null);
  const [logoPrev, setLogoPrev] = useState(urlArquivo(p.logo || ""));
  const arqLogo = useRef<HTMLInputElement>(null);
  const [conf, setConf] = useState<ConfCref>({ registro: p.registro || "", situacao: p.registro_situacao || "", nome: p.registro_nome || "", em: p.registro_conferido_em || "", categoria: "" });
  const [crefMsg, setCrefMsg] = useState<"" | "numero" | "fora">("");
  const [validando, setValidando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const nomeRef = useRef<HTMLInputElement>(null);
  useEffect(() => { nomeRef.current?.focus({ preventScroll: true }); }, []);

  const equipe = v.tipo === "assessoria" || v.tipo === "equipe";
  const ehCref6 = v.profissao === PROFISSOES[0];
  const palavras = (s: string) => slug(s).split("-").filter((x) => x.length > 2);
  const cad = palavras(v.nome), cref = palavras(conf.nome);
  const nomeConfere = !cad.length || !cref.length || cad.every((x) => cref.indexOf(x) >= 0);

  function validarCref() {
    if (!v.registro.trim()) { aviso("Informe o número do CREF6.", true); return; }
    setValidando(true); setCrefMsg("");
    api<{ ok: boolean; erro?: string; registro: string; encontrado?: boolean; situacao?: string; nome?: string; categoria?: string }>("GET", "cref6?numero=" + encodeURIComponent(v.registro.trim())).then((r) => {
      setValidando(false);
      if (!r.ok) { setConf((c) => ({ ...c, em: "" })); setCrefMsg(r.erro === "numero" ? "numero" : "fora"); return; }
      setConf({ registro: r.registro, em: new Date().toISOString(), situacao: r.encontrado ? r.situacao || "" : "NÃO ENCONTRADO", nome: r.encontrado ? r.nome || "" : "", categoria: r.categoria || "" });
      mudaCampo("registro", r.registro);
    }).catch((e) => { setValidando(false); falha(e); });
  }

  function salvar() {
    if (!v.nome.trim()) return aviso("Informe o nome do parceiro.", true);
    const linha: Partial<Parceiro> = {
      tipo: v.tipo as Parceiro["tipo"], nome: v.nome.trim(), responsavel: v.responsavel.trim(), whatsapp: v.whatsapp.trim(),
      email: v.email.trim(), instagram: v.instagram.trim().replace(/^@/, ""), youtube: v.youtube.trim(), cidade: v.cidade.trim(),
      uf: v.uf, seguidores: Number(v.seguidores) || 0,
      documento: v.documento.trim(), pix: v.pix.trim(), observacoes: v.observacoes.trim(), ativo,
    };
    linha.profissao = equipe ? "" : v.profissao;
    const comCref = !equipe && ehCref6;
    if (comCref && !v.registro.trim()) return aviso("Informe o número do CREF6 (ou escolha outro tipo de profissional).", true);
    linha.registro = comCref ? v.registro.trim() : "";
    linha.registro_situacao = comCref && conf.em ? conf.situacao : "";
    linha.registro_nome = comCref && conf.em ? conf.nome : "";
    linha.registro_conferido_em = comCref && conf.em ? conf.em : "";
    if (equipe) {
      linha.cor = usaCor ? v.cor.replace(/^#/, "").toLowerCase() : "";
      if (!logoNovo) linha.logo = logoAtual;
    }
    setSalvando(true);
    const q = p.id ? api<Parceiro>("PUT", "parceiros/" + encodeURIComponent(p.id), linha) : api<Parceiro>("POST", "parceiros", linha);
    q.then((salvo) => {
      if (!(equipe && logoNovo)) return salvo;
      // o id só existe depois do insert: insert -> upload -> update do campo logo.
      // Nome novo a cada envio e o arquivo antigo fica (links já enviados apontam para ele).
      return comprimeLogo(logoNovo).then((blob) => enviaImagem("assessorias", salvo.id, blob, "image/png"))
        .then((caminho) => api<Parceiro>("PUT", "parceiros/" + encodeURIComponent(salvo.id), { logo: caminho }));
    }).then((salvo) => {
      muda((e) => ({ parceiros: e.parceiros.filter((x) => x.id !== salvo.id).concat([salvo]).sort((a, b) => a.nome.localeCompare(b.nome)) }));
      nav.destaque = salvo.id;
      voltarPara("parceiros");
      aviso("Parceiro salvo.");
    }).catch((err) => { setSalvando(false); falha(err); });
  }

  const resultadoCref = !ehCref6 ? null : (
    <div className="painel-cref">
      {!conf.em ? (v.registro.trim() && !crefMsg ? <small className="assess-dica">Ainda não conferido no CREF6.</small> : null)
        : conf.situacao === "NÃO ENCONTRADO" ? <p className="assess-alerta">{"O registro " + conf.registro + " não foi encontrado no CREF6. Confira o número com o parceiro."}</p>
        : <>
          <p className="painel-cref__ok"><strong>{conf.nome}</strong>{" · " + [conf.categoria, conf.situacao].filter(Boolean).join(" · ")}<small>{" Conferido em " + new Date(conf.em).toLocaleDateString("pt-BR") + "."}</small></p>
          {!/^ATIVO$/i.test(conf.situacao) ? <p className="assess-alerta">{"Situação no CREF6: " + conf.situacao + ". O registro não está ativo."}</p> : null}
          {!nomeConfere ? <p className="assess-alerta">{"O nome no CREF6 (" + conf.nome + ") é diferente do nome do cadastro. Confira se o registro é mesmo desta pessoa."}</p> : null}
        </>}
      {crefMsg === "numero" ? <p className="assess-alerta">Número inválido. Use o formato 012345-G/MG.</p> : null}
      {crefMsg === "fora" ? (
        <p className="assess-alerta">O CREF6 está fora do ar ou mudou a página. Confira à mão: <LinkExt href="https://portal.cref6.org.br/spw/ConsultaCadastral/TelaConsultaPublicaCompleta.aspx">consulta pública do CREF6</LinkExt>. Dá para salvar assim, como não conferido.</p>
      ) : null}
    </div>
  );

  return (
    <>
      <Trilha aba="parceiros" atual={original ? "Editar parceiro" : "Novo parceiro"} />
      <Card passo={original ? "Editar parceiro" : "Novo parceiro"} titulo={original ? original.nome : "Dados do parceiro"}>
        <Form onSubmit={salvar}>
          <Campo rotulo="Tipo"><Escolha opcoes={opcoesTipo} value={v.tipo} onChange={(x) => mudaCampo("tipo", x as typeof v.tipo)} /></Campo>
          <Campo rotulo="Nome" dica="Pessoa, perfil ou nome da assessoria/equipe."><input ref={nomeRef} type="text" maxLength={120} required {...liga("nome")} /></Campo>
          <Campo rotulo="Responsável" dica="Para assessoria e equipe: quem fala pela equipe."><input type="text" maxLength={120} {...liga("responsavel")} /></Campo>
          <Campo rotulo="WhatsApp"><input type="tel" placeholder="(31) 90000-0000" maxLength={20} inputMode="numeric" value={v.whatsapp} onChange={(e) => mudaCampo("whatsapp", mascaraTel(e.target.value))} /></Campo>
          <Campo rotulo="E-mail"><input type="email" maxLength={120} {...liga("email")} /></Campo>
          <Campo rotulo="Instagram"><input type="text" placeholder="@perfil" maxLength={60} {...liga("instagram")} /></Campo>
          <Campo rotulo="YouTube" dica={p.yt_situacao === "ok" ? "No YouTube: " + Number(p.yt_inscritos).toLocaleString("pt-BR") + " inscritos (conferido em " + new Date(p.yt_conferido_em!).toLocaleDateString("pt-BR") + ")." : "O @ do canal ou o link dele."}>
            <input type="text" placeholder="@canal" maxLength={100} {...liga("youtube")} />
          </Campo>
          <Campo rotulo="Cidade"><input type="text" maxLength={80} {...liga("cidade")} /></Campo>
          <Campo rotulo="Estado (UF)"><Escolha opcoes={([["", "—"]] as [string, string][]).concat(UFS.map((u): [string, string] => [u, u]))} value={v.uf} onChange={(x) => mudaCampo("uf", x)} /></Campo>
          <Campo rotulo="Seguidores (estimado)" dica={p.ig_situacao === "ok" ? "No Instagram: " + seguidoresTxt(p.ig_seguidores) + " (conferido em " + new Date(p.ig_conferido_em!).toLocaleDateString("pt-BR") + ")." : undefined}>
            <input type="number" min={0} step={1} placeholder="Só para influenciador" {...liga("seguidores")} />
          </Campo>
          <Campo rotulo="CPF ou CNPJ" dica="Para o pagamento da comissão."><input type="text" maxLength={20} placeholder="CPF ou CNPJ" {...liga("documento")} /></Campo>
          <Campo rotulo="Chave Pix" dica="Em nome do próprio parceiro."><input type="text" maxLength={120} {...liga("pix")} /></Campo>
          <Campo rotulo="Observações" cheio><textarea maxLength={1000} {...liga("observacoes")} /></Campo>

          {/* Profissional (embaixador/influenciador): tipo e, no CREF6/MG, registro conferido na consulta pública do CREF6 (rota api/admin/cref6) */}
          <div className="assess-grid__full painel-identidade" hidden={equipe}>
            <Campo rotulo="Tipo de profissional">
              <Escolha opcoes={([["", "Não informado"]] as [string, string][]).concat(PROFISSOES.map((x): [string, string] => [x, x]))} value={v.profissao} onChange={(x) => mudaCampo("profissao", x)} />
            </Campo>
            <div className="orc__field" hidden={!ehCref6}>
              <span>Número do CREF6</span>
              <input type="text" maxLength={20} placeholder="012345-G/MG" aria-label="Número do CREF6" value={v.registro} onChange={(e) => {
                mudaCampo("registro", e.target.value);
                if (e.target.value.trim() !== conf.registro) { setConf((c) => ({ ...c, em: "" })); setCrefMsg(""); }
              }} />
              <Botao cls="btn btn--line" disabled={validando} onClick={validarCref}>{validando ? "Consultando o CREF6..." : "Validar no CREF6"}</Botao>
              {resultadoCref}
            </div>
          </div>

          {/* Assessoria/equipe: logo e cor usadas na inscrição coletiva e na página da equipe.
              logo = CAMINHO em /arquivos (assessorias/<id>-<tempo>.png); cor = "rrggbb". */}
          <div className="assess-grid__full painel-identidade" hidden={!equipe}>
            <Bloco rotulo="Logo da equipe" dica="PNG com fundo transparente fica melhor. O painel reduz para até 400 px.">
              <div className="painel-poster">{logoPrev ? <img className="painel-logo" alt="Logo da equipe" src={logoPrev} /> : null}</div>
              <input ref={arqLogo} type="file" accept="image/png,image/jpeg,image/webp" aria-label="Arquivo da logo" onChange={(e) => {
                const f = e.target.files?.[0] || null; setLogoNovo(f); if (f) setLogoPrev(URL.createObjectURL(f));
              }} />
              <Botao onClick={() => { setLogoAtual(""); setLogoNovo(null); if (arqLogo.current) arqLogo.current.value = ""; setLogoPrev(""); }}>Tirar a logo</Botao>
            </Bloco>
            <Bloco rotulo="Cor da equipe" dica="Aparece na página da equipe e na inscrição coletiva.">
              <input type="color" aria-label="Cor da equipe" value={v.cor} onChange={(e) => { mudaCampo("cor", e.target.value); setUsaCor(true); }} />
              <Marcador texto="Usar cor da equipe" checked={usaCor} onChange={setUsaCor} />
            </Bloco>
          </div>
          <div className="assess-grid__full"><Marcador texto="Ativo (aparece na lista para novos convites)" checked={ativo} onChange={setAtivo} /></div>
          <BarraForm>
            <button type="submit" className="btn btn--red btn--lg" disabled={salvando}>{salvando ? "Salvando..." : "Salvar parceiro"}</button>
            <Botao onClick={() => cancelar("parceiros")}>Cancelar</Botao>
            {original ? <Botao cls="orc__email painel-perigo" onClick={() => excluirParceiro(original)}>Excluir parceiro</Botao> : null}
          </BarraForm>
        </Form>
      </Card>
      {original && original.tipo === "assessoria" ? <CardIntegracao p={original} /> : null}
    </>
  );
}

// Integração (API v1, docs/api-v1-parceiros.md): tudo por convite. O painel convida o sistema
// da assessoria (ex.: IM3); o admin dela aceita ou recusa lá; a chave vai direto para o servidor
// dela e ninguém precisa copiar nada. Convites de prova também são aceitos ou recusados lá.
const SIT_CONEXAO: Record<string, [string, string]> = {
  enviando: ["Enviando...", "is-rasc"], enviado: ["Aguardando resposta", "is-rasc"], falhou: ["Não entregue", "is-off"],
  aceito: ["Aceito", "is-pub"], recusado: ["Recusado", "is-off"], cancelado: ["Cancelado", "is-off"],
};
const host = (u: string) => String(u || "").replace(/^https?:\/\//, "");

function CardIntegracao({ p }: { p: Parceiro }) {
  const [r, setR] = useState<Integracoes | null>(null);
  const [erro, setErro] = useState("");
  const [n, setN] = useState(0);
  const carrega = () => setN((x) => x + 1);
  const liberada = p.situacao === "aprovado" && p.ativo;
  useEffect(() => {
    if (!liberada) return;
    setR(null); setErro("");
    api<Integracoes>("GET", "parceiros/" + encodeURIComponent(p.id) + "/integracoes").then(setR).catch((e) => {
      setErro(/tabelas|503/.test(String(e && e.message)) ? "Falta criar as tabelas da integração no banco (d1/migracoes/013-integracoes.sql)." : "Não consegui carregar a integração.");
    });
  }, [n]);

  function desconecta(k: Integracao) {
    pergunta("Desconectar " + (k.nome || host(k.plataforma_url)) + "?", "O sistema da assessoria é avisado e perde o acesso na hora. Para voltar, faça um convite novo.", "Desconectar").then((sim) => {
      if (!sim) return;
      api("POST", "integracoes/" + encodeURIComponent(k.id) + "/desconectar", {}).then(() => { aviso("Desconectado."); carrega(); }).catch(falha);
    });
  }
  function cancelaConvite(x: Conexao) {
    pergunta("Cancelar o convite para " + host(x.plataforma_url) + "?", "Se a assessoria tentar aceitar depois, o sistema dela vai receber um erro.", "Cancelar convite").then((sim) => {
      if (!sim) return;
      api("POST", "conexoes/" + encodeURIComponent(x.id) + "/cancelar", {}).then(() => { aviso("Convite cancelado."); carrega(); }).catch(falha);
    });
  }

  let area;
  if (!liberada) area = <p className="assess-alerta">Aprove e ative esta assessoria para convidar o sistema dela.</p>;
  else if (erro) area = <p className="assess-alerta">{erro}</p>;
  else if (!r) area = <p className="muted">Carregando...</p>;
  else {
    const ativas = r.integracoes.filter((k) => !k.revogada_em);
    const historico = r.conexoes.filter((x) => !(x.situacao === "aceito" && ativas.some((k) => k.id === x.integracao_id)));
    area = (
      <>
        {!r.assinatura ? <p className="assess-alerta">Falta configurar a assinatura dos convites (segredo TARDIM_ASSINATURA_JWK). Veja o README.</p> : null}
        {ativas.map((k) => (
          <div className="painel-cref" key={k.id}>
            <p className="painel-cref__ok">
              <strong>{"Conectada a " + (k.nome || host(k.plataforma_url))}</strong>{" · " + host(k.plataforma_url) + (k.ambiente === "test" ? " · teste" : "")}
              <small>{" Desde " + dataCurtaHora(k.criada_em) + (k.usada_em ? " · último acesso " + dataCurtaHora(k.usada_em) : "") + "."}</small>
            </p>
            <Acoes><Botao cls="orc__email painel-perigo" onClick={() => desconecta(k)}>Desconectar</Botao></Acoes>
          </div>
        ))}
        {historico.length ? <>
          <h3>Convites de conexão</h3>
          <Tabela cab={["Sistema", "Situação", "Enviado", "Resposta", ""]} linhas={historico.map((x) => {
            const s = SIT_CONEXAO[x.situacao] || [x.situacao, "is-rasc"];
            const aberta = ["enviando", "enviado", "falhou"].indexOf(x.situacao) >= 0;
            return [
              host(x.plataforma_url) + (x.ambiente === "test" ? " (teste)" : ""),
              <div>
                <Situacao cls={s[1]}>{s[0]}</Situacao>
                {x.situacao === "falhou" && x.erro ? <small className="muted">{" " + x.erro}</small> : null}
                {x.situacao === "enviado" ? <small className="muted">{" vale até " + dataCurtaHora(x.expira_em)}</small> : null}
              </div>,
              dataCurtaHora(x.enviado_em),
              x.respondido_em ? dataCurtaHora(x.respondido_em) + (x.respondido_por ? " por " + x.respondido_por : "") + (x.motivo ? ". Motivo: " + x.motivo : "") : "—",
              aberta ? <Acoes>
                <ReenviaConexao x={x} depois={carrega} />
                <Botao cls="orc__email painel-perigo" onClick={() => cancelaConvite(x)}>Cancelar convite</Botao>
              </Acoes> : null,
            ];
          })} />
        </> : null}
        {!ativas.length ? <ConvidaSistema p={p} ultimo={r.conexoes[0]} depois={carrega} /> : null}
      </>
    );
  }
  return (
    <Card passo="Integração" titulo="Conectar o sistema da assessoria">
      <p className="muted">Se a assessoria usa um sistema próprio (como o IM3), convide-o aqui. O responsável recebe o convite no sistema dele e aceita ou recusa. Conectado, cada convite de prova que você criar chega lá para ele aceitar, e as respostas aparecem aqui.</p>
      <div>{area}</div>
    </Card>
  );
}

function ReenviaConexao({ x, depois }: { x: Conexao; depois: () => void }) {
  const [esperando, setEsperando] = useState(false);
  return (
    <Botao disabled={esperando} onClick={() => {
      setEsperando(true);
      api<Conexao>("POST", "conexoes/" + encodeURIComponent(x.id) + "/reenviar", {}).then((r) => {
        aviso(r.situacao === "enviado" ? "Convite entregue de novo." : "Ainda não entregou: " + (r.erro || "erro desconhecido") + ".", r.situacao !== "enviado");
        depois();
      }).catch((e) => { setEsperando(false); falha(e); });
    }}>{x.situacao === "falhou" ? "Tentar de novo" : "Reenviar"}</Botao>
  );
}

function ConvidaSistema({ p, ultimo, depois }: { p: Parceiro; ultimo?: Conexao; depois: () => void }) {
  const [end, setEnd] = useState(ultimo ? ultimo.plataforma_url : "https://");
  const [amb, setAmb] = useState("live");
  const [enviando, setEnviando] = useState(false);
  return (
    <div>
      <h3 style={{ marginTop: "1.5rem" }}>Convidar o sistema da assessoria</h3>
      <form className="assess-grid" noValidate onSubmit={(e) => {
        e.preventDefault();
        setEnviando(true);
        api<Conexao>("POST", "parceiros/" + encodeURIComponent(p.id) + "/conexao", { plataforma_url: end.trim(), ambiente: amb }).then((x) => {
          aviso(x.situacao === "enviado" ? "Convite entregue. Agora é com a assessoria: ela aceita ou recusa no sistema dela." : "O sistema não recebeu o convite: " + (x.erro || "erro desconhecido") + ".", x.situacao !== "enviado");
          depois();
        }).catch((err) => { setEnviando(false); falha(err); });
      }}>
        <Campo rotulo="Endereço do sistema da assessoria" dica="O endereço que a assessoria usa para abrir o sistema dela.">
          <input type="url" placeholder="https://im3-eventos.vercel.app" maxLength={200} value={end} onChange={(e) => setEnd(e.target.value)} />
        </Campo>
        <Campo rotulo="Ambiente"><Escolha opcoes={[["live", "Produção"], ["test", "Teste (o sistema vê também provas não publicadas)"]]} value={amb} onChange={setAmb} /></Campo>
        <BarraForm><button type="submit" className="btn btn--red" disabled={enviando}>{enviando ? "Enviando convite..." : "Convidar para conectar"}</button></BarraForm>
      </form>
    </div>
  );
}
