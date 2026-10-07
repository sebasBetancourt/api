import type { SyncKindStats, SyncRunStatus, SyncTrigger } from "../models/syncRun.model.js";

export interface SyncRunDto {
  id: string;
  status: SyncRunStatus;
  trigger: SyncTrigger;
  startedAt: Date;
  finishedAt: Date | null;
  stats: Record<string, SyncKindStats>;
  error: string | null;
}

export interface VimeusSyncStatusDto {
  /** Hay API key de Vimeus en el servidor. */
  configured: boolean;
  /** La tarea diaria está activada (VIMEUS_SYNC_ENABLED). */
  scheduled: boolean;
  running: boolean;
  last: SyncRunDto | null;
}
