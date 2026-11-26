// Peças comuns dos roteadores Hono (functions/api/*/[[rota]].ts).
//
// O Hono só escolhe a rota; o contrato continua o de antes (formato de erro de cada área, ordem das conferências).
// Duas diferenças do Hono que estas peças neutralizam:
//  - HEAD: o Hono responde HEAD com a rota GET. Antes, HEAD só casava rotas de "qualquer método", então
//    `metodo()` deixa a rota passar adiante (next) quando o método de verdade não é o dela.
//  - Codificação inválida (%E0): antes, decodeURIComponent dos segmentos lançava erro fora do try (o Pages
//    responde 500). `segmentos()` repete a mesma conta antes de entrar no Hono, para dar o mesmo resultado.

import type { Context, MiddlewareHandler } from "hono";
import type { Env } from "./tipos.ts";

/** Ambiente das apps Hono: o Env do projeto (o handle() do hono/cloudflare-pages acrescenta eventContext). */
export type AppHono = { Bindings: Env };
export type Ctx = Context<AppHono, any>;

/** Segmentos da rota como o Pages entrega em params ([[rota]]), decodificados como antes (pode lançar URIError). */
export function segmentos(params: Record<string, string | string[] | undefined>, nome: string): string[] {
  return ([] as string[]).concat(params[nome] || []).map((x) => decodeURIComponent(x));
}

/**
 * Handler que só atende o método pedido ("*" = qualquer um). Com outro método (inclusive HEAD, que o Hono
 * manda para as rotas GET), segue para a próxima rota que casar, como o laço da tabela de rotas fazia.
 */
export function metodo(m: string, fn: (c: Ctx) => Response | Promise<Response>): MiddlewareHandler<AppHono, any> {
  return async (c, next) => (m === "*" || c.req.method === m ? fn(c) : next());
}
