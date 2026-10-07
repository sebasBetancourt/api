import type { CategoryDto, CategorySummaryDto } from "../interfaces/category.interface.js";
import type { TitleType } from "../interfaces/title.interface.js";
import { CategoryModel, type CategoryDoc } from "../models/category.model.js";
import { TitleModel } from "../models/title.model.js";
import { oid, oids, safeOid } from "../libs/mongoHelpers.js";
import { listSort } from "./title.repository.js";

const toDto = (c: CategoryDoc): CategoryDto => ({ id: String(c._id), name: c.name, createdAt: c.createdAt });

export const categoryRepository = {
  async create(name: string) {
    const doc = await CategoryModel.create({ name, createdAt: new Date() });
    return toDto(doc.toObject());
  },
  async findByName(name: string) {
    const c = await CategoryModel.findOne({ name }).lean();
    return c ? toDto(c) : null;
  },
  async findById(id: string) {
    const _id = safeOid(id);
    const c = _id ? await CategoryModel.findById(_id).lean() : null;
    return c ? toDto(c) : null;
  },
  async findAll(skip: number, limit: number) {
    const rows = await CategoryModel.find().sort({ name: 1 }).skip(skip).limit(limit).lean();
    return rows.map(toDto);
  },
  /**
   * Solo salen categorías con algún título aprobado (del tipo pedido): se agrupa desde los títulos.
   * Se ordena antes de desenrollar para que `$first` sea el póster del mejor valorado.
   */
  summary: (type?: TitleType) =>
    TitleModel.aggregate<CategorySummaryDto>([
      { $match: { status: "approved", ...(type && { type }), "categoriesIds.0": { $exists: true } } },
      { $sort: listSort("rating") },
      { $unwind: "$categoriesIds" },
      { $group: { _id: "$categoriesIds", count: { $sum: 1 }, posterUrl: { $first: "$posterUrl" } } },
      { $lookup: { from: "categories", localField: "_id", foreignField: "_id", as: "category" } },
      { $unwind: "$category" },
      {
        $project: {
          _id: 0, id: { $toString: "$_id" }, name: "$category.name", count: 1,
          posterUrl: { $ifNull: ["$posterUrl", null] },
        },
      },
      { $sort: { count: -1, name: 1 } },
    ]),
  countByIds: (ids: string[]) => CategoryModel.countDocuments({ _id: { $in: oids(ids) } }),
  async rename(id: string, name: string) {
    const c = await CategoryModel.findByIdAndUpdate(oid(id), { $set: { name } }, { new: true }).lean();
    return c ? toDto(c) : null;
  },
  async delete(id: string) {
    await CategoryModel.deleteOne({ _id: oid(id) });
    await TitleModel.updateMany({ categoriesIds: oid(id) }, { $pull: { categoriesIds: oid(id) } });
  },
};
