/**
 * Crea colecciones, índices y validadores en una BD.
 *   pnpm db:setup                 -> BD de tests (DB_NAME_TEST)
 *   pnpm db:setup --db <nombre>   -> otra BD
 * Por seguridad NO toca la BD de producción (DB_NAME) salvo con --allow-prod.
 */
import { env } from "../src/libs/env.js";
import { connectMongo, disconnectMongo } from "../src/libs/mongo.js";
import { setupCollections } from "../src/libs/mongoSetup.js";

const args = process.argv.slice(2);
const dbName = args.includes("--db") ? args[args.indexOf("--db") + 1] : env.DB_NAME_TEST;

if (dbName === env.DB_NAME && !args.includes("--allow-prod")) {
  console.error(`Rechazado: "${dbName}" es la BD de producción. Usa --allow-prod si es lo que quieres.`);
  process.exit(1);
}

const conn = await connectMongo(dbName);
await setupCollections(conn.db!);
console.log(`Colecciones, índices y validadores listos en "${dbName}".`);
await disconnectMongo();
