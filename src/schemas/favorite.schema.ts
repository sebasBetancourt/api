import { z } from "zod";
import { objectId } from "./common.schema.js";

export const listNameEnum = z.enum(["favorites", "watchlist"]);

export const favoritesQuery = z.object({
  list: listNameEnum.default("favorites"),
  type: z.enum(["movie", "tv", "anime"]).optional(),
  skip: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});

export const favoriteParams = z.object({ titleId: objectId });
export const favoriteListQuery = z.object({ list: listNameEnum.default("favorites") });
