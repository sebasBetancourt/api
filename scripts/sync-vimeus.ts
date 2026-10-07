/**
 * Sincroniza el catálogo con los listados de Vimeus. Sin --apply solo informa (lee Vimeus y la BD).
 *   pnpm sync:vimeus [--db <nombre>] [--kind=movies|series|animes] [--max-pages=N]
 *                    [--apply] [--unpublish-missing] [--allow-prod]
 * Por defecto trabaja sobre DB_NAME_TEST. Antes de cada escritura guarda en scripts/.cache/ una copia
 * de los campos que va a cambiar (_id, embed_url, posterUrl, imdb_id, backdropUrl, quality).
 */
import { appendFileSync, mkdirSync } from "node:fs";
import type { VimeusKind } from "../src/libs/vimeusClient.js";
import { connectMongo, disconnectMongo } from "../src/libs/mongo.js";
import { createVimeusSync, SYNC_ORDER } from "../src/services/vimeus/syncVimeusCatalogService.js";
import { parseTarget } from "./lib/target.js";

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const { dbName, apply } = parseTarget(args);
const kind = flag("kind") as VimeusKind | undefined;
if (kind && !SYNC_ORDER.includes(kind)) {
  console.error(`--kind debe ser uno de: ${SYNC_ORDER.join(", ")}`);
  process.exit(1);
}
const maxPages = flag("max-pages") ? Number(flag("max-pages")) : undefined;
if (maxPages !== undefined && !(maxPages > 0)) {
  console.error("--max-pages debe ser un número positivo");
  process.exit(1);
}
const unpublishMissing = args.includes("--unpublish-missing");

const cacheDir = new URL("./.cache/", import.meta.url);
const snapshotFile = new URL(`vimeus-rollback-${dbName}-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`, cacheDir);
let snapshotRows = 0;

await connectMongo(dbName);
console.log(`${apply ? "Aplicando" : "Informe (sin cambios)"} en "${dbName}"${kind ? ` · solo ${kind}` : ""}${maxPages ? ` · ${maxPages} páginas` : ""}${unpublishMissing ? " · quitando reproductores ausentes" : ""}`);

const sync = createVimeusSync({ log: { info: console.log, error: console.error } });
try {
  const r = await sync.run({
    trigger: "cli",
    dryRun: !apply,
    unpublishMissing,
    maxPages,
    ...(kind && { kinds: [kind] }),
    onProgress: (m) => process.stdout.write(`\r  ${m}`.padEnd(60)),
    onBeforeWrite: (rows) => {
      if (!rows.length) return;
      mkdirSync(cacheDir, { recursive: true });
      appendFileSync(snapshotFile, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
      snapshotRows += rows.length;
    },
  });
  process.stdout.write("\n");
  console.table(
    Object.fromEntries(Object.entries(r.stats).map(([k, s]) => [k, {
      leídos: s.fetched, inválidos: s.invalid, omitidos: s.skipped, choques: s.collisions,
      [apply ? "creados" : "a crear"]: s.created, [apply ? "actualizados" : "a actualizar"]: s.updated,
      "sin estar en Vimeus": s.missing, [apply ? "reproductor quitado" : "reproductor a quitar"]: s.unavailable,
      completo: s.complete ? "sí" : "no",
    }])),
  );
  for (const n of r.notes) console.log(`  · ${n}`);
  if (r.possibleDuplicates.length) {
    console.log(`  · ${r.possibleDuplicates.length} posibles duplicados (títulos nuestros sin tmdb_id con el mismo nombre):`);
    for (const d of r.possibleDuplicates.slice(0, 20)) console.log(`      ${d}`);
  }
  if (snapshotRows) console.log(`  Copia para revertir (${snapshotRows} filas): ${snapshotFile.pathname}`);
  console.log(`Corrida ${r.runId}: ${r.status}.`);
} catch (e) {
  process.stdout.write("\n");
  console.error((e as Error).message);
  process.exitCode = 1;
} finally {
  await disconnectMongo();
}
