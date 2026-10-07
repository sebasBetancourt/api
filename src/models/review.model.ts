import mongoose, { type Model, type Types } from "mongoose";

const { model, models, Schema } = mongoose;

export interface ReviewDoc {
  _id: Types.ObjectId;
  titleId: Types.ObjectId;
  userId: Types.ObjectId;
  title?: string;
  comment?: string;
  score: number;
  likesCount: number;
  dislikesCount: number;
  createdAt: Date;
}

const schema = new Schema<ReviewDoc>(
  {
    titleId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    title: String,
    comment: String,
    score: { type: Number, required: true, min: 1, max: 5 },
    likesCount: { type: Number, default: 0 },
    dislikesCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: () => new Date() },
  },
  { collection: "reviews", versionKey: false },
);

export const ReviewModel = (models.Review as Model<ReviewDoc>) ?? model<ReviewDoc>("Review", schema);

export interface ReviewReactionDoc {
  _id: Types.ObjectId;
  reviewId: Types.ObjectId;
  userId: Types.ObjectId;
  type: "like" | "dislike";
  createdAt: Date;
}

const reactionSchema = new Schema<ReviewReactionDoc>(
  {
    reviewId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    type: { type: String, enum: ["like", "dislike"], required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { collection: "review_reactions", versionKey: false },
);

export const ReviewReactionModel =
  (models.ReviewReaction as Model<ReviewReactionDoc>) ?? model<ReviewReactionDoc>("ReviewReaction", reactionSchema);
