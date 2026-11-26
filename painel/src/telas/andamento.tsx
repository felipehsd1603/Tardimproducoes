// Do orçamento ao contrato assinado: os cinco passos de cada proposta (#proposta/<id>).
import { useEffect, useState, type ReactNode } from "react";
import { api } from "../api.ts";
import { aviso, falha, ir, marcaSujo, nav, redesenha } from "../loja.tsx";
import { Acoes, Botao, Campo, Card, Escolha, Form, LinkExt, Marcador, Secao, Trilha, pergunta } from "../ui.tsx";
import { curta, enc, extenso, hojeIso, quando, reais } from "../util.ts";
import {
  carregaConfig, etapaDe, faixasDe, imprimeContrato, imprimeProposta, marcaEtapa, ORDEM_ETAPA, PAGAMENTOS, PASSOS, proximoContrato,
  salvaDados, somaItens, voltaEtapa,
} from "../proposta.ts";
import type { ConfigContrato, DadosContrato, Etapa, Proposta } from "../tipos.ts";

const depois = (msg: string) => () => { nav.sujo = false; redesenha(); aviso(msg); };

function BotaoDesfazer({ x, para, rotulo, extra }: { x: Proposta; para: Etapa; rotulo: string; extra?: Parameters<typeof voltaEtapa>[2] }) {
  return (
    <Botao onClick={() => {
      pergunta(rotulo + "?", "A proposta volta para o passo anterior. Nada mais é apagado.", rotulo).then((sim) => {
        if (sim) voltaEtapa(x, para, extra).then(depois("Pronto, voltou um passo.")).catch(falha);
      });
    }}>{rotulo}</Botao>
  );
}
function DataInline({ rotulo, valor, onChange }: { rotulo: string; valor: string; onChange: (v: string) => void }) {
  return <label className="andamento-data"><span>{rotulo}</span><input type="date" value={valor} onChange={(e) => onChange(e.target.value)} /></label>;
}
/** Botão que fica desabilitado enquanto grava (e volta se der erro) */
function BotaoGrava({ cls, acao, children }: { cls?: string; acao: () => Promise<unknown> | undefined; children: ReactNode }) {
  const [esperando, setEsperando] = useState(false);
  return (
    <Botao cls={cls} disabled={esperando} onClick={() => {
      const p = acao();
      if (!p) return;
      setEsperando(true);
      p.catch((e) => { setEsperando(false); falha(e); });
    }}>{children}</Botao>
  );
}

