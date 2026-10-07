import type { PipelineStage } from "mongoose";
import type { TitleDto, TitleStatus, TitleType } from "../interfaces/title.interface.js";
import { escapeRegex, oid, oids, safeOid } from "../libs/mongoHelpers.js";
import { ReviewModel, ReviewReactionModel } from "../models/review.model.js";
import { TitleModel } from "../models/title.model.js";
import { UserModel } from "../models/user.model.js";

const lookups: PipelineStage[] = [
  { $lookup: { from: "categories", localField: "categoriesIds", foreignField: "_id", as: "categories", pipeline: [{ $project: { name: 1 } }] } },
  { $lookup: { from: "users", localField: "createdBy", foreignField: "_id", as: "creator", pipeline: [{ $project: { name: 1 } }] } },
];

/* eslint-disable @typescript-eslint/no-explicit-any */
export function toTitleDto(t: any): TitleDto {
  return {
    id: String(t._id),
    type: t.type,
    title: t.title,
    description: t.description ?? "",
    author: t.author ?? null,
    year: t.year ?? null,
    seasons: t.temps ?? null,
    episodes: t.eps ?? t.epds ?? null,
    posterUrl: t.posterUrl ?? null,
    images: t.images ?? [],
    status: t.status,
    tmdbId: t.tmdb_id ?? null,
    imdbId: t.imdb_id || null,
    embedUrl: t.embed_url || null,
    backdropUrl: t.backdropUrl || null,
    quality: t.quality || null,
    ratingAvg: t.ratingAvg ?? 0,
    ratingCount: t.ratingCount ?? 0,
    likes: t.likes ?? 0,
    dislikes: t.dislikes ?? 0,
    createdById: t.createdBy ? String(t.createdBy) : null,
    createdAt: t.createdAt,
    categories: (t.categories ?? []).map((c: any) => ({ id: String(c._id), name: c.name })),
    creator: t.creator?.[0]?.name ?? null,
  };
}

export type TitleSort = "popular" | "rating" | "recent";

export interface TitleFilters {
  skip: number;
  limit: number;
  type?: TitleType;
  categoryId?: string;
  search?: string;
  status?: TitleStatus;
}

function buildMatch(f: TitleFilters) {
  return {
    ...(f.status && { status: f.status }),
    ...(f.type && { type: f.type }),
    ...(f.categoryId && { categoriesIds: oid(f.categoryId) }),
    ...(f.search && { title: { $regex: escapeRegex(f.search), $options: "i" } }),
  };
}

/**
 * Sin `sort`: orden natural (más antiguos primero), igual que el backend anterior: los títulos curados salen
 * antes que los importados. Todos acaban en `_id` para que paginar con skip no repita ni salte títulos.
 */
export function listSort(sort?: TitleSort): Record<string, 1 | -1> {
  switch (sort) {
    case "popular":
      return { likes: -1, ratingCount: -1, ratingAvg: -1, _id: 1 };
    case "rating":
      return { ratingAvg: -1, ratingCount: -1, _id: 1 };
    case "recent":
      return { createdAt: -1, _id: -1 };
    default:
      return { _id: 1 };
  }
}

