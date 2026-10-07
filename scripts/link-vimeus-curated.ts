/**
 * Enlaza series/anime curados sin `tmdb_id` con su título en Vimeus (mismo nombre), para que la
 * sincronización los actualice en vez de crear un duplicado. Sin --apply solo informa.
 *   pnpm link:vimeus-curated [--db <nombre>] [--apply] [--allow-prod]
 * Si un nombre corresponde a varios ids de TMDB se prefiere el listado del mismo tipo; si sigue habiendo
 * más de uno, o el id ya lo usa otro título, no se toca y se informa.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { env } from "../src/libs/env.js";
import { connectMongo, disconnectMongo } from "../src/libs/mongo.js";
import { createVimeusClient, type VimeusKind } from "../src/libs/vimeusClient.js";
import { mapVimeusItems, type VimeusTitle } from "../src/libs/vimeusMapper.js";
import { TitleModel } from "../src/models/title.model.js";
import { parseTarget } from "./lib/target.js";

const { dbName, apply } = parseTarget();
if (!env.VIMEUS_API_KEY) {
  console.error("Falta VIMEUS_API_KEY.");
  process.exit(1);
}

const key = (title: string) => title.trim().toLocaleLowerCase("es");
const vimeus = createVimeusClient({ apiKey: env.VIMEUS_API_KEY, baseUrl: env.VIMEUS_BASE_URL });
const byTitle = new Map<string, VimeusTitle[]>();
for (const kind of ["animes", "series"] satisfies VimeusKind[]) {
  const listing = await vimeus.listAll(kind);
  if (!listing.complete) {
    console.error(`El listado de ${kind} vino incompleto; no se enlaza nada.`);
    process.exit(1);
  }
  for (const it of mapVimeusItems(kind, listing.items).items) byTitle.set(key(it.title), [...(byTitle.get(key(it.title)) ?? []), it]);
}

await connectMongo(dbName);
console.log(`${apply ? "Aplicando" : "Informe (sin cambios)"} en "${dbName}"`);
try {
  const curated = await TitleModel.find({ type: { $in: ["tv", "anime"] }, tmdb_id: { $exists: false } }).select("title type").lean();
  const rows: { título: string; tipo: string; tmdb_id: number | string; resultado: string }[] = [];
  const toLink: { _id: unknown; tmdbId: number }[] = [];

  for (const t of curated) {
    const matches = byTitle.get(key(t.title)) ?? [];
    if (!matches.length) continue;
    const ids = new Set(matches.map((m) => m.tmdbId));
    const sameType = new Set(matches.filter((m) => m.type === t.type).map((m) => m.tmdbId));
    const pick = ids.size === 1 ? [...ids] : [...sameType];
    if (pick.length !== 1) {
      rows.push({ título: t.title, tipo: t.type, tmdb_id: [...ids].join(", "), resultado: "ambiguo, no se toca" });
      continue;
    }
    const tmdbId = pick[0];
    const taken = await TitleModel.exists({ tmdb_id: tmdbId, type: { $in: ["tv", "anime"] } });
    if (taken || toLink.some((l) => l.tmdbId === tmdbId)) {
      rows.push({ título: t.title, tipo: t.type, tmdb_id: tmdbId, resultado: "id ya usado, no se toca" });
      continue;
    }
    toLink.push({ _id: t._id, tmdbId });
    rows.push({ título: t.title, tipo: t.type, tmdb_id: tmdbId, resultado: apply ? "enlazado" : "a enlazar" });
  }

  console.table(rows);
  if (apply && toLink.length) {
    const cacheDir = new URL("./.cache/", import.meta.url);
    const file = new URL(`link-curated-rollback-${dbName}-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`, cacheDir);
    mkdirSync(cacheDir, { recursive: true });
    appendFileSync(file, toLink.map((l) => JSON.stringify({ _id: l._id, tmdb_id: null })).join("\n") + "\n");
    const r = await TitleModel.bulkWrite(
      toLink.map((l) => ({ updateOne: { filter: { _id: l._id, tmdb_id: { $exists: false } }, update: { $set: { tmdb_id: l.tmdbId } } } })),
    );
    console.log(`Enlazados ${r.modifiedCount}. Copia para revertir: ${file.pathname}`);
  }
} finally {
  await disconnectMongo();
}
