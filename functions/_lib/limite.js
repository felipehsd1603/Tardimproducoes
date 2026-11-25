// Limite de envios por IP para as funções públicas (tabela envios_tentativas, d1/schema.sql).
// Devolve true se o envio pode seguir, e já o registra; false se o IP passou do limite.
export async function dentroDoLimite(env, request, rota, max, janela) {
  const ip = request.headers.get("cf-connecting-ip") || "";
  const agora = Math.floor(Date.now() / 1000);
  await env.DB.prepare("DELETE FROM envios_tentativas WHERE quando < ?").bind(agora - 86400).run();
  const conta = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM envios_tentativas WHERE rota = ? AND ip = ? AND quando >= ?"
  ).bind(rota, ip, agora - janela).first();
  if (conta && conta.n >= max) return false;
  await env.DB.prepare("INSERT INTO envios_tentativas (rota, ip, quando) VALUES (?, ?, ?)").bind(rota, ip, agora).run();
  return true;
}
