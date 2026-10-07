import { oid } from "../libs/mongoHelpers.js";
import { PASSWORD_RESET_PURPOSE, PasswordResetTokenModel } from "../models/passwordResetToken.model.js";

export interface PasswordResetRecord {
  userId: string;
  hash: string;
  expiresAt: Date;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const toRecord = (t: any): PasswordResetRecord => ({ userId: String(t.userId), hash: t.hash, expiresAt: t.expiresAt });

// El TTL de Mongo borra con hasta ~1 min de retraso: la caducidad se comprueba también aquí.
const validFilter = (hash: string) => ({ hash, purpose: PASSWORD_RESET_PURPOSE, expiresAt: { $gt: new Date() } });

export const passwordResetRepository = {
  invalidateForUser: (userId: string) =>
    PasswordResetTokenModel.deleteMany({ userId: oid(userId), purpose: PASSWORD_RESET_PURPOSE }),

  create: (userId: string, hash: string, expiresAt: Date) =>
    PasswordResetTokenModel.create({
      userId: oid(userId), hash, purpose: PASSWORD_RESET_PURPOSE, createdAt: new Date(), expiresAt,
    }),

  async findValidByHash(hash: string) {
    const t = await PasswordResetTokenModel.findOne(validFilter(hash)).lean();
    return t ? toRecord(t) : null;
  },

  /** Lo borra en la misma operación en que lo lee: dos peticiones simultáneas no pueden usarlo ambas. */
  async consume(hash: string) {
    const t = await PasswordResetTokenModel.findOneAndDelete(validFilter(hash)).lean();
    return t ? toRecord(t) : null;
  },
};
