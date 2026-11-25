// Conferência agendada das inscrições na Ticket Sports (wrangler.toml ao lado: horários e banco).
import { confereTicketSports } from "../../functions/_lib/ticketsports-situacao.js";

export default {
  async scheduled(evento, env, ctx) {
    ctx.waitUntil(confereTicketSports(env).then((r) => console.log(JSON.stringify(r))));
  },
};
