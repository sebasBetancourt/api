import { z } from "zod";
import { objectId } from "./common.schema.js";

export const createCategoryBody = z.object({ name: z.string().trim().min(1).max(60) });
export const idParams = z.object({ id: objectId });
export const nameParams = z.object({ name: z.string().min(1) });
export const pageQuery = z.object({
  skip: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type CreateCategoryInput = z.infer<typeof createCategoryBody>;
