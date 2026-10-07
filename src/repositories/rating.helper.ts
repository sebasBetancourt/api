import type { ClientSession, Types } from "mongoose";
import { ReviewModel } from "../models/review.model.js";
import { TitleModel } from "../models/title.model.js";

/** Recalcula ratingAvg/ratingCount del título a partir de sus reseñas. */
export async function refreshTitleRating(titleId: Types.ObjectId, session?: ClientSession) {
  const [agg] = await ReviewModel.aggregate<{ avg: number; count: number }>([
    { $match: { titleId } },
    { $group: { _id: null, avg: { $avg: "$score" }, count: { $sum: 1 } } },
  ]).session(session ?? null);
  await TitleModel.updateOne(
    { _id: titleId },
    { $set: { ratingAvg: agg?.avg ?? 0, ratingCount: agg?.count ?? 0 } },
    { session },
  );
}
