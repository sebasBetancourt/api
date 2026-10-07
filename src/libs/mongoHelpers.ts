import mongoose from "mongoose";

const { Types } = mongoose;

export const oid = (id: string) => new Types.ObjectId(id);
export const oids = (ids: string[]) => ids.map(oid);
/** ObjectId o null si el texto no es un id válido (p. ej. tokens viejos). */
export const safeOid = (id: string) => (Types.ObjectId.isValid(id) && String(id).length === 24 ? oid(id) : null);
export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const isDuplicateKey = (e: unknown) => (e as { code?: number })?.code === 11000;
