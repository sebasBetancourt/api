import type { Types } from "mongoose";
import type { TitleType } from "../../interfaces/title.interface.js";
import { AppError } from "../../libs/appError.js";
import { env } from "../../libs/env.js";
import { createVimeusClient, VimeusFatalError, VimeusPageError, type VimeusClient, type VimeusKind } from "../../libs/vimeusClient.js";
import { KIND_TO_TYPE, mapVimeusItems, type VimeusTitle } from "../../libs/vimeusMapper.js";
import { oid } from "../../libs/mongoHelpers.js";
import type { SyncKindStats, SyncRunStatus, SyncTrigger } from "../../models/syncRun.model.js";
import { syncRunRepository } from "../../repositories/syncRun.repository.js";
import { titleSyncRepository, type RollbackRow } from "../../repositories/titleSync.repository.js";

/** Anime antes que series: si un `tmdb_id` viene en ambos listados se queda como anime. */
export const SYNC_ORDER: VimeusKind[] = ["animes", "series", "movies"];
export const SYNC_LOCK = "vimeus-catalog";
const LOCK_TTL_MS = 30 * 60_000;
const BATCH = 500;
/** Para quitar reproductores, el listado debe traer al menos este % de los títulos ya sincronizados. */
const UNPUBLISH_MIN_RATIO = 0.8;
/** Tipos que comparten espacio de ids: quitar reproductores de uno exige haber recorrido ambos listados. */
const NAMESPACE_KINDS: Record<TitleType, VimeusKind[]> = { movie: ["movies"], tv: ["series", "animes"], anime: ["series", "animes"] };

export interface SyncOptions {
  trigger: SyncTrigger;
  kinds?: VimeusKind[];
  dryRun?: boolean;
  unpublishMissing?: boolean;
  maxPages?: number;
  triggeredBy?: string;
  /** Recibe los campos actuales de los títulos justo antes de modificarlos (copia para revertir). */
  onBeforeWrite?: (rows: RollbackRow[]) => Promise<void> | void;
  onProgress?: (message: string) => void;
}

export interface SyncResult {
  runId: string;
  status: SyncRunStatus;
  stats: Record<string, SyncKindStats>;
  notes: string[];
  /** Series/anime nuestros sin `tmdb_id` con el mismo título que uno nuevo de Vimeus. */
  possibleDuplicates: string[];
}

interface Logger {
  info: (msg: string) => void;
  error: (msg: string) => void;
}

