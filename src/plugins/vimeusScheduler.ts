import type { FastifyInstance } from "fastify";
import cron from "node-cron";
import { AppError } from "../libs/appError.js";
import { env } from "../libs/env.js";
import { redactSecrets } from "../services/vimeus/syncVimeusCatalogService.js";
import { vimeusSync } from "../services/vimeus/vimeusAdminServices.js";

/** Sincronización diaria con Vimeus (si VIMEUS_SYNC_ENABLED). Respeta el candado: nunca corre dos a la vez. */
export async function vimeusScheduler(app: FastifyInstance) {
  if (!env.VIMEUS_API_KEY) {
    app.log.warn("VIMEUS_SYNC_ENABLED=true pero falta VIMEUS_API_KEY: la sincronización diaria queda desactivada.");
    return;
  }
  if (!cron.validate(env.VIMEUS_SYNC_CRON)) {
    app.log.error(`VIMEUS_SYNC_CRON no es una expresión cron válida ("${env.VIMEUS_SYNC_CRON}"); sincronización diaria desactivada.`);
    return;
  }
  const task = cron.schedule(
    env.VIMEUS_SYNC_CRON,
    async () => {
      try {
        const r = await vimeusSync.run({ trigger: "cron" });
        app.log.info({ runId: r.runId, status: r.status, stats: r.stats }, "Sincronización diaria con Vimeus terminada");
      } catch (e) {
        if (e instanceof AppError && e.statusCode === 409) app.log.info("Sincronización diaria omitida: ya hay una en curso.");
        else app.log.error(redactSecrets(`Sincronización diaria con Vimeus fallida: ${(e as Error).message}`));
      }
    },
    { name: "vimeus-sync", noOverlap: true },
  );
  app.log.info(`Sincronización diaria con Vimeus programada ("${env.VIMEUS_SYNC_CRON}").`);
  app.addHook("onClose", async () => {
    await task.destroy();
  });
}
