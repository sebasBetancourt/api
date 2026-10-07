import mongoose, { type ClientSession } from "mongoose";
import { env } from "./env.js";

mongoose.set("autoIndex", false); // índices y validadores ya existen en Atlas; ver scripts/db-setup.ts
mongoose.set("autoCreate", false);
mongoose.set("strictQuery", true);

export async function connectMongo(dbName: string = env.DB_NAME) {
  await mongoose.connect(env.MONGODB_URI, {
    dbName,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
  });
  return mongoose.connection;
}

export const disconnectMongo = () => mongoose.disconnect();

/** Ejecuta `fn` en una transacción (requiere replica set; Atlas lo es). */
export async function withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