export function TelaAndamento({ x }: { x: Proposta }) {
  const d = x.dados || {}, ev = d.evento || {}, mc = d.marcos || {}, ct = d.contrato || {};
  const s = somaItens(d.itens || []), e = etapaDe(x), recusada = e === "recusada";
  // Passo atual: 0 a 4; 5 = tudo feito
  const atual = e === "assinado" ? 5 : (recusada ? 2 : ORDEM_ETAPA[e] + 1);
  const titulo = "Proposta" + (x.numero ? " nº " + x.numero : "");
  const [dEnv, setDEnv] = useState(hojeIso());
  const [dResp, setDResp] = useState(hojeIso());
  const [alterando, setAlterando] = useState(false);

  const passo = (i: number, status: string, miolo: ReactNode) => {
    const estado = recusada && i === 2 ? "is-nao" : (recusada && i > 2 ? "is-espera" : (i < atual ? "is-feito" : (i === atual ? "is-atual" : "is-espera")));
    return (
      <section className={"andamento-passo " + estado} key={i}>
        <span className="andamento-passo__n" aria-hidden="true">{estado === "is-feito" ? "✓" : (estado === "is-nao" ? "✕" : String(i + 1))}</span>
        <div className="andamento-passo__cab">
          <h3>{(i + 1) + ". " + PASSOS[i]}</h3>
          <p className="andamento-passo__st">{status || (i === atual ? "Próximo passo" : "")}</p>
        </div>
        <div className="andamento-passo__corpo">{miolo}</div>
      </section>
    );
  };

  // 1. Montar a proposta
  const m0 = <>
    {e === "assinado" ? <p className="muted">Com o contrato assinado, a proposta fica travada. Para um acréscimo, use "Duplicar" e faça uma proposta de aditivo.</p> : null}
    <Acoes>
      {e !== "assinado" ? <Botao cls="btn btn--line" onClick={() => ir("proposta/" + enc(x.id) + "/editar")}>Editar itens e valores</Botao> : null}
      <Botao onClick={() => imprimeProposta(x)}>Ver PDF da proposta</Botao>
      <Botao onClick={() => ir("proposta/novo?de=" + enc(x.id))}>Duplicar</Botao>
    </Acoes>
  </>;

  // 2. Enviar ao cliente
  const m1 = atual === 1 ? <>
    <p>Baixe o PDF da proposta e mande ao cliente por e-mail ou WhatsApp. Depois, registre o envio.</p>
    <Acoes>
      <Botao cls="btn btn--line" onClick={() => imprimeProposta(x)}>Baixar PDF da proposta</Botao>
      <DataInline rotulo="Enviada em" valor={dEnv} onChange={setDEnv} />
      <BotaoGrava cls="btn btn--red" acao={() => marcaEtapa(x, "enviada", dEnv).then(depois("Envio registrado. Agora, aguarde a resposta do cliente."))}>Registrar envio</BotaoGrava>
    </Acoes>
  </> : e === "enviada" ? <Acoes><BotaoDesfazer x={x} para="rascunho" rotulo="Desfazer envio" /></Acoes> : null;

  // 3. Resposta do cliente
  const m2 = e === "enviada" ? <>
    <p>Quando o cliente responder, registre aqui. Se ele pedir mudanças, edite a proposta no passo 1 e mande de novo.</p>
    <Acoes>
      <DataInline rotulo="Em" valor={dResp} onChange={setDResp} />
      <BotaoGrava cls="btn btn--red" acao={() => marcaEtapa(x, "aprovada", dResp).then(depois("Aprovação registrada. Próximo passo: gerar o contrato."))}>Cliente aprovou</BotaoGrava>
      <Botao cls="orc__email painel-perigo" onClick={() => {
        pergunta("Registrar que o cliente recusou?", "A proposta sai do andamento. Dá para desfazer depois.", "Registrar recusa").then((sim) => {
          if (sim) marcaEtapa(x, "recusada", dResp).then(depois("Recusa registrada.")).catch(falha);
        });
      }}>Cliente recusou</Botao>
    </Acoes>
  </> : recusada ? <>
    <p>Para tentar de novo com outra versão, use "Duplicar" no passo 1.</p>
    <Acoes><BotaoDesfazer x={x} para="enviada" rotulo="Desfazer recusa" /></Acoes>
  </> : e === "aprovada" ? <Acoes><BotaoDesfazer x={x} para="enviada" rotulo="Desfazer aprovação" /></Acoes> : null;

  // 4. Gerar o contrato
  const m3 = e === "aprovada" ? <FormContrato x={x} /> : e === "contrato" ? <>
    <Acoes>
      <Botao cls="btn btn--line" onClick={() => imprimeContrato(x)}>Baixar PDF do contrato</Botao>
      <Botao onClick={() => setAlterando(true)}>Alterar dados do contrato</Botao>
    </Acoes>
    <div>{alterando ? <FormContrato x={x} /> : null}</div>
  </> : null;

  // 5. Assinatura
  const m4 = e === "contrato" ? <FormAssinatura x={x} /> : e === "assinado" ? (
    <Acoes>
      {ct.arquivo_assinado ? <a className="btn btn--line" href={"api/admin/propostas/" + enc(x.id) + "/assinado"}>Baixar o contrato assinado</a> : null}
      {/^https:\/\//.test(ct.link_assinado || "") ? <LinkExt href={ct.link_assinado!}>Abrir o link do contrato assinado ↗</LinkExt> : null}
      <Botao onClick={() => imprimeContrato(x)}>Ver o contrato gerado pelo painel</Botao>
      <Botao cls="orc__email painel-perigo" onClick={() => {
        pergunta("Desfazer o registro da assinatura?", "O PDF assinado guardado no painel será apagado. Cópias salvas no computador ou no Drive continuam existindo.", "Desfazer registro").then((sim) => {
          if (!sim) return;
          api("DELETE", "propostas/" + encodeURIComponent(x.id) + "/assinado").catch(() => null)
            .then(() => voltaEtapa(x, "contrato", { contrato: Object.assign({}, ct, { arquivo_assinado: "", link_assinado: "" }) }))
            .then(depois("Registro da assinatura desfeito.")).catch(falha);
        });
      }}>Desfazer registro da assinatura</Botao>
    </Acoes>
  ) : null;

  return (
    <>
      <Trilha aba="propostas" atual={titulo} />
      <Card passo={titulo} titulo={x.cliente}>
        <p className="andamento-resumo">{[ev.nome || x.evento, ev.data ? quando(ev.data) : "", ev.participantes ? Number(ev.participantes).toLocaleString("pt-BR") + " participantes" : ""].filter(Boolean).join(" · ")}</p>
        <p className="andamento-total"><strong>{reais(s.total)}</strong><span>{" · " + extenso(s.total)}</span></p>
        <ol className="andamento-barra" aria-label="Andamento">
          {PASSOS.map((n, i) => (
            <li key={n} className={recusada && i === 2 ? "is-nao" : (i < atual ? "is-feito" : (i === atual ? "is-atual" : ""))} aria-current={i === atual ? "step" : undefined}>{n}</li>
          ))}
        </ol>
        {e === "assinado" ? <p className="andamento-fim">{"Contrato assinado em " + curta(mc.assinado) + ". Esta proposta está concluída."}</p> : null}
        {recusada ? <p className="assess-alerta">{"O cliente recusou esta proposta em " + curta(mc.recusada) + "."}</p> : null}
        {passo(0, (d.itens || []).length + " itens · " + reais(s.total) + (d.validade ? " · válida até " + curta(d.validade) : ""), m0)}
        {passo(1, mc.enviada ? "Enviada em " + curta(mc.enviada) : "", m1)}
        {passo(2, mc.aprovada ? "Aprovada em " + curta(mc.aprovada) : (mc.recusada ? "Recusada em " + curta(mc.recusada) : ""), m2)}
        {passo(3, mc.contrato ? "Contrato nº " + (ct.numero || "—") + " gerado em " + curta(mc.contrato) : (recusada || atual >= 3 ? "" : "Depois que o cliente aprovar"), m3)}
        {passo(4, mc.assinado ? "Assinado em " + curta(mc.assinado) : (recusada || atual >= 4 ? "" : "Depois de gerar o contrato"), m4)}
      </Card>
    </>
  );
}

// Passo 4: o que falta para o contrato (o resto vem da proposta)
function FormContrato({ x }: { x: Proposta }) {
  const [cfg, setCfg] = useState<ConfigContrato | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => { carregaConfig().then(setCfg).catch((e) => { setErro(true); falha(e); }); }, []);
  if (erro) return <p className="assess-alerta">Não consegui ler os dados da empresa. Se a tabela ainda não existe no banco: npx wrangler d1 execute tardim --remote --file d1/migracoes/012-contratos.sql</p>;
  if (!cfg) return <p className="muted">Carregando os dados da empresa...</p>;
  const empresas = cfg.empresas || [];
  if (!empresas.length) {
    return <>
      <p className="assess-alerta">Antes do primeiro contrato, cadastre os dados da sua empresa: razão social, CNPJ e quem assina. É uma vez só.</p>
      <Acoes><Botao cls="btn btn--red" onClick={() => ir("modelo-contrato")}>Cadastrar os dados da empresa</Botao></Acoes>
    </>;
  }
  return <FormContratoCampos x={x} empresas={empresas} />;
}

