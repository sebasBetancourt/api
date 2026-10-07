import type { mongo, PipelineStage, Types } from "mongoose";
import type { TitleType } from "../interfaces/title.interface.js";
import type { VimeusTitle } from "../libs/vimeusMapper.js";
import { TitleModel, type TitleDoc } from "../models/title.model.js";

/** Películas y series usan espacios de ids distintos en TMDB; series y anime comparten el de TV. */
export const tmdbNamespace = (type: TitleType): TitleType[] => (type === "movie" ? ["movie"] : ["tv", "anime"]);

/** Campos que la sincronización puede cambiar: se guardan antes de escribir para poder revertir. */
export type RollbackRow = Pick<TitleDoc, "_id" | "embed_url" | "posterUrl" | "imdb_id" | "backdropUrl" | "quality">;
const rollbackFields = { embed_url: 1, posterUrl: 1, imdb_id: 1, backdropUrl: 1, quality: 1 } as const;

const lit = (value: unknown) => ({ $literal: value });
/** Conserva el valor actual del campo; si no existe, usa `value`. */
const keep = (field: string, value: unknown) => ({ [field]: { $ifNull: [`$${field}`, lit(value)] } });

/**
 * Update pipeline idempotente para un ítem de Vimeus. El reproductor, la calidad y el backdrop siempre se
 * actualizan; póster e imdb solo si faltan (no se pisan los curados); el resto solo se rellena al insertar.
 * Todo valor externo va en `$literal` para que un título que empiece por "$" no se lea como campo.
 */
export function upsertPipeline(it: VimeusTitle, runStart: Date): PipelineStage.Set[] {
  return [{
    $set: {
      embed_url: lit(it.embedUrl),
      vimeusSyncedAt: lit(runStart),
      ...(it.quality && { quality: lit(it.quality) }),
      ...(it.backdropUrl && { backdropUrl: lit(it.backdropUrl) }),
      ...(it.posterUrl && keep("posterUrl", it.posterUrl)),
      ...(it.imdbId && keep("imdb_id", it.imdbId)),
      source: { $cond: [{ $gt: ["$createdAt", null] }, "$source", lit("vimeus")] },
      ...keep("type", it.type),
      ...keep("title", it.title),
      ...keep("description", ""),
      ...keep("status", "approved"),
      ...keep("createdAt", runStart),
      ...keep("likes", 0),
      ...keep("dislikes", 0),
      ...keep("ratingAvg", 0),
      ...keep("ratingCount", 0),
      ...keep("categoriesIds", []),
    },
  }];
}

export const titleSyncRepository = {
  /** Títulos ya existentes (del mismo espacio de ids de TMDB) por `tmdb_id`. */
  async findExisting(type: TitleType, tmdbIds: number[]) {
    const rows = await TitleModel.find({ tmdb_id: { $in: tmdbIds }, type: { $in: tmdbNamespace(type) } })
      .select({ ...rollbackFields, tmdb_id: 1 }).lean();
    return new Map(rows.map((r) => [r.tmdb_id!, r as RollbackRow]));
  },

  /** `tmdb_id` ocupados por títulos del otro espacio (película vs serie): chocan con el índice único viejo. */
  async findForeignTmdbIds(type: TitleType, tmdbIds: number[]) {
    const rows = await TitleModel.find({ tmdb_id: { $in: tmdbIds }, type: { $nin: tmdbNamespace(type) } }).select("tmdb_id").lean();
    return new Set(rows.map((r) => r.tmdb_id!));
  },

  /** `tmdb_id` que ya tienen el reproductor de anime de Vimeus: el listado de series no debe pisarlos. */
  async findAnimeTmdbIds(tmdbIds: number[]) {
    const rows = await TitleModel.find({ tmdb_id: { $in: tmdbIds }, embed_url: { $regex: /^https:\/\/vimeus\.com\/e\/anime\?/ } })
      .select("tmdb_id").lean();
    return new Set(rows.map((r) => r.tmdb_id!));
  },

  async findUsedImdbIds(imdbIds: string[]) {
    const rows = await TitleModel.find({ imdb_id: { $in: imdbIds } }).select("imdb_id tmdb_id type").lean();
    return new Map(rows.map((r) => [r.imdb_id!, r]));
  },

  /** ¿Sigue el índice único sobre `tmdb_id` solo (impide repetir el id entre películas y series)? */
  async hasLegacyTmdbIndex() {
    const indexes = await TitleModel.collection.indexes();
    return indexes.some((i) => i.unique && JSON.stringify(i.key) === JSON.stringify({ tmdb_id: 1 }));
  },

  /** Series/anime sin `tmdb_id` con el mismo título: probables duplicados que la sync no puede enlazar. */
  async findUnlinkedByTitle(type: TitleType, titles: string[]) {
    const rows = await TitleModel.find({ type: { $in: tmdbNamespace(type) }, tmdb_id: { $exists: false } })
      .select("title type").lean();
    const wanted = new Set(titles.map((t) => t.toLocaleLowerCase("es")));
    return rows.filter((r) => wanted.has(r.title.toLocaleLowerCase("es")));
  },

  countSynced: (type: TitleType) => TitleModel.countDocuments({ type, vimeusSyncedAt: { $exists: true } }),

  /** Títulos de `type` con reproductor que no aparecen entre `seenTmdbIds`. */
  countMissing: (type: TitleType, seenTmdbIds: number[]) =>
    TitleModel.countDocuments({ type, embed_url: { $exists: true }, tmdb_id: { $nin: seenTmdbIds } }),

  async upsertMany(items: VimeusTitle[], runStart: Date) {
    const ops: mongo.AnyBulkWriteOperation[] = items.map((it) => ({
      updateOne: {
        filter: { tmdb_id: it.tmdbId, type: { $in: tmdbNamespace(it.type) } },
        update: upsertPipeline(it, runStart),
        upsert: true,
      },
    }));
    try {
      // Driver nativo: Mongoose no castea update pipelines y así el error de lote es el del driver.
      const r = await TitleModel.collection.bulkWrite(ops, { ordered: false });
      return { created: r.upsertedCount, updated: r.matchedCount, duplicates: 0 };
    } catch (e) {
      // Con ordered:false Mongo aplica el resto y reporta cada clave duplicada (E11000) en writeErrors.
      const err = e as { code?: number; writeErrors?: { code?: number }[]; result?: { upsertedCount?: number; matchedCount?: number } };
      const writeErrors = err.writeErrors ?? [];
      if (!err.result || writeErrors.length === 0 || writeErrors.some((w) => w.code !== 11000)) throw e;
      return { created: err.result.upsertedCount ?? 0, updated: err.result.matchedCount ?? 0, duplicates: writeErrors.length };
    }
  },

  /** Títulos de `type` con reproductor que esta corrida no marcó (no se tocan reseñas, listas ni metadatos). */
  findUnseen: (type: TitleType, runStart: Date) =>
    TitleModel.find({ type, embed_url: { $exists: true }, vimeusSyncedAt: { $ne: runStart } })
      .select(rollbackFields).lean<RollbackRow[]>(),

  unpublish: (ids: Types.ObjectId[]) =>
    TitleModel.updateMany({ _id: { $in: ids } }, { $unset: { embed_url: "" } }).then((r) => r.modifiedCount),
};
