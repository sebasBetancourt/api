import mongoose, { type Types } from "mongoose";
import { isDuplicateKey } from "../libs/mongoHelpers.js";
import { SyncLockModel, SyncRunModel, type SyncRunDoc } from "../models/syncRun.model.js";

export type NewSyncRun = Omit<SyncRunDoc, "_id" | "finishedAt" | "error">;

export const syncRunRepository = {
  newId: () => new mongoose.Types.ObjectId(),

  /** Toma el candado si está libre o caducado. Atómico: dos procesos a la vez → solo uno gana. */
  async acquireLock(name: string, runId: Types.ObjectId, ttlMs: number): Promise<boolean> {
    const now = new Date();
    try {
      await SyncLockModel.updateOne(
        { _id: name, lockedUntil: { $lt: now } },
        { $set: { runId, lockedUntil: new Date(now.getTime() + ttlMs) } },
        { upsert: true },
      );
      return true;
    } catch (e) {
      if (isDuplicateKey(e)) return false;
      throw e;
    }
  },

  renewLock: (name: string, runId: Types.ObjectId, ttlMs: number) =>
    SyncLockModel.updateOne({ _id: name, runId }, { $set: { lockedUntil: new Date(Date.now() + ttlMs) } }),

  releaseLock: (name: string, runId: Types.ObjectId) => SyncLockModel.deleteOne({ _id: name, runId }),

  create: (run: NewSyncRun & { _id: Types.ObjectId }) => SyncRunModel.create(run),

  finish: (id: Types.ObjectId, patch: Pick<SyncRunDoc, "status" | "stats"> & { error?: string }) =>
    SyncRunModel.updateOne({ _id: id }, { $set: { ...patch, finishedAt: new Date() } }),

  saveStats: (id: Types.ObjectId, stats: SyncRunDoc["stats"]) => SyncRunModel.updateOne({ _id: id }, { $set: { stats } }),

  latest: (kind: string) => SyncRunModel.findOne({ kind }).sort({ startedAt: -1 }).lean(),
};
