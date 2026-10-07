import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { favoritesController as c } from "../controllers/favorites.controller.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { favoriteListQuery, favoriteParams, favoritesQuery } from "../schemas/favorite.schema.js";

export async function favoritesRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const tags = ["favorites"];
  const auth = { preValidation: authMiddleware };

  r.get("/ids", { ...auth, schema: { tags } }, c.ids as never);
  r.get("/", { ...auth, schema: { querystring: favoritesQuery, tags } }, c.list as never);
  r.put("/:titleId", { ...auth, schema: { params: favoriteParams, querystring: favoriteListQuery, tags } }, c.add as never);
  r.delete("/:titleId", { ...auth, schema: { params: favoriteParams, querystring: favoriteListQuery, tags } }, c.remove as never);
}