function FormContratoCampos({ x, empresas }: { x: Proposta; empresas: NonNullable<ConfigContrato["empresas"]> }) {
  const d = x.dados || {}, cl = d.cliente || {}, ct = d.contrato || {}, ctt = ct.contratante || {}, s = somaItens(d.itens || []);
  let escolhida = 0;
  empresas.forEach((em, i) => { if (ct.empresa && em.cnpj === ct.empresa.cnpj) escolhida = i; });
  const [v, setV] = useState(() => ({
    numero: ct.numero || proximoContrato(), emp: String(escolhida), nome: ctt.nome || cl.nome || x.cliente || "", doc: ctt.cnpj || cl.cnpj || "",
    end: ctt.endereco || cl.endereco || "", rep: ctt.rep_nome || cl.representante || "", cargo: ctt.rep_cargo || "", cpf: ctt.rep_cpf || "", rg: ctt.rep_rg || "",
    pag: ct.pagamento || PAGAMENTOS[0][1], vig: String(ct.vigencia || 12), cond: ct.condicoes || "",
  }));
  const [anexo2, setAnexo2] = useState(!!ct.anexo2);
  const [gerando, setGerando] = useState(false);
  const liga = (k: keyof typeof v) => ({ value: v[k], onChange: (e: { target: { value: string } }) => setV((a) => ({ ...a, [k]: e.target.value })) });
  const temVar = (d.itens || []).some((i) => i.pp);

  function gerar() {
    const falta = ([[v.numero, "o número do contrato"], [v.nome, "o nome do contratante"], [v.doc, "o CNPJ ou CPF do contratante"], [v.rep, "quem assina pelo contratante"]] as [string, string][])
      .filter((p) => !p[0].trim()).map((p) => p[1]);
    if (falta.length) return aviso("Falta preencher " + falta.join(", ") + ".", true);
    const novo: DadosContrato = {
      numero: v.numero.trim(), empresa: Object.assign({}, empresas[Number(v.emp)] || empresas[0]),
      contratante: { nome: v.nome.trim(), cnpj: v.doc.trim(), endereco: v.end.trim(), rep_nome: v.rep.trim(), rep_cargo: v.cargo.trim(), rep_cpf: v.cpf.trim(), rep_rg: v.rg.trim() },
      pagamento: v.pag.trim(), vigencia: Math.min(Math.max(parseInt(v.vig, 10) || 12, 1), 60),
      anexo2: temVar && anexo2, condicoes: v.cond.trim(),
      arquivo_assinado: ct.arquivo_assinado || "", link_assinado: ct.link_assinado || "",
    };
    const c = novo.contratante!;
    // O cliente da proposta fica igual ao do contrato (a próxima proposta impressa já sai completa)
    const cliente = Object.assign({}, cl, { nome: c.nome, cnpj: c.cnpj, endereco: c.endereco, representante: [c.rep_nome, c.rep_cargo].filter(Boolean).join(", ") });
    const w = window.open("", "_blank"); // abre já, no clique, para o navegador não bloquear a janela
    setGerando(true);
    const q = etapaDe(x) === "aprovada" ? marcaEtapa(x, "contrato", null, { contrato: novo, cliente }, { cliente: c.nome })
      : salvaDados(x, { contrato: novo, cliente }, { cliente: c.nome });
    q.then((salva) => {
      imprimeContrato(salva, w);
      depois("Contrato nº " + novo.numero + " gerado. Salve em PDF e mande assinar (passo 5).")();
    }).catch((err) => { setGerando(false); if (w) w.close(); falha(err); });
  }

  return (
    <Form onSubmit={gerar}>
      <p className="andamento-valor assess-grid__full"><strong>{"Valor global: " + reais(s.total)}</strong><span>{" (" + extenso(s.total) + "). Vem da proposta; para mudar, edite os itens no passo 1."}</span></p>
      <Campo rotulo="Número do contrato"><input type="text" maxLength={30} {...liga("numero")} /></Campo>
      <Campo rotulo="Empresa que assina (contratada)">
        <Escolha opcoes={empresas.map((em, i): [string, string] => [String(i), em.razao + (em.cnpj ? " · CNPJ " + em.cnpj : "")])} value={v.emp} onChange={(z) => setV((a) => ({ ...a, emp: z }))} />
      </Campo>
      <Secao titulo="Contratante" sub="Quem contrata e quem assina por ele." />
      <Campo rotulo="Nome ou razão social"><input type="text" maxLength={160} {...liga("nome")} /></Campo>
      <Campo rotulo="CNPJ ou CPF"><input type="text" maxLength={20} {...liga("doc")} /></Campo>
      <Campo rotulo="Endereço" cheio><input type="text" maxLength={200} placeholder="Rua, número, bairro, cidade/UF" {...liga("end")} /></Campo>
      <Campo rotulo="Quem assina pelo contratante"><input type="text" maxLength={160} {...liga("rep")} /></Campo>
      <Campo rotulo="Cargo"><input type="text" maxLength={80} placeholder="Ex.: Presidente, Diretor" {...liga("cargo")} /></Campo>
      <Campo rotulo="CPF de quem assina"><input type="text" maxLength={20} {...liga("cpf")} /></Campo>
      <Campo rotulo="RG de quem assina (opcional)"><input type="text" maxLength={30} {...liga("rg")} /></Campo>
      <Secao titulo="Pagamento e prazos" />
      <Campo rotulo="Forma de pagamento" cheio><textarea rows={4} maxLength={2000} {...liga("pag")} /></Campo>
      <div className="painel-acoes-linha assess-grid__full">
        <span className="muted">Preencher com:</span>
        {PAGAMENTOS.map((p) => <Botao key={p[0]} onClick={() => { setV((a) => ({ ...a, pag: p[1] })); marcaSujo(); }}>{p[0]}</Botao>)}
      </div>
      <Campo rotulo="Vigência (meses)"><input type="number" min={1} max={60} step={1} {...liga("vig")} /></Campo>
      {temVar ? <Marcador className="assess-grid__full" checked={anexo2} onChange={setAnexo2}
        texto={"Incluir o Anexo II: valor do evento para outros números de participantes (" + faixasDe(d).map((n) => n.toLocaleString("pt-BR")).join(", ") + ")"} /> : null}
      <Campo rotulo="Condições específicas deste contrato (opcional)" cheio>
        <textarea rows={3} maxLength={4000} placeholder="Opcional. Uma por linha. Ex.: entrega dos kits na sede do contratante nos 2 dias úteis antes do evento." {...liga("cond")} />
      </Campo>
      <Acoes className="assess-grid__full"><button type="submit" className="btn btn--red btn--lg" disabled={gerando}>Salvar e gerar o contrato</button></Acoes>
    </Form>
  );
}

