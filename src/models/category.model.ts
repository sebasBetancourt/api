import mongoose, { type Model, type Types } from "mongoose";

const { model, models, Schema } = mongoose;

export interface CategoryDoc {
  _id: Types.ObjectId;
  name: string;
  createdAt: Date;
}

const schema = new Schema<CategoryDoc>(
  { name: { type: String, required: true }, createdAt: { type: Date, default: () => new Date() } },
  { collection: "categories", versionKey: false },
);

export const CategoryModel = (models.Category as Model<CategoryDoc>) ?? model<CategoryDoc>("Category", schema);
