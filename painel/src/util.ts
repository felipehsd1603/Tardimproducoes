// Utilidades sem tela: datas, textos, dinheiro, telefone (as mesmas do painel antigo, js/admin.js).

export const site: SiteTardim = typeof SITE !== "undefined" ? SITE : {};
export const ESTATICAS: ProvaEventos[] = (typeof PROXIMAS !== "undefined" ? PROXIMAS : []).filter((p) => p.id && !p.demo);

export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const TIPOS: Record<string, string> = { embaixador: "Embaixador", influenciador: "Influenciador", assessoria: "Assessoria", equipe: "Equipe" };
export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
// Mesma lista de functions/_admin/comum.ts; o primeiro tem registro conferido no CREF6
export const PROFISSOES = [
  "Profissional de Educação Física (CREF6/MG)", "Profissional de Educação Física (outro CREF)",
  "Fisioterapeuta", "Nutricionista", "Médico", "Atleta/corredor", "Outro",
];

export const cidadeUf = (p: { cidade?: string; uf?: string }) => (p.cidade || "") + (p.cidade && p.uf ? "/" + p.uf : "");
export const seguidoresTxt = (n: number | undefined) => (n ? Number(n).toLocaleString("pt-BR") + " seguidores" : "");

export function dataDe(str: string): Date { const p = String(str).split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); }
export function quando(str: string | undefined): string { if (!str) return ""; const d = dataDe(str); return d.getDate() + " de " + MESES[d.getMonth()] + " de " + d.getFullYear(); }
export function curta(str: string | undefined): string { if (!str) return ""; const p = String(str).split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
export function hoje(): Date { const h = new Date(); h.setHours(0, 0, 0, 0); return h; }
export function hojeIso(): string { const t = new Date(); return new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
export function slug(s: string | undefined): string {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");
}
export function linhas(txt: string | undefined): string[] { return String(txt || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean); }
export function reais(n: number | undefined): string { return (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
export function dataHora(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
export const dataCurtaHora = (v: string | undefined) => (v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");

/** Endereço do site (para os links de prova, kit, convite): a pasta desta página, ou SITE.urlBase fora do http */
export function base(): string {
  if (/^https?:$/.test(location.protocol)) return location.href.split("#")[0].split("?")[0].replace(/[^/]*$/, "");
  return (site.urlBase || "").replace(/\/?$/, "/");
}

// Mesma máscara de js/parceiro.js: (31) 99999-9999 celular, (31) 3333-4444 fixo, sem o +55
export function mascaraTel(v: string | undefined): string {
  let d = String(v || "").replace(/\D/g, "");
  if (d.length > 11 && d.indexOf("55") === 0) d = d.slice(2);
  d = d.slice(0, 11);
  return d.length > 10 ? d.replace(/^(\d{2})(\d{5})(\d{0,4})$/, "($1) $2-$3")
    : d.length > 6 ? d.replace(/^(\d{2})(\d{4})(\d{0,4})$/, "($1) $2-$3")
    : d.length > 2 ? d.replace(/^(\d{2})(\d+)$/, "($1) $2")
    : d.length ? "(" + d : "";
}
export function numeroWa(t: string | undefined): string { let n = String(t || "").replace(/\D/g, ""); if (n && n.length <= 11) n = "55" + n; return n; }
export const linkWa = (t: string | undefined, texto?: string) => "https://wa.me/" + numeroWa(t) + (texto != null ? "?text=" + encodeURIComponent(texto) : "");
export const semArroba = (s: string) => s.replace(/^@/, "");

export const enc = (x: unknown) => encodeURIComponent(String(x));
export const plural = (n: number, um: string, varios: string) => n + (n === 1 ? um : varios);

export function copiar(texto: string, b: HTMLButtonElement | null): void {
  if (!b) return;
  const orig = b.textContent;
  const feito = () => { b.textContent = "Copiado!"; setTimeout(() => { b.textContent = orig; }, 1800); };
  if (navigator.clipboard) navigator.clipboard.writeText(texto).then(feito, () => {});
}

// "R$ 1.000,00", "1000", "2,5" -> número
export function numBR(s: unknown): number {
  let t = String(s == null ? "" : s).replace(/[^\d.,-]/g, "");
  if (t.indexOf(",") >= 0) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  return Number(t) || 0;
}
// Valor de uma planilha (número ou texto com R$, ponto e vírgula)
export function valorNum(v: unknown): number {
  if (typeof v === "number") return v;
  let s = String(v || "").replace(/[^\d,.-]/g, "");
  if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
  return parseFloat(s) || 0;
}
export const qtdTxt = (n: number) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

// 155273 -> "cento e cinquenta e cinco mil, duzentos e setenta e três reais"
export function extenso(valor: number): string {
  const U = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const D = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const C = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
  function ate999(n: number): string {
    if (n === 100) return "cem";
    const p: string[] = [];
    if (n >= 100) { p.push(C[Math.floor(n / 100)]); n %= 100; }
    if (n >= 20) { p.push(D[Math.floor(n / 10)]); n %= 10; }
    if (n > 0) p.push(U[n]);
    return p.join(" e ");
  }
  function inteiro(n: number): string {
    if (n === 0) return "zero";
    const g: { t: string; v: number }[] = [], mi = Math.floor(n / 1e6), mil = Math.floor((n % 1e6) / 1000), r = n % 1000;
    if (mi) g.push({ t: ate999(mi) + (mi === 1 ? " milhão" : " milhões"), v: mi });
    if (mil) g.push({ t: (mil === 1 ? "" : ate999(mil) + " ") + "mil", v: mil });
    if (r) g.push({ t: ate999(r), v: r });
    if (g.length === 1) return g[0].t;
    const ult = g.pop()!;
    // "e" antes do último grupo quando ele é menor que 100 ou centena exata: "dois mil e um", "mil e duzentos"
    const liga = ult.v < 100 || ult.v % 100 === 0 ? " e " : ", ";
    return g.map((x) => x.t).join(", ") + liga + ult.t;
  }
  const v = Math.round((Number(valor) || 0) * 100), re = Math.floor(v / 100), ce = v % 100;
  let txt = inteiro(re) + (re % 1e6 === 0 && re > 0 ? " de" : "") + (re === 1 ? " real" : " reais");
  if (ce) txt += " e " + inteiro(ce) + (ce === 1 ? " centavo" : " centavos");
  return txt;
}

export function escHtml(t: unknown): string {
  return String(t == null ? "" : t).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as Record<string, string>)[ch]);
}

// Reduz a arte para JPG de até 1600 px (a prévia do WhatsApp lê melhor JPG)
export function comprime(file: File): Promise<Blob> {
  return new Promise((ok, erro) => {
    if (!/^image\//.test(file.type)) return erro(new Error("o arquivo da arte não é uma imagem"));
    const img = new Image();
    img.onload = () => {
      const esc = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.naturalWidth * esc); cv.height = Math.round(img.naturalHeight * esc);
      const cx = cv.getContext("2d")!;
      cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height);
      cx.drawImage(img, 0, 0, cv.width, cv.height);
      cv.toBlob((b) => (b ? ok(b) : erro(new Error("não consegui converter a arte"))), "image/jpeg", 0.88);
    };
    img.onerror = () => erro(new Error("não consegui abrir a imagem"));
    img.src = URL.createObjectURL(file);
  });
}
// Logo: PNG de até 400 px, mantendo a transparência
export function comprimeLogo(file: File): Promise<Blob> {
  return new Promise((ok, erro) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return erro(new Error("a logo precisa ser PNG, JPG ou WebP"));
    const img = new Image();
    img.onload = () => {
      const esc = Math.min(1, 400 / Math.max(img.naturalWidth, img.naturalHeight));
      const cv = document.createElement("canvas");
      cv.width = Math.max(1, Math.round(img.naturalWidth * esc)); cv.height = Math.max(1, Math.round(img.naturalHeight * esc));
      cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
      cv.toBlob((b) => (b ? ok(b) : erro(new Error("não consegui converter a logo"))), "image/png");
    };
    img.onerror = () => erro(new Error("não consegui abrir a logo"));
    img.src = URL.createObjectURL(file);
  });
}

export function baixaPlanilha(linhasP: Record<string, unknown>[], aba: string, arquivo: string): boolean {
  const X = window.XLSX;
  if (!X) return false;
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, X.utils.json_to_sheet(linhasP), aba);
  X.writeFile(wb, arquivo);
  return true;
}