// Passo 5: como assinar e registro do contrato assinado
function FormAssinatura({ x }: { x: Proposta }) {
  const ct = (x.dados || {}).contrato || {};
  const [data, setData] = useState(hojeIso());
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState(ct.link_assinado || "");
  const [registrando, setRegistrando] = useState(false);
  function registrar() {
    const url = link.trim();
    if (!file && !url) return aviso("Anexe o PDF assinado ou cole o link de onde ele está guardado.", true);
    if (url && !/^https:\/\/\S+$/.test(url)) return aviso("O link precisa começar com https://.", true);
    if (file && !/\.pdf$/i.test(file.name) && file.type !== "application/pdf") return aviso("O arquivo precisa ser um PDF.", true);
    if (file && file.size > 1900000) return aviso("Esse PDF tem mais de 1,9 MB. Guarde no Drive ou no OneDrive e cole o link.", true);
    setRegistrando(true);
    (file ? api("PUT", "propostas/" + encodeURIComponent(x.id) + "/assinado?nome=" + encodeURIComponent(file.name), file, "application/pdf") : Promise.resolve())
      .then(() => marcaEtapa(x, "assinado", data, { contrato: Object.assign({}, ct, { arquivo_assinado: file ? file.name : (ct.arquivo_assinado || ""), link_assinado: url }) }))
      .then(depois("Contrato assinado registrado. Proposta concluída."))
      .catch((e) => { setRegistrando(false); falha(e); });
  }
  return <>
    <ol className="andamento-lista">
      <li>Baixe o PDF do contrato e salve no computador.</li>
      <li>Mande para assinatura. Sem custo: a Tardim e o cliente assinam o mesmo PDF no gov.br (assinador.iti.br), cada um com a conta gov.br nível prata ou ouro, um depois do outro. Se o cliente usar outro sistema de assinatura, siga o dele.</li>
      <li>Com o PDF assinado pelos dois, registre aqui embaixo.</li>
    </ol>
    <Acoes>
      <Botao cls="btn btn--line" onClick={() => imprimeContrato(x)}>Baixar PDF do contrato</Botao>
      <LinkExt href="https://assinador.iti.br/">Abrir o assinador do gov.br ↗</LinkExt>
    </Acoes>
    <Form onSubmit={registrar}>
      <Campo rotulo="Data da assinatura (a última)"><input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Campo>
      <Campo rotulo="PDF assinado (até 1,9 MB)"><input type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /></Campo>
      <Campo rotulo="Ou o link de onde o PDF assinado está guardado" dica="Drive, OneDrive ou o sistema de assinatura. Pode usar os dois." cheio>
        <input type="url" maxLength={500} placeholder="https://drive.google.com/..." value={link} onChange={(e) => setLink(e.target.value)} />
      </Campo>
      <Acoes className="assess-grid__full"><button type="submit" className="btn btn--red btn--lg" disabled={registrando}>Registrar contrato assinado</button></Acoes>
    </Form>
  </>;
}
