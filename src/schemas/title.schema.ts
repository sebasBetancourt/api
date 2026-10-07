import { z } from "zod";
import { objectId } from "./common.schema.js";

export const titleTypeEnum = z.enum(["movie", "tv", "anime"]);

export const createTitleBody = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1),
  type: titleTypeEnum,
  year: z.coerce.number().int().min(1888).max(2100),
  author: z.string().trim().min(1),
  categoriesIds: z.array(objectId).min(1),
  posterUrl: z.string().url().optional(),
  seasons: z.coerce.number().int().min(1).optional(),
  episodes: z.coerce.number().int().min(1).optional(),
});

export const listTitlesQuery = z.object({
  skip: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  type: titleTypeEnum.optional(),
  categoryId: objectId.optional(),
  // alias heredado del frontend
  categoriesId: objectId.optional(),
  search: z.string().trim().optional(),
});

export const collectionQuery = z.object({
  skip: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  type: titleTypeEnum.optional(),
});

export const setEmbedBody = z.object({ embedUrl: z.string().url().nullable() });

export type CreateTitleInput = z.infer<typeof createTitleBody>;
export type ListTitlesQuery = z.infer<typeof listTitlesQuery>;

export const updateTitleBody = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1),
    type: titleTypeEnum,
    year: z.coerce.number().int().min(1888).max(2100),
    author: z.string().trim().min(1),
    categoriesIds: z.array(objectId).min(1),
    posterUrl: z.string().url().nullable(),
    seasons: z.coerce.number().int().min(1).nullable(),
    episodes: z.coerce.number().int().min(1).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nada que actualizar");

export type UpdateTitleInput = z.infer<typeof updateTitleBody>;
