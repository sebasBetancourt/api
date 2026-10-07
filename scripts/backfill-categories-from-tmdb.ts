/**
 * Asigna categorías a los títulos que no tienen ninguna, a partir de sus géneros en TMDB (`tmdb_id`).
 * Requiere TMDB_API_KEY en .env (clave v3 o token de lectura v4). Sin --apply solo informa.
 *   pnpm categories:backfill [--db <nombre>] [--limit N] [--rps 40] [--apply] [--allow-prod]
 * Las respuestas de TMDB se guardan en scripts/.cache/: si se corta, al relanzarlo retoma sin repetir
 * peticiones. Con --apply solo rellena `categoriesIds` vacíos y crea las categorías que falten.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import mongoose, { type Types } from "mongoose";
import { connectMongo, disconnectMongo } from "../src/libs/mongo.js";
import { foldName, genresToCategoryNames, parseTarget } from "./lib/categoryData.js";

type Kind = "movie" | "tv";
interface TitleRow {
  _id: Types.ObjectId;
  title: string;
  type: string;
  tmdb_id: number;
}

const args = process.argv.slice(2);
const numArg = (flag: string, fallback: number) =>
  args.includes(flag) ? Number(args[args.indexOf(flag) + 1]) || fallback : fallback;
const { dbName, apply } = parseTarget(args);
const limit = numArg("--limit", 0);
const rps = numArg("--rps", 40);

const apiKey = process.env.TMDB_API_KEY?.trim();
if (!apiKey) {
  console.error("Falta TMDB_API_KEY en .env (https://www.themoviedb.org/settings/api).");
  process.exit(1);
}
const isBearer = apiKey.startsWith("eyJ");

const cacheDir = new URL("./.cache/", import.meta.url);
const cacheFile = new URL("tmdb-genres.json", cacheDir);
/** `${kind}:${tmdb_id}` → ids de género, o null si TMDB no lo tiene. */
const cache = new Map<string, number[] | null>(
  existsSync(cacheFile) ? Object.entries(JSON.parse(readFileSync(cacheFile, "utf8"))) : [],
);
const saveCache = () => {
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(cacheFile, JSON.stringify(Object.fromEntries(cache)));
};
process.on("SIGINT", () => {
  saveCache();
  console.log("\nInterrumpido; progreso guardado.");
  process.exit(130);
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let nextSlot = 0;
async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + 1000 / rps;
  if (wait) await sleep(wait);
}

async function fetchGenres(kind: Kind, id: number): Promise<number[] | null> {
  const url = new URL(`https://api.themoviedb.org/3/${kind}/${id}`);
  if (!isBearer) url.searchParams.set("api_key", apiKey!);
  const headers: Record<string, string> = isBearer ? { Authorization: `Bearer ${apiKey}` } : {};
  for (let attempt = 0; ; attempt++) {
    await throttle();
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (res?.ok) return ((await res.json()) as { genres?: { id: number }[] }).genres?.map((g) => g.id) ?? [];
    if (res?.status === 404) return null;
    if (res?.status === 401) throw new Error("TMDB rechazó la clave (401): revisa TMDB_API_KEY.");
    if (res && res.status !== 429 && res.status < 500) throw new Error(`TMDB respondió ${res.status} en ${kind}/${id}.`);
    if (attempt >= 5) throw new Error(`TMDB no responde (${kind}/${id}); relánzalo más tarde.`);
    const retryAfter = Number(res?.headers.get("retry-after"));
    await sleep(retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt);
  }
}

/** Las series y el anime se buscan en /tv; si un anime no está ahí, se prueba como película. */
async function genresFor(t: TitleRow): Promise<{ kind: Kind; genres: number[] } | null> {
  const kinds: Kind[] = t.type === "movie" ? ["movie"] : t.type === "anime" ? ["tv", "movie"] : ["tv"];
  for (const kind of kinds) {
    const key = `${kind}:${t.tmdb_id}`;
    if (!cache.has(key)) cache.set(key, await fetchGenres(kind, t.tmdb_id));
    const genres = cache.get(key);
    if (genres) return { kind, genres };
  }
  return null;
}

const db = (await connectMongo(dbName)).db!;
const titles = db.collection<TitleRow>("titles");
const categories = db.collection<{ _id: Types.ObjectId; name: string; createdAt: Date }>("categories");

const pending = await titles
  .find(
    { tmdb_id: { $gt: 0 }, $or: [{ categoriesIds: { $exists: false } }, { categoriesIds: { $size: 0 } }] },
    { projection: { title: 1, type: 1, tmdb_id: 1 }, limit },
  )
  .toArray();
console.log(`${apply ? "Aplicando" : "Informe (sin cambios)"} en "${dbName}": ${pending.length} títulos sin categoría con tmdb_id.`);

const assigned = new Map<Types.ObjectId, string[]>();
let notFound = 0;
let unmapped = 0;
let done = 0;
const queue = [...pending];
await Promise.all(
  Array.from({ length: 8 }, async () => {
    for (let t = queue.shift(); t; t = queue.shift()) {
      const found = await genresFor(t);
      const names = found ? genresToCategoryNames(found.kind, found.genres) : [];
      if (!found) notFound++;
      else if (!names.length) unmapped++;
      else assigned.set(t._id, names);
      if (++done % 250 === 0) {
        saveCache();
        process.stdout.write(`\r  ${done}/${pending.length}`);
      }
    }
  }),
);
saveCache();
if (pending.length >= 250) process.stdout.write("\n");

const existing = new Map<string, { id: Types.ObjectId; name: string }>();
for (const c of await categories.find().toArray()) {
  if (!existing.has(foldName(c.name))) existing.set(foldName(c.name), { id: c._id, name: c.name });
}
const perCategory = new Map<string, number>();
for (const names of assigned.values()) for (const n of names) perCategory.set(n, (perCategory.get(n) ?? 0) + 1);
const missing = [...perCategory.keys()].filter((n) => !existing.has(foldName(n)));

console.log(`  con categorías: ${assigned.size} · no están en TMDB: ${notFound} · sin género equivalente: ${unmapped}`);
console.log(`  categorías nuevas: ${missing.length ? missing.join(", ") : "ninguna"}`);
for (const [name, n] of [...perCategory].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${(existing.get(foldName(name))?.name ?? name).padEnd(20)} ${n}`);
}
const sample = pending.filter((t) => assigned.has(t._id)).slice(0, 8);
console.log("  ejemplos:");
for (const t of sample) console.log(`    ${t.title} → ${assigned.get(t._id)!.join(", ")}`);

if (apply) {
  for (const name of missing) {
    const { insertedId } = await categories.insertOne({ _id: new mongoose.Types.ObjectId(), name, createdAt: new Date() });
    existing.set(foldName(name), { id: insertedId, name });
  }
  const ops = [...assigned].map(([_id, names]) => ({
    updateOne: {
      filter: { _id, $or: [{ categoriesIds: { $exists: false } }, { categoriesIds: { $size: 0 } }] },
      update: { $set: { categoriesIds: names.map((n) => existing.get(foldName(n))!.id) } },
    },
  }));
  let modified = 0;
  for (let i = 0; i < ops.length; i += 1000) {
    // Algunos títulos importados no cumplen los validadores estrictos actuales; solo se toca categoriesIds.
    const res = await titles.bulkWrite(ops.slice(i, i + 1000), { ordered: false, bypassDocumentValidation: true });
    modified += res.modifiedCount;
  }
  console.log(`Títulos actualizados: ${modified}.`);
} else if (assigned.size) {
  console.log("Relánzalo con --apply para guardar los cambios.");
}

await disconnectMongo();