/** Quita de un texto la API key y cualquier `view_key` antes de guardarlo o loguearlo. */
export function redactSecrets(text: string, apiKey = env.VIMEUS_API_KEY) {
  const out = text.replace(/view_key=[^&\s"']+/g, "view_key=***");
  return apiKey ? out.split(apiKey).join("***") : out;
}

const emptyStats = (): SyncKindStats => ({
  fetched: 0, created: 0, updated: 0, skipped: 0, collisions: 0, invalid: 0, unavailable: 0, missing: 0, complete: false,
});

function clientFromEnv(): VimeusClient {
  if (!env.VIMEUS_API_KEY) throw new AppError(503, "La sincronización con Vimeus no está configurada (falta VIMEUS_API_KEY).");
  return createVimeusClient({ apiKey: env.VIMEUS_API_KEY, baseUrl: env.VIMEUS_BASE_URL });
}

export interface SyncDeps {
  client?: VimeusClient;
  titles?: typeof titleSyncRepository;
  runs?: typeof syncRunRepository;
  log?: Logger;
}

export function createVimeusSync({ client, titles = titleSyncRepository, runs = syncRunRepository, log = console }: SyncDeps = {}) {
  /** Toma el candado y registra la corrida; 409 si ya hay otra. `execute` hace el trabajo y suelta el candado. */
  async function start(opts: SyncOptions) {
    const vimeus = client ?? clientFromEnv();
    const runId = runs.newId();
    if (!(await runs.acquireLock(SYNC_LOCK, runId, LOCK_TTL_MS))) {
      throw new AppError(409, "Ya hay una sincronización con Vimeus en curso.");
    }
    const startedAt = new Date();
    const kinds = SYNC_ORDER.filter((k) => !opts.kinds || opts.kinds.includes(k));
    try {
      await runs.create({
        _id: runId, kind: "vimeus", trigger: opts.trigger, dryRun: !!opts.dryRun, status: "running", startedAt, stats: {},
        options: { kinds, unpublishMissing: !!opts.unpublishMissing, ...(opts.maxPages && { maxPages: opts.maxPages }) },
        ...(opts.triggeredBy && { triggeredBy: oid(opts.triggeredBy) }),
      });
    } catch (e) {
      await runs.releaseLock(SYNC_LOCK, runId);
      throw e;
    }
    return { runId: String(runId), execute: () => execute(vimeus, runId, startedAt, kinds, opts) };
  }

  async function execute(
    vimeus: VimeusClient, runId: Types.ObjectId, runStart: Date, kinds: VimeusKind[], opts: SyncOptions,
  ): Promise<SyncResult> {
    const stats: Record<string, SyncKindStats> = {};
    const notes: string[] = [];
    const possibleDuplicates: string[] = [];
    const progress = opts.onProgress ?? (() => {});
    try {
      // 1. Leer y validar todos los listados antes de escribir nada.
      const fetched = new Map<VimeusKind, VimeusTitle[]>();
      for (const kind of kinds) {
        const s = (stats[kind] = emptyStats());
        progress(`Leyendo ${kind}…`);
        try {
          const listing = await vimeus.listAll(kind, { maxPages: opts.maxPages });
          const { items, invalid, duplicates } = mapVimeusItems(kind, listing.items);
          Object.assign(s, { fetched: listing.items.length, invalid, skipped: duplicates, complete: listing.complete });
          if (listing.failedPages.length) notes.push(`${kind}: no respondieron las páginas ${listing.failedPages.join(", ")}.`);
          fetched.set(kind, items);
        } catch (e) {
          if (!(e instanceof VimeusPageError)) throw e;
          notes.push(`${kind}: ${e.message} No se procesa este tipo.`);
          fetched.set(kind, []);
        }
        await runs.renewLock(SYNC_LOCK, runId, LOCK_TTL_MS);
      }

      // 2. Escribir (o, en dry-run, calcular lo que se escribiría) tipo por tipo.
      const legacyIndex = await titles.hasLegacyTmdbIndex();
      const animeIds = new Set((fetched.get("animes") ?? []).map((i) => i.tmdbId));
      const seenIds = new Map<TitleType, number[]>();
      const previouslySynced = new Map<TitleType, number>();
      for (const kind of kinds) previouslySynced.set(KIND_TO_TYPE[kind], await titles.countSynced(KIND_TO_TYPE[kind]));
      for (const kind of kinds) {
        const s = stats[kind];
        const type = KIND_TO_TYPE[kind];
        let items = fetched.get(kind)!;
        if (kind === "series") {
          const before = items.length;
          items = items.filter((i) => !animeIds.has(i.tmdbId));
          s.skipped += before - items.length;
        }
        if (legacyIndex && items.length) {
          const foreign = await titles.findForeignTmdbIds(type, items.map((i) => i.tmdbId));
          s.collisions += items.filter((i) => foreign.has(i.tmdbId)).length;
          items = items.filter((i) => !foreign.has(i.tmdbId));
        }
        items = await dropTakenImdbIds(items);
        seenIds.set(type, items.map((i) => i.tmdbId));

        const existing = await titles.findExisting(type, items.map((i) => i.tmdbId));
        const newOnes = items.filter((i) => !existing.has(i.tmdbId));
        if (type !== "movie" && newOnes.length) {
          const dups = await titles.findUnlinkedByTitle(type, newOnes.map((i) => i.title));
          possibleDuplicates.push(...dups.map((d) => `${d.title} (${d.type})`));
        }

        if (opts.dryRun) {
          s.created = newOnes.length;
          s.updated = existing.size;
        } else {
          for (let i = 0; i < items.length; i += BATCH) {
            const batch = items.slice(i, i + BATCH);
            await opts.onBeforeWrite?.(batch.flatMap((it) => existing.get(it.tmdbId) ?? []));
            const r = await titles.upsertMany(batch, runStart);
            s.created += r.created;
            s.updated += r.updated;
            s.collisions += r.duplicates;
            await runs.renewLock(SYNC_LOCK, runId, LOCK_TTL_MS);
            progress(`${kind}: ${Math.min(i + BATCH, items.length)}/${items.length}`);
          }
        }
      }

      // 3. Títulos que ya no están en el listado.
      for (const kind of kinds) {
        const s = stats[kind];
        const type = KIND_TO_TYPE[kind];
        const namespaceIds = NAMESPACE_KINDS[type].flatMap((k) => seenIds.get(KIND_TO_TYPE[k]) ?? []);
        s.missing = await titles.countMissing(type, namespaceIds);
        if (!opts.unpublishMissing) continue;
        const blocked = unpublishBlocker(type, kinds, stats, seenIds.get(type)?.length ?? 0, previouslySynced.get(type) ?? 0);
        if (blocked) {
          notes.push(`${kind}: no se quita ningún reproductor (${blocked}).`);
          continue;
        }
        if (opts.dryRun) {
          s.unavailable = s.missing;
          continue;
        }
        const rows = await titles.findUnseen(type, runStart);
        await opts.onBeforeWrite?.(rows);
        s.unavailable = rows.length ? await titles.unpublish(rows.map((r) => r._id)) : 0;
      }

      const status: SyncRunStatus = kinds.every((k) => stats[k].complete) ? "success" : "partial";
      await runs.finish(runId, { status, stats });
      return { runId: String(runId), status, stats, notes, possibleDuplicates };
    } catch (e) {
      const known = e instanceof VimeusFatalError || e instanceof AppError;
      const message = known ? (e as Error).message : "Error interno durante la sincronización.";
      log.error(redactSecrets(`Sincronización Vimeus fallida: ${e instanceof Error ? e.stack ?? e.message : String(e)}`));
      await runs.finish(runId, { status: "failed", stats, error: redactSecrets(message) }).catch(() => {});
      if (known) throw e;
      throw new AppError(500, message);
    } finally {
      await runs.releaseLock(SYNC_LOCK, runId).catch(() => {});
    }
  }

  /** Un `imdb_id` ya usado por otro título haría fallar el índice único: el ítem se guarda sin él. */
  async function dropTakenImdbIds(items: VimeusTitle[]) {
    const imdbIds = items.flatMap((i) => i.imdbId ?? []);
    if (!imdbIds.length) return items;
    const used = await titles.findUsedImdbIds(imdbIds);
    return items.map((i) => {
      const owner = i.imdbId ? used.get(i.imdbId) : undefined;
      const sameTitle = owner && owner.tmdb_id === i.tmdbId && NAMESPACE_KINDS[i.type].includes(kindOf(owner.type));
      if (!owner || sameTitle) return i;
      const { imdbId: _drop, ...rest } = i;
      return rest;
    });
  }

  /** Motivo para no quitar reproductores, o null si es seguro hacerlo. */
  function unpublishBlocker(
    type: TitleType, kinds: VimeusKind[], stats: Record<string, SyncKindStats>, seen: number, previously: number,
  ): string | null {
    const needed = NAMESPACE_KINDS[type];
    if (!needed.every((k) => kinds.includes(k))) return `hay que sincronizar a la vez ${needed.join(" y ")}`;
    if (!needed.every((k) => stats[k].complete)) return "el listado vino incompleto";
    if (previously === 0) return "es la primera corrida para este tipo";
    if (seen < previously * UNPUBLISH_MIN_RATIO) {
      return `el listado trae ${seen} y ya había ${previously} sincronizados (< ${UNPUBLISH_MIN_RATIO * 100} %)`;
    }
    return null;
  }

  return {
    start,
    /** Corre la sincronización completa y espera el resultado (CLI y tarea diaria). */
    async run(opts: SyncOptions) {
      return (await start(opts)).execute();
    },
  };
}

const kindOf = (type: TitleType): VimeusKind => (type === "movie" ? "movies" : type === "tv" ? "series" : "animes");
