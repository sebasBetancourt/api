import type { PublicUserDto, UserRecord } from "../interfaces/user.interface.js";
import { withTransaction } from "../libs/mongo.js";
import { escapeRegex, oid, safeOid } from "../libs/mongoHelpers.js";
import { ReviewModel, ReviewReactionModel } from "../models/review.model.js";
import { UserModel } from "../models/user.model.js";
import { refreshTitleRating } from "./rating.helper.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
const toRecord = (u: any): UserRecord => ({
  id: String(u._id), email: u.email, passwordHash: u.passwordHash, name: u.name, role: u.role, banned: !!u.banned,
});

const toPublic = (u: any): PublicUserDto => ({
  id: String(u._id), email: u.email, name: u.name, role: u.role,
  phone: u.phone ?? null, country: u.country ?? null, avatarUrl: u.avatarUrl ?? null,
  banned: !!u.banned, preferences: u.preferences ?? {}, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt ?? null,
});

export const userRepository = {
  async findByEmail(email: string) {
    const u = await UserModel.findOne({ email: email.trim().toLowerCase() }).lean();
    return u ? toRecord(u) : null;
  },
  async findById(id: string) {
    const _id = safeOid(id);
    const u = _id ? await UserModel.findById(_id).lean() : null;
    return u ? toRecord(u) : null;
  },
  async create(data: {
    email: string; passwordHash: string; name: string; phone?: string; country?: string; avatarUrl?: string;
  }) {
    const doc = await UserModel.create({
      ...data, role: "user", banned: false, lists: [], favorites: [], createdAt: new Date(),
    });
    return toRecord(doc.toObject());
  },
  touchLogin: (id: string) => UserModel.updateOne({ _id: oid(id) }, { $set: { lastLoginAt: new Date() } }),
};

export const userAdminRepository = {
  async findPublicById(id: string) {
    const _id = safeOid(id);
    const u = _id ? await UserModel.findById(_id).lean() : null;
    return u ? toPublic(u) : null;
  },

  /** `preferences` se aplica clave por clave para no pisar claves que no se envían. */
  async update(id: string, data: Record<string, unknown>) {
    const { preferences, ...rest } = data;
    const $set: Record<string, unknown> = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
    for (const [k, v] of Object.entries((preferences as Record<string, unknown>) ?? {})) {
      if (v !== undefined) $set[`preferences.${k}`] = v;
    }
    const u = await UserModel.findByIdAndUpdate(oid(id), { $set }, { new: true }).lean();
    return toPublic(u);
  },

  updatePassword: (id: string, passwordHash: string) =>
    UserModel.updateOne({ _id: oid(id) }, { $set: { passwordHash } }),

  /** Borra el usuario y sus reseñas/reacciones, y recalcula el rating de los títulos afectados. */
  delete: (id: string) =>
    withTransaction(async (session) => {
      const userId = oid(id);
      const reviews = await ReviewModel.find({ userId }).select("_id titleId").session(session).lean();
      await ReviewReactionModel.deleteMany(
        { $or: [{ userId }, { reviewId: { $in: reviews.map((r) => r._id) } }] }, { session },
      );
      await ReviewModel.deleteMany({ userId }, { session });
      await UserModel.deleteOne({ _id: userId }, { session });
      for (const titleId of new Set(reviews.map((r) => String(r.titleId)))) {
        await refreshTitleRating(oid(titleId), session);
      }
    }),

  async list(skip: number, limit: number, search?: string) {
    const rx = search ? { $regex: escapeRegex(search), $options: "i" } : null;
    const filter = rx ? { $or: [{ email: rx }, { name: rx }] } : {};
    const [rows, total] = await Promise.all([
      UserModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      UserModel.countDocuments(filter),
    ]);
    return { items: rows.map(toPublic), total };
  },

  async exportData(id: string) {
    const u = await UserModel.findById(oid(id)).lean();
    if (!u) return null;
    const reviews = await ReviewModel.find({ userId: oid(id) }).lean();
    return {
      ...toPublic(u),
      reviews: reviews.map((r) => ({
        id: String(r._id), title: r.title ?? "", comment: r.comment ?? null, score: r.score,
        titleId: String(r.titleId), createdAt: r.createdAt,
      })),
      favorites: [
        ...(u.lists ?? []).map((t) => ({ titleId: String(t), list: "watchlist" })),
        ...(u.favorites ?? []).map((t) => ({ titleId: String(t), list: "favorites" })),
      ],
    };
  },
};
