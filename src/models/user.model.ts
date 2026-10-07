import mongoose, { type Model, type Types } from "mongoose";

const { model, models, Schema } = mongoose;

export interface UserDoc {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  role: "user" | "admin";
  phone?: string | null;
  country?: string | null;
  avatarUrl?: string | null;
  banned: boolean;
  preferences: Record<string, unknown>;
  lists: Types.ObjectId[]; // watchlist (campo legacy)
  favorites: Types.ObjectId[];
  createdAt: Date;
  lastLoginAt?: Date | null;
}

const schema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    phone: { type: String, default: null },
    country: { type: String, default: null },
    avatarUrl: { type: String, default: null },
    banned: { type: Boolean, default: false },
    preferences: {
      marketingEmails: { type: Boolean, default: false },
      personalizedRecs: { type: Boolean, default: true },
      shareAnonymized: { type: Boolean, default: false },
      dataRetentionMonths: { type: Schema.Types.Int32, default: 12 },
    },
    lists: { type: [Schema.Types.ObjectId], default: [] },
    favorites: { type: [Schema.Types.ObjectId], default: [] },
    createdAt: { type: Date, default: () => new Date() },
    lastLoginAt: { type: Date, default: null },
  },
  { collection: "users", versionKey: false },
);

export const UserModel = (models.User as Model<UserDoc>) ?? model<UserDoc>("User", schema);
