import mongoose, { type Model, type Types } from "mongoose";

const { model, models, Schema } = mongoose;

export type SyncRunStatus = "running" | "success" | "partial" | "failed";
export type SyncTrigger = "cli" | "admin" | "cron";

export interface SyncKindStats {
  fetched: number;
  created: number;
  updated: number;
  /** Repetidos en el listado, o series cuyo `tmdb_id` ya vino como anime. */
  skipped: number;
  /** `tmdb_id` ya usado por un título del otro tipo (índice único). */
  collisions: number;
  invalid: number;
  /** Títulos nuestros con reproductor que no están en el listado. */
  missing: number;
  /** Títulos a los que se quitó (o, en dry-run, se quitaría) el reproductor. */
  unavailable: number;
  complete: boolean;
}

/** Registro de cada corrida de sincronización de catálogo (colección `sync_runs`). */
export interface SyncRunDoc {
  _id: Types.ObjectId;
  kind: string;
  trigger: SyncTrigger;
  dryRun: boolean;
  options: Record<string, unknown>;
  status: SyncRunStatus;
  startedAt: Date;
  finishedAt?: Date;
  stats: Record<string, SyncKindStats>;
  error?: string;
  triggeredBy?: Types.ObjectId;
}

const runSchema = new Schema<SyncRunDoc>(
  {
    kind: { type: String, required: true },
    trigger: { type: String, enum: ["cli", "admin", "cron"], required: true },
    dryRun: { type: Boolean, required: true },
    options: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ["running", "success", "partial", "failed"], required: true },
    startedAt: { type: Date, required: true },
    finishedAt: Date,
    stats: { type: Schema.Types.Mixed, default: {} },
    error: String,
    triggeredBy: Schema.Types.ObjectId,
  },
  { collection: "sync_runs", versionKey: false, minimize: false },
);

export const SyncRunModel = (models.SyncRun as Model<SyncRunDoc>) ?? model<SyncRunDoc>("SyncRun", runSchema);

/** Candado por nombre: un documento por sincronización, que caduca si el proceso muere sin soltarlo. */
export interface SyncLockDoc {
  _id: string;
  runId: Types.ObjectId;
  lockedUntil: Date;
}

const lockSchema = new Schema<SyncLockDoc>(
  { _id: String, runId: { type: Schema.Types.ObjectId, required: true }, lockedUntil: { type: Date, required: true } },
  { collection: "sync_locks", versionKey: false },
);

export const SyncLockModel = (models.SyncLock as Model<SyncLockDoc>) ?? model<SyncLockDoc>("SyncLock", lockSchema);
