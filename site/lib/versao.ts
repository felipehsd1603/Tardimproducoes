// ?v= dos arquivos CSS e JS, para o navegador dos visitantes baixar a versão nova depois de cada publicação.
// Commit no GitHub Actions ou no Cloudflare Pages; TARDIM_VERSAO se definida; senão, data e hora do build.
// (O scripts/montar-publico.mjs lê este valor do index.html gerado e aplica no admin.html.)
function carimbo(d: Date): string {
  const z = (n: number) => String(n).padStart(2, "0");
  return d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + "-" + z(d.getHours()) + z(d.getMinutes());
}

export const VERSAO: string =
  process.env.TARDIM_VERSAO || (process.env.GITHUB_SHA || process.env.CF_PAGES_COMMIT_SHA || "").slice(0, 8) || carimbo(new Date());

/** "css/style.css" -> "css/style.css?v=<versão>" */
export const comVersao = (arquivo: string): string => `${arquivo}?v=${VERSAO}`;
