import { AppError } from "../../libs/appError.js";
import { favoriteRepository } from "../../repositories/favorite.repository.js";
import { titleRepository } from "../../repositories/title.repository.js";

export async function addFavoriteService(userId: string, titleId: string, list: string) {
  if (!(await titleRepository.exists(titleId))) throw new AppError(404, "Título no encontrado");
  await favoriteRepository.add(userId, titleId, list);
}

export const removeFavoriteService = (userId: string, titleId: string, list: string) =>
  favoriteRepository.remove(userId, titleId, list);

export const listFavoritesService = (
  userId: string, list: string, skip: number, limit: number, type?: "movie" | "tv" | "anime",
) => favoriteRepository.list(userId, list, skip, limit, type);

export const favoriteIdsService = (userId: string) => favoriteRepository.ids(userId);
