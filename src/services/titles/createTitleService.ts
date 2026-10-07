import { AppError } from "../../libs/appError.js";
import { categoryRepository } from "../../repositories/category.repository.js";
import { titleRepository } from "../../repositories/title.repository.js";
import type { CreateTitleInput } from "../../schemas/title.schema.js";

export async function createTitleService(input: CreateTitleInput, userId: string) {
  if (await titleRepository.findByName(input.title)) {
    throw new AppError(409, "El título ya existe, escoge otro nombre");
  }
  const unique = [...new Set(input.categoriesIds)];
  if ((await categoryRepository.countByIds(unique)) !== unique.length) {
    throw new AppError(400, "Alguna categoría no existe");
  }
  const isSeries = input.type === "tv" || input.type === "anime";
  return titleRepository.create({
    ...input,
    categoriesIds: unique,
    seasons: isSeries ? (input.seasons ?? 1) : undefined,
    episodes: isSeries ? (input.episodes ?? 1) : undefined,
    createdById: userId,
  });
}
