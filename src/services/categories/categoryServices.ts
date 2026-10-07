import type { TitleType } from "../../interfaces/title.interface.js";
import { AppError } from "../../libs/appError.js";
import { isDuplicateKey } from "../../libs/mongoHelpers.js";
import { categoryRepository } from "../../repositories/category.repository.js";

export async function createCategoryService(name: string) {
  if (await categoryRepository.findByName(name)) {
    throw new AppError(409, "La categoría ya existe, escoge otro nombre");
  }
  return categoryRepository.create(name).catch((e) => {
    throw isDuplicateKey(e) ? new AppError(409, "La categoría ya existe, escoge otro nombre") : e;
  });
}

export const listCategoriesService = (skip: number, limit: number) =>
  categoryRepository.findAll(skip, limit);

export const getCategorySummaryService = (type?: TitleType) => categoryRepository.summary(type);

export async function getCategoryByIdService(id: string) {
  const c = await categoryRepository.findById(id);
  if (!c) throw new AppError(404, "Categoría no encontrada");
  return c;
}

export async function getCategoryByNameService(name: string) {
  const c = await categoryRepository.findByName(name);
  if (!c) throw new AppError(404, "Categoría no encontrada");
  return c;
}

export async function deleteCategoryService(id: string) {
  await getCategoryByIdService(id);
  await categoryRepository.delete(id);
}

export async function renameCategoryService(id: string, name: string) {
  await getCategoryByIdService(id);
  const dup = await categoryRepository.findByName(name);
  if (dup && dup.id !== id) throw new AppError(409, "La categoría ya existe");
  return (await categoryRepository.rename(id, name))!;
}
