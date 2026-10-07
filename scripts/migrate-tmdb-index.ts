/**
 * Cambia el índice único de `titles.tmdb_id` por uno sobre (tmdb_id, type), porque películas y series
 * de TMDB repiten ids. Crea el nuevo antes de borrar el viejo, así nunca queda sin unicidad.
 *   pnpm db:tmdb-index                                    -> informe sobre DB_NAME_TEST (no escribe)
 *   pnpm db:tmdb-index --apply                            -> aplica en DB_NAME_TEST
 *   pnpm db:tmdb-index --db <nombre> --apply [--allow-prod]
 */
import { connectMongo, disconnectMongo } from "../src/libs/mongo.js";
import { parseTarget } from "./lib/target.js";

const NEW_KEY = { tmdb_id: 1, type: 1 };
const NEW_OPTIONS = { unique: true, partialFilterExpression: { tmdb_id: { $exists: true } } };

const { dbName, apply } = parseTarget();
const titles = (await connectMongo(dbName)).db!.collection("titles");
const indexes = await titles.indexes();
const legacy = indexes.find((i) => i.unique && JSON.stringify(i.key) === JSON.stringify({ tmdb_id: 1 }));
const current = indexes.find((i) => JSON.stringify(i.key) === JSON.stringify(NEW_KEY));
const dups = await titles
  .aggregate([
    { $match: { tmdb_id: { $exists: true } } },
    { $group: { _id: { tmdb_id: "$tmdb_id", type: "$type" }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ])
  .toArray();

console.log(`"${dbName}": índice nuevo ${current ? "ya existe" : "falta"}; índice viejo ${legacy ? `"${legacy.name}" existe` : "no existe"}.`);
if (dups.length) {
  console.error(`Hay ${dups.length} pares (tmdb_id, type) repetidos; hay que resolverlos antes de crear el índice.`);
  process.exit(1);
}
if (!apply) {
  if (!current || legacy) console.log("Relánzalo con --apply para aplicar el cambio.");
} else {
  if (!current) console.log(`Creado: ${await titles.createIndex(NEW_KEY, NEW_OPTIONS)}`);
  if (legacy?.name) {
    await titles.dropIndex(legacy.name);
    console.log(`Borrado: ${legacy.name}`);
  }
}
await disconnectMongo();
