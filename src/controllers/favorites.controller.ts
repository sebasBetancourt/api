import type { FastifyRequest, RouteGenericInterface } from "fastify";
import {
  addFavoriteService, favoriteIdsService, listFavoritesService, removeFavoriteService,
} from "../services/favorites/favoriteServices.js";

type Req<T extends RouteGenericInterface = RouteGenericInterface> = FastifyRequest<T>;
type TitleParam = { Params: { titleId: string }; Querystring: { list: string } };

export const favoritesController = {
  ids: (req: Req) => favoriteIdsService(req.user.id),
  list: (req: Req<{ Querystring: { list: string; type?: "movie" | "tv" | "anime"; skip: number; limit: number } }>) =>
    listFavoritesService(req.user.id, req.query.list, req.query.skip, req.query.limit, req.query.type),
  async add(req: Req<TitleParam>) {
    await addFavoriteService(req.user.id, req.params.titleId, req.query.list);
    return { message: "Agregado" };
  },
  async remove(req: Req<TitleParam>) {
    await removeFavoriteService(req.user.id, req.params.titleId, req.query.list);
    return { message: "Eliminado" };
  },
};
