import type { PipelineStage } from "mongoose";
import type { ReviewDto } from "../interfaces/review.interface.js";
import { oid, safeOid } from "../libs/mongoHelpers.js";
import { withTransaction } from "../libs/mongo.js";
import { ReviewModel, ReviewReactionModel } from "../models/review.model.js";
import { refreshTitleRating } from "./rating.helper.js";

const lookups: PipelineStage[] = [
  { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user", pipeline: [{ $project: { name: 1, avatarUrl: 1 } }] } },
  { $lookup: { from: "titles", localField: "titleId", foreignField: "_id", as: "titleDoc", pipeline: [{ $project: { title: 1 } }] } },
];

/* eslint-disable @typescript-eslint/no-explicit-any */
function toReviewDto(r: any): ReviewDto {
  const u = r.user?.[0];
  return {
    id: String(r._id),
    title: r.title ?? "",
    comment: r.comment ?? null,
    score: r.score,
    likesCount: r.likesCount ?? 0,
    dislikesCount: r.dislikesCount ?? 0,
    createdAt: r.createdAt,
    titleId: String(r.titleId),
    userId: String(r.userId),
    user: { id: String(r.userId), name: u?.name ?? "Usuario eliminado", avatarUrl: u?.avatarUrl ?? null },
    titleRef: { id: String(r.titleId), title: r.titleDoc?.[0]?.title ?? "" },
  };
}

async function findById(id: string): Promise<ReviewDto | null> {
  const _id = safeOid(id);
  if (!_id) return null;
  const [row] = await ReviewModel.aggregate([{ $match: { _id } }, ...lookups]);
  return row ? toReviewDto(row) : null;
}

export const reviewRepository = {
  findById,

  async create(data: { title: string; comment?: string; score: number; titleId: string; userId: string }) {
    const id = await withTransaction(async (session) => {
      const [doc] = await ReviewModel.create(
        [{
          title: data.title, ...(data.comment !== undefined && { comment: data.comment }), score: data.score,
          titleId: oid(data.titleId), userId: oid(data.userId), likesCount: 0, dislikesCount: 0, createdAt: new Date(),
        }],
        { session },
      );
      await refreshTitleRating(oid(data.titleId), session);
      return String(doc._id);
    });
    return (await findById(id))!;
  },

  async findAll(where: { titleId?: string; userId?: string }, skip: number, limit: number) {
    const match = {
      ...(where.titleId && { titleId: oid(where.titleId) }),
      ...(where.userId && { userId: oid(where.userId) }),
    };
    const rows = await ReviewModel.aggregate([
      { $match: match }, { $sort: { createdAt: -1, _id: -1 } }, { $skip: skip }, { $limit: limit }, ...lookups,
    ]);
    return rows.map(toReviewDto);
  },

  async findForRanking(titleId: string) {
    const rows = await ReviewModel.find({ titleId: oid(titleId) }).lean();
    return rows.map((r) => ({
      score: r.score, likesCount: r.likesCount ?? 0, dislikesCount: r.dislikesCount ?? 0, createdAt: r.createdAt,
    }));
  },

  async update(id: string, titleId: string, data: { comment?: string; score?: number }) {
    await withTransaction(async (session) => {
      await ReviewModel.updateOne({ _id: oid(id) }, { $set: data }, { session });
      await refreshTitleRating(oid(titleId), session);
    });
    return (await findById(id))!;
  },

  delete: (id: string, titleId: string) =>
    withTransaction(async (session) => {
      await ReviewReactionModel.deleteMany({ reviewId: oid(id) }, { session });
      await ReviewModel.deleteOne({ _id: oid(id) }, { session });
      await refreshTitleRating(oid(titleId), session);
    }),

  /**
   * Alterna la reacción del usuario (like/dislike). Los contadores se ajustan con deltas
   * (no se recalculan) para conservar los contadores históricos que no tienen reacciones asociadas.
   */
  react: (reviewId: string, userId: string, type: "like" | "dislike") =>
    withTransaction(async (session) => {
      const key = { reviewId: oid(reviewId), userId: oid(userId) };
      const current = await ReviewReactionModel.findOne(key).session(session).lean();
      let dLike = 0, dDislike = 0;
      const bump = (t: "like" | "dislike", n: number) => (t === "like" ? (dLike += n) : (dDislike += n));

      if (current?.type === type) {
        await ReviewReactionModel.deleteOne(key, { session });
        bump(type, -1);
      } else {
        if (current) {
          await ReviewReactionModel.updateOne(key, { $set: { type } }, { session });
          bump(current.type, -1);
        } else {
          await ReviewReactionModel.create([{ ...key, type, createdAt: new Date() }], { session });
        }
        bump(type, 1);
      }

      const clamp = (field: string, d: number) => ({ $max: [0, { $add: [{ $ifNull: [`$${field}`, 0] }, d] }] });
      await ReviewModel.updateOne(
        { _id: key.reviewId },
        [{ $set: { likesCount: clamp("likesCount", dLike), dislikesCount: clamp("dislikesCount", dDislike) } }],
        { session },
      );
      const r = await ReviewModel.findById(key.reviewId).select("likesCount dislikesCount").session(session).lean();
      return { id: reviewId, likesCount: r?.likesCount ?? 0, dislikesCount: r?.dislikesCount ?? 0 };
    }),
};
