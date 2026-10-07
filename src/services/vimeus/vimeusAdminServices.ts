import type { FastifyBaseLogger } from "fastify";
import type { VimeusSyncStatusDto } from "../../interfaces/syncRun.interface.js";
import { env } from "../../libs/env.js";
import { adminRepository } from "../../repositories/admin.repository.js";
import { syncRunRepository } from "../../repositories/syncRun.repository.js";
import { createVimeusSync, SYNC_LOCK } from "./syncVimeusCatalogService.js";

export const vimeusSync = createVimeusSync();

/** Lanza una sincronización en segundo plano y devuelve su id; 409 si ya hay una en curso. */
export async function startVimeusSyncService(adminId: string, log: FastifyBaseLogger) {
  const { runId, execute } = await vimeusSync.start({ trigger: "admin", triggeredBy: adminId });
  // `execute` ya registra el fallo en sync_runs y lo loguea sin secretos.
  void execute().catch(() => {});
  await adminRepository.audit(adminId, "vimeus.sync", "sync_run", runId).catch((e) => log.error(e));
  return { runId };
}

export async function getVimeusSyncStatusService(): Promise<VimeusSyncStatusDto> {
  const [last, running] = await Promise.all([syncRunRepository.latest("vimeus"), syncRunRepository.isLocked(SYNC_LOCK)]);
  return {
    configured: !!env.VIMEUS_API_KEY,
    scheduled: env.VIMEUS_SYNC_ENABLED,
    running,
    last: last && {
      id: String(last._id),
      // Si el proceso murió a mitad, el registro sigue "running" pero el candado ya caducó.
      status: last.status === "running" && !running ? "failed" : last.status,
      trigger: last.trigger,
      startedAt: last.startedAt,
      finishedAt: last.finishedAt ?? null,
      stats: last.stats ?? {},
      error: last.error ?? (last.status === "running" && !running ? "La corrida se interrumpió." : null),
    },
  };
}
