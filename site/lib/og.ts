// Bloco de prévia (Open Graph/Twitter) entre os marcadores <!--og--> e <!--/og-->.
// Sai como texto pronto (set:html) para manter o formato exato: o functions/_middleware.ts troca
// esse bloco, o <title> e o <meta name="description" ... /> do prova.html nas provas do painel.
import { BASE, esc, imagemPrevia } from "./dados.ts";

export interface Og {
  titulo: string;
  descricao: string;
  /** Caminho da imagem no site ("" = assets/compartilhar.jpg) */
  imagem?: string;
  /** Endereço da página relativo ao site ("" = início) */
  caminho: string;
  tipo?: "website" | "article";
}

export function blocoOG({ titulo, descricao, imagem, caminho, tipo }: Og): string {
  const img = imagemPrevia(imagem);
  const url = BASE + caminho;
  return [
    "<!--og-->",
    `    <link rel="canonical" href="${esc(url)}" />`,
    `    <meta property="og:type" content="${tipo || "website"}" />`,
    `    <meta property="og:site_name" content="Tardim Produções" />`,
    `    <meta property="og:locale" content="pt_BR" />`,
    `    <meta property="og:title" content="${esc(titulo)}" />`,
    `    <meta property="og:description" content="${esc(descricao)}" />`,
    `    <meta property="og:image" content="${esc(img)}" />`,
    `    <meta property="og:image:secure_url" content="${esc(img)}" />`,
    ...(/compartilhar\.jpg$/.test(img)
      ? [
          `    <meta property="og:image:type" content="image/jpeg" />`,
          `    <meta property="og:image:width" content="1200" />`,
          `    <meta property="og:image:height" content="630" />`,
        ]
      : []),
    `    <meta property="og:image:alt" content="${esc(titulo)}" />`,
    `    <meta property="og:url" content="${esc(url)}" />`,
    `    <meta name="twitter:card" content="summary_large_image" />`,
    "    <!--/og-->",
  ].join("\n");
}

/** <meta name="description" ... /> no formato que o middleware procura */
export const metaDescricao = (d: string): string => `<meta name="description" content="${esc(d)}" />`;
