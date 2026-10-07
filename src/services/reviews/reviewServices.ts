import { AppError } from "../../libs/appError.js";
import type { RoleName } from "../../constants/globalConstants.js";
import { reviewRepository } from "../../repositories/review.repository.js";
import { titleRepository } from "../../repositories/title.repository.js";
import type { CreateReviewInput, ListReviewsQuery, UpdateReviewInput } from "../../schemas/review.schema.js";
import { calculateRanking } from "../../utils/ranking.js";

interface Actor { id: string; role: RoleName }

async function getOwnedReview(id: string, actor: Actor) {
  const review = await reviewRepository.findById(id);
  if (!review) throw new AppError(404, "Reseña no encontrada");
  if (actor.role !== "admin" && review.userId !== actor.id) {
    throw new AppError(403, "No tienes permiso sobre esta reseña");
  }
  return review;
}

export async function createReviewService(input: CreateReviewInput, userId: string) {
  if (!(await titleRepository.exists(input.titleId))) throw new AppError(404, "Título no encontrado");
  return reviewRepository.create({ ...input, userId });
}

export const listReviewsService = (q: ListReviewsQuery) =>
  reviewRepository.findAll(
    { ...(q.titleId && { titleId: q.titleId }), ...(q.userId && { userId: q.userId }) },
    q.skip, q.limit,
  );

export async function getReviewByIdService(id: string) {
  const r = await reviewRepository.findById(id);
  if (!r) throw new AppError(404, "Reseña no encontrada");
  return r;
}

export async function updateReviewService(id: string, input: UpdateReviewInput, actor: Actor) {
  const review = await getOwnedReview(id, actor);
  return reviewRepository.update(id, review.titleId, input);
}

export async function deleteReviewService(id: string, actor: Actor) {
  const review = await getOwnedReview(id, actor);
  await reviewRepository.delete(id, review.titleId);
}

export async function reactToReviewService(id: string, type: "like" | "dislike", userId: string) {
  const review = await getReviewByIdService(id);
  if (review.userId === userId) {
    throw new AppError(400, `No puedes dar ${type} a tu propia reseña`);
  }
  return reviewRepository.react(id, userId, type);
}

export async function rankingService(titleId: string) {
  return calculateRanking(await reviewRepository.findForRanking(titleId));
}

const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function exportReviewsCsvService(titleId?: string) {
  const rows = await reviewRepository.findAll(titleId ? { titleId } : {}, 0, 10_000);
  const header = ["id", "titulo_obra", "titulo_resena", "comentario", "score", "usuario", "fecha"];
  const lines = rows.map((r) =>
    [r.id, r.titleRef.title, r.title, r.comment, r.score, r.user.name, r.createdAt.toISOString()]
      .map(csvCell).join(","),
  );
  return [header.join(","), ...lines].join("\n");
}
