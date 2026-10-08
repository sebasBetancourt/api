import { oid, safeOid } from "../libs/mongoHelpers.js";
import { AvatarModel } from "../models/avatar.model.js";

export interface StoredAvatar {
  data: Buffer;
  contentType: string;
  etag: string;
}

export const avatarRepository = {
  async upsert(userId: string, avatar: StoredAvatar) {
    await AvatarModel.updateOne(
      { userId: oid(userId) },
      { $set: { data: avatar.data, contentType: avatar.contentType, etag: avatar.etag, updatedAt: new Date() } },
      { upsert: true },
    );
  },

  async findByUserId(userId: string): Promise<StoredAvatar | null> {
    const _id = safeOid(userId);
    if (!_id) return null;
    // Sin `.lean()`: así Mongoose devuelve `data` como Buffer y no como `Binary` de BSON.
    const doc = await AvatarModel.findOne({ userId: _id });
    return doc ? { data: Buffer.from(doc.data), contentType: doc.contentType, etag: doc.etag } : null;
  },

  delete: (userId: string) => AvatarModel.deleteOne({ userId: oid(userId) }),
};
