import type { CategoryDto } from "../interfaces/category.interface.js";
import { CategoryModel, type CategoryDoc } from "../models/category.model.js";
import { TitleModel } from "../models/title.model.js";
import { oid, oids, safeOid } from "../libs/mongoHelpers.js";

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