async function findByIds(ids: string[]): Promise<TitleDto[]> {
  if (ids.length === 0) return [];
  const rows = await TitleModel.aggregate([{ $match: { _id: { $in: oids(ids) } } }, ...lookups]);
  const byId = new Map(rows.map((r) => [String(r._id), toTitleDto(r)]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

export const titleRepository = {
  findByIds,

  async create(data: {
    title: string; description: string; type: TitleType; year: number; author: string;
    posterUrl?: string; seasons?: number; episodes?: number; createdById: string; categoriesIds: string[];
  }) {
    const doc = await TitleModel.create({
      title: data.title, description: data.description, type: data.type, year: data.year, author: data.author,
      ...(data.posterUrl && { posterUrl: data.posterUrl }),
      ...(data.seasons !== undefined && { temps: data.seasons }),
      ...(data.episodes !== undefined && { eps: data.episodes }),
      categoriesIds: oids(data.categoriesIds),
      createdBy: oid(data.createdById),
      status: "pending", likes: 0, dislikes: 0, ratingAvg: 0, ratingCount: 0, createdAt: new Date(),
    });
    return { id: String(doc._id) };
  },

  async findByName(title: string) {
    const t = await TitleModel.findOne({ title }).collation({ locale: "es", strength: 2 }).select("_id").lean();
    return t ? { id: String(t._id) } : null;
  },

  async findById(id: string) {
    const _id = safeOid(id);
    if (!_id) return null;
    const [row] = await TitleModel.aggregate([{ $match: { _id } }, ...lookups]);
    return row ? toTitleDto(row) : null;
  },

  /** Página y total de coincidencias. Por defecto, los más nuevos primero (lo que usa el admin). */
  async findPage(f: TitleFilters, order: Record<string, 1 | -1> = { _id: -1 }) {
    const match = buildMatch(f);
    const [rows, total] = await Promise.all([
      TitleModel.aggregate([{ $match: match }, { $sort: order }, { $skip: f.skip }, { $limit: f.limit }, ...lookups]),
      TitleModel.countDocuments(match),
    ]);
    return { items: rows.map(toTitleDto), total };
  },

  /** Títulos en cualquiera de las listas del usuario (watchlist ∪ favoritos). */
  async findInUserLists(userId: string, skip: number, limit: number, type?: TitleType) {
    const user = await UserModel.findById(oid(userId)).select("lists favorites").lean();
    const ids = [...new Set([...(user?.lists ?? []), ...(user?.favorites ?? [])].map(String))];
    if (ids.length === 0) return [];
    const match = { _id: { $in: oids(ids) }, ...(type && { type }) };
    const rows = await TitleModel.aggregate([{ $match: match }, { $sort: listSort() }, { $skip: skip }, { $limit: limit }, ...lookups]);
    return rows.map(toTitleDto);
  },

  async update(id: string, data: {
    title?: string; description?: string; type?: TitleType; year?: number; author?: string;
    posterUrl?: string | null; seasons?: number | null; episodes?: number | null; categoriesIds?: string[];
  }) {
    // null/undefined limpian el campo: los validadores de Mongo no aceptan null en strings ni ints
    const $set: Record<string, unknown> = {};
    const $unset: Record<string, ""> = {};
    const put = (field: string, v: unknown) => (v === null ? ($unset[field] = "") : v !== undefined && ($set[field] = v));
    put("title", data.title); put("description", data.description); put("type", data.type);
    put("year", data.year); put("author", data.author); put("posterUrl", data.posterUrl);
    put("temps", data.seasons); put("eps", data.episodes);
    if (data.categoriesIds) $set.categoriesIds = oids(data.categoriesIds);
    const update = { ...(Object.keys($set).length && { $set }), ...(Object.keys($unset).length && { $unset }) };
    await TitleModel.updateOne({ _id: oid(id) }, update);
  },

  setStatus: (id: string, status: TitleStatus) => TitleModel.updateOne({ _id: oid(id) }, { $set: { status } }),
  setEmbedUrl: (id: string, embedUrl: string | null) =>
    TitleModel.updateOne({ _id: oid(id) }, embedUrl ? { $set: { embed_url: embedUrl } } : { $unset: { embed_url: "" } }),

  /** Borra el título y lo que dependía de él (reseñas, reacciones y referencias en listas). */
  async delete(id: string) {
    const _id = oid(id);
    const reviewIds = (await ReviewModel.find({ titleId: _id }).select("_id").lean()).map((r) => r._id);
    await ReviewReactionModel.deleteMany({ reviewId: { $in: reviewIds } });
    await ReviewModel.deleteMany({ titleId: _id });
    await UserModel.updateMany({}, { $pull: { lists: _id, favorites: _id } });
    await TitleModel.deleteOne({ _id });
  },

  exists: (id: string) => {
    const _id = safeOid(id);
    return _id ? TitleModel.exists({ _id }).then((r) => !!r) : Promise.resolve(false);
  },
};
