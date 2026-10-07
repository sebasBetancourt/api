/**
 * Copia el catálogo (categorías y títulos, sin usuarios ni reseñas) de DB_NAME a otra BD para probar
 * con datos reales. Solo LEE la BD de producción.
 *   pnpm clone:catalog                 -> a DB_NAME_TEST
 *   pnpm clone:catalog --to <nombre>   -> a otra BD (nunca DB_NAME)
 * Borra las colecciones `categories` y `titles` de la BD destino antes de copiar.
 */
import mongoose from "mongoose";
import { env } from "../src/libs/env.js";
import { connectMongo, disconnectMongo } from "../src/libs/mongo.js";
import { setupCollections } from "../src/libs/mongoSetup.js";

const args = process.argv.slice(2);
const target = args.includes("--to") ? args[args.indexOf("--to") + 1] : env.DB_NAME_TEST;
if (!target || target === env.DB_NAME) {
  console.error(`Rechazado: el destino no puede ser la BD de producción ("${env.DB_NAME}").`);
  process.exit(1);
}

const conn = await connectMongo();
const source = conn.db!;
const dest = mongoose.connection.client.db(target);
await setupCollections(dest);

for (const name of ["categories", "titles"]) {
  await dest.collection(name).deleteMany({});
  const docs = await source.collection(name).find().toArray();
  for (let i = 0; i < docs.length; i += 1000) {
    // Algunos títulos importados no cumplen los validadores estrictos actuales; se copian tal cual.
    await dest.collection(name).insertMany(docs.slice(i, i + 1000), { ordered: false, bypassDocumentValidation: true });
  }
  console.log(`${name}: ${docs.length} documentos copiados a "${target}"`);
}
await disconnectMongo();
