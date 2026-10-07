import mongoose, { type Model, type Types } from "mongoose";

const { model, models, Schema } = mongoose;

/** Documento tal como vive en Mongo (nombres legacy: temps, eps, embed_url, tmdb_id...). */
export interface TitleDoc {
  _id: Types.ObjectId;
  type: "movie" | "tv" | "anime";
  title: string;
  description: string;
  author?: string;
  year?: number;
  temps?: number;
  eps?: number;
  posterUrl?: string;
  images?: string[];
  status: "pending" | "approved" | "rejected";
  tmdb_id?: number;
  imdb_id?: string;
  embed_url?: string;
  backdropUrl?: string;
  /** Calidad que informa Vimeus ("FULL HD", "HD"...). */
  quality?: string;
  /** "vimeus" si el título lo creó la sincronización. */
  source?: string;
  /** Última corrida de la sincronización con Vimeus que lo vio en el listado. */
  vimeusSyncedAt?: Date;
  ratingAvg: number;
  ratingCount: number;
  likes: number;
  dislikes: number;
  createdBy?: Types.ObjectId;
  categoriesIds: Types.ObjectId[];
  createdAt: Date;
}

const schema = new Schema<TitleDoc>(
  {
    type: { type: String, enum: ["movie", "tv", "anime"], required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    author: String,
    year: Number,
    temps: Schema.Types.Int32,
    eps: Schema.Types.Int32,
    posterUrl: String,
    images: { type: [String], default: undefined },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    tmdb_id: Number,
    imdb_id: String,
    embed_url: String,
    backdropUrl: String,
    quality: String,
    source: String,
    vimeusSyncedAt: Date,
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    createdBy: Schema.Types.ObjectId,
    categoriesIds: { type: [Schema.Types.ObjectId], default: [] },
    createdAt: { type: Date, default: () => new Date() },
  },
  { collection: "titles", versionKey: false },
);

export const TitleModel = (models.Title as Model<TitleDoc>) ?? model<TitleDoc>("Title", schema);
