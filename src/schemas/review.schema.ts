import { z } from "zod";
import { objectId } from "./common.schema.js";

export const createReviewBody = z.object({
  title: z.string().trim().min(1).max(100),
  titleId: objectId,
  score: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export const updateReviewBody = z
  .object({
    comment: z.string().max(500).optional(),
    score: z.coerce.number().int().min(1).max(5).optional(),
  })
  .refine((v) => v.comment !== undefined || v.score !== undefined, "Nada que actualizar");

export const listReviewsQuery = z.object({
  skip: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  titleId: objectId.optional(),
  userId: objectId.optional(),
});

export const exportReviewsQuery = z.object({ titleId: objectId.optional() });
export const titleIdParams = z.object({ titleId: objectId });

export type CreateReviewInput = z.infer<typeof createReviewBody>;
export type UpdateReviewInput = z.infer<typeof updateReviewBody>;
export type ListReviewsQuery = z.infer<typeof listReviewsQuery>;
