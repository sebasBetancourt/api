/**
 * Corrige tildes y mayúsculas de los nombres de categoría ("Accion" → "Acción"). Solo cambia
 * `categories.name`: los títulos las referencian por _id. Se puede relanzar sin efecto.
 *   pnpm categories:normalize                        -> informe sobre DB_NAME_TEST (no escribe)
 *   pnpm categories:normalize --apply                -> aplica en DB_NAME_TEST
 *   pnpm categories:normalize --db <nombre> [--apply] [--allow-prod]
 */
import type { Types } from "mongoose";
import { connectMongo, disconnectMongo } from "../src/libs/mongo.js";
import { planRenames } from "./lib/categoryData.js";
import { parseTarget } from "./lib/target.js";

const { dbName, apply } = parseTarget();
const categories = (await connectMongo(dbName)).db!.collection<{ _id: Types.ObjectId; name: string }>("categories");

const { renames, conflicts } = planRenames(await categories.find({}, { projection: { name: 1 } }).toArray());

console.log(`${apply ? "Aplicando" : "Informe (sin cambios)"} en "${dbName}": ${renames.length} categorías a renombrar.`);
let changed = 0;
for (const r of renames) {
  console.log(`  "${r.from}" → "${r.to}"`);
  if (apply) changed += (await categories.updateOne({ _id: r.id, name: r.from }, { $set: { name: r.to } })).modifiedCount;
}
for (const c of conflicts) {
  console.warn(`  omitida "${c.from}" → "${c.to}": ya existe otra categoría con ese nombre; hay que fusionarlas a mano.`);
}
if (apply) console.log(`Renombradas: ${changed}.`);
else if (renames.length) console.log("Relánzalo con --apply para guardar los cambios.");

await disconnectMongo();
