import type { TitleType } from "../interfaces/title.interface.js";
import { oid, oids } from "../libs/mongoHelpers.js";
import { TitleModel } from "../models/title.model.js";
import { UserModel } from "../models/user.model.js";
import { titleRepository } from "./title.repository.js";

/** `watchlist` usa el campo legacy `users.lists`; `favorites` usa `users.favorites`. */
const field = (list: string) => (list === "watchlist" ? "lists" : "favorites");

export const favoriteRepository = {
  /** Ids de títulos en cada lista (para pintar los botones sin traer los títulos completos). */
  async ids(userId: string) {
    const user = await UserModel.findById(oid(userId)).select("lists favorites").lean();
    return {
      favorites: (user?.favorites ?? []).map(String),
      watchlist: (user?.lists ?? []).map(String),
    };
  },

  add: (userId: string, titleId: string, list: string) =>
    UserModel.updateOne({ _id: oid(userId) }, { $addToSet: { [field(list)]: oid(titleId) } }),

  remove: (userId: string, titleId: string, list: string) =>
    UserModel.updateOne({ _id: oid(userId) }, { $pull: { [field(list)]: oid(titleId) } }),

  async list(userId: string, list: string, skip: number, limit: number, type?: TitleType) {
    const user = await UserModel.findById(oid(userId)).select(field(list)).lean();
    // más recientes primero (se agregan al final del arreglo)
    let ids = [...((user as Record<string, unknown> | null)?.[field(list)] as { toString(): string }[] ?? [])]
      .map(String).reverse();
    if (type) {
      const ofType = new Set(
        (await TitleModel.find({ _id: { $in: oids(ids) }, type }).select("_id").lean()).map((t) => String(t._id)),
      );
      ids = ids.filter((id) => ofType.has(id));
    }
    return { items: await titleRepository.findByIds(ids.slice(skip, skip + limit)), total: ids.length };
  },
};
