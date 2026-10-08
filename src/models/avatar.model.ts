import mongoose, { type Model, type Types } from "mongoose";

const { model, models, Schema } = mongoose;

export interface AvatarDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  contentType: "image/webp";
  data: Buffer;
  etag: string;
  updatedAt: Date;
}

const schema = new Schema<AvatarDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    contentType: { type: String, default: "image/webp" },
    data: { type: Buffer, required: true },
    etag: { type: String, required: true },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { collection: "avatars", versionKey: false },
);

export const AvatarModel = (models.Avatar as Model<AvatarDoc>) ?? model<AvatarDoc>("Avatar", schema);
