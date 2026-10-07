import { AppError } from "../../libs/appError.js";
import { listSort, titleRepository } from "../../repositories/title.repository.js";
import { categoryRepository } from "../../repositories/category.repository.js";
import type { ListTitlesQuery, UpdateTitleInput } from "../../schemas/title.schema.js";

/** El listado público solo expone títulos aprobados; devuelve la página y el total para paginar. */
export const listTitlesService = (q: ListTitlesQuery) =>
  titleRepository.findPage(
    {
      skip: q.skip, limit: q.limit, type: q.type,
      categoryId: q.categoryId ?? q.categoriesId, search: q.search || undefined,
      status: "approved",
    },
    listSort(q.sort),
  );

export const listCollectionService = (
  userId: string, skip: number, limit: number, type?: "movie" | "tv" | "anime",
) => titleRepository.findInUserLists(userId, skip, limit, type);

export async function getTitleByIdService(id: string) {
  const t = await titleRepository.findById(id);
  if (!t) throw new AppError(404, "Título no encontrado");
  return t;
}

async function setStatus(id: string, status: "approved" | "rejected") {
  await getTitleByIdService(id);
  await titleRepository.setStatus(id, status);
}
export const approveTitleService = (id: string) => setStatus(id, "approved");
export const rejectTitleService = (id: string) => setStatus(id, "rejected");

export async function deleteTitleService(id: string) {
  await getTitleByIdService(id);
  await titleRepository.delete(id);
}

export async function setTitleEmbedService(id: string, embedUrl: string | null) {
  await getTitleByIdService(id);
  await titleRepository.setEmbedUrl(id, embedUrl);
}

export async function updateTitleService(id: string, input: UpdateTitleInput) {
  const current = await getTitleByIdService(id);
  if (input.title && input.title.toLowerCase() !== current.title.toLowerCase()) {
    const dup = await titleRepository.findByName(input.title);
    if (dup && dup.id !== id) throw new AppError(409, "El título ya existe, escoge otro nombre");
  }
  if (input.categoriesIds) {
    const unique = [...new Set(input.categoriesIds)];
    if ((await categoryRepository.countByIds(unique)) !== unique.length) throw new AppError(400, "Alguna categoría no existe");
    input = { ...input, categoriesIds: unique };
  }
  await titleRepository.update(id, input);
  return getTitleByIdService(id);
}
