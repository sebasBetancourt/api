import mongoose, { type Model, type Types } from "mongoose";

const { model, models, Schema } = mongoose;

export const PASSWORD_RESET_PURPOSE = "password_reset";

export interface PasswordResetTokenDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  hash: string;
  purpose: typeof PASSWORD_RESET_PURPOSE;
  createdAt: Date;
  expiresAt: Date;
}

const schema = new Schema<PasswordResetTokenDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    hash: { type: String, required: true },
    purpose: { type: String, enum: [PASSWORD_RESET_PURPOSE], required: true },
    createdAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date, required: true },
  },
  // `tokens` es compartida con los tokens legacy; el índice TTL sobre expiresAt la limpia sola.
  { collection: "tokens", versionKey: false },
);

export const PasswordResetTokenModel =
  (models.PasswordResetToken as Model<PasswordResetTokenDoc>) ??
  model<PasswordResetTokenDoc>("PasswordResetToken", schema);
