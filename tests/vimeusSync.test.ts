import { describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import type { TitleType } from "../src/interfaces/title.interface.js";
import { env } from "../src/libs/env.js";
import { VimeusFatalError, type VimeusClient, type VimeusKind } from "../src/libs/vimeusClient.js";
import type { VimeusTitle } from "../src/libs/vimeusMapper.js";
import { tmdbNamespace, type titleSyncRepository } from "../src/repositories/titleSync.repository.js";
import type { syncRunRepository } from "../src/repositories/syncRun.repository.js";
import { createVimeusSync, redactSecrets, type SyncOptions } from "../src/services/vimeus/syncVimeusCatalogService.js";

interface Doc {
  _id: mongoose.Types.ObjectId;
  type: TitleType;
  title: string;
  tmdb_id?: number;
  imdb_id?: string;
  embed_url?: string;
  posterUrl?: string;
  vimeusSyncedAt?: Date;
  source?: string;
}

const embed = (path: string, id: number) => `https://vimeus.com/e/${path}?tmdb=${id}&view_key=k`;
const raw = (kind: VimeusKind, id: number, title = `t${id}`) => ({
  tmdb_id: id, title, embed_url: embed({ movies: "movie", series: "serie", animes: "anime" }[kind], id), poster: `/p${id}.jpg`,
});

/** Repositorio de títulos en memoria con la misma semántica que el real (espacios de ids, $ifNull...). */
function fakeTitles(docs: Doc[], legacyIndex = false) {
  const inNs = (type: TitleType, d: Doc) => tmdbNamespace(type).includes(d.type);
  const repo = {
    hasLegacyTmdbIndex: async () => legacyIndex,
    findExisting: async (type: TitleType, ids: number[]) =>
      new Map(docs.filter((d) => ids.includes(d.tmdb_id!) && inNs(type, d)).map((d) => [d.tmdb_id!, { ...d }])),
    findForeignTmdbIds: async (type: TitleType, ids: number[]) =>
      new Set(docs.filter((d) => ids.includes(d.tmdb_id!) && !inNs(type, d)).map((d) => d.tmdb_id!)),
    findAnimeTmdbIds: async (ids: number[]) =>
      new Set(docs.filter((d) => ids.includes(d.tmdb_id!) && d.embed_url?.startsWith("https://vimeus.com/e/anime?")).map((d) => d.tmdb_id!)),
    findUsedImdbIds: async (ids: string[]) => new Map(docs.filter((d) => d.imdb_id && ids.includes(d.imdb_id)).map((d) => [d.imdb_id!, d])),
    findUnlinkedByTitle: async (type: TitleType, titles: string[]) =>
      docs.filter((d) => inNs(type, d) && d.tmdb_id === undefined && titles.includes(d.title)),
    countSynced: async (type: TitleType) => docs.filter((d) => d.type === type && d.vimeusSyncedAt).length,
    countMissing: async (type: TitleType, seen: number[]) =>
      docs.filter((d) => d.type === type && d.embed_url && !seen.includes(d.tmdb_id!)).length,
    upsertMany: vi.fn(async (items: VimeusTitle[], runStart: Date) => {
      let created = 0, updated = 0;
      for (const it of items) {
        const d = docs.find((x) => x.tmdb_id === it.tmdbId && inNs(it.type, x));
        if (d) {
          Object.assign(d, { embed_url: it.embedUrl, vimeusSyncedAt: runStart, posterUrl: d.posterUrl ?? it.posterUrl });
          updated++;
        } else {
          docs.push({
            _id: new mongoose.Types.ObjectId(), type: it.type, title: it.title, tmdb_id: it.tmdbId, embed_url: it.embedUrl,
            posterUrl: it.posterUrl, vimeusSyncedAt: runStart, source: "vimeus",
          });
          created++;
        }
      }
      return { created, updated, duplicates: 0 };
    }),
    findUnseen: async (type: TitleType, runStart: Date) =>
      docs.filter((d) => d.type === type && d.embed_url && d.vimeusSyncedAt !== runStart).map((d) => ({ ...d })),
    unpublish: vi.fn(async (ids: mongoose.Types.ObjectId[]) => {
      const hit = docs.filter((d) => ids.some((id) => id.equals(d._id)));
      hit.forEach((d) => delete d.embed_url);
      return hit.length;
    }),
  };
  return repo as unknown as typeof titleSyncRepository & typeof repo;
}

function fakeRuns() {
  let lock: { runId: mongoose.Types.ObjectId } | null = null;
  const runs = new Map<string, Record<string, unknown>>();
  const repo = {
    newId: () => new mongoose.Types.ObjectId(),
    acquireLock: async (_: string, runId: mongoose.Types.ObjectId) => (lock ? false : ((lock = { runId }), true)),
    renewLock: async () => {},
    releaseLock: async (_: string, runId: mongoose.Types.ObjectId) => void (lock?.runId.equals(runId) && (lock = null)),
    create: async (run: { _id: mongoose.Types.ObjectId }) => void runs.set(String(run._id), { ...run }),
    finish: async (id: mongoose.Types.ObjectId, patch: object) => void Object.assign(runs.get(String(id))!, patch),
    latest: async () => null,
    get locked() {
      return lock !== null;
    },
    runs,
  };
  return repo as unknown as typeof syncRunRepository & typeof repo;
}

function fakeClient(listings: Partial<Record<VimeusKind, unknown[]>>, overrides: Partial<Record<VimeusKind, () => never>> = {}) {
  return {
    getPage: vi.fn(),
    listAll: vi.fn(async (kind: VimeusKind) => {
      overrides[kind]?.();
      return { items: listings[kind] ?? [], pages: 1, failedPages: [], complete: true };
    }),
  } as unknown as VimeusClient;
}

function setup(docs: Doc[], listings: Partial<Record<VimeusKind, unknown[]>>, opts: { legacyIndex?: boolean } = {}) {
  const titles = fakeTitles(docs, opts.legacyIndex);
  const runs = fakeRuns();
  const client = fakeClient(listings);
  const sync = createVimeusSync({ client, titles, runs, log: { info: () => {}, error: () => {} } });
  const run = (o: Partial<SyncOptions> = {}) => sync.run({ trigger: "cli", ...o });
  return { titles, runs, client, sync, run, docs };
}

describe("sincronización con Vimeus", () => {
  it("dry-run informa sin escribir", async () => {
    const existing: Doc = { _id: new mongoose.Types.ObjectId(), type: "movie", title: "Vieja", tmdb_id: 1, embed_url: "x" };
    const { run, titles, runs } = setup([existing], { movies: [raw("movies", 1), raw("movies", 2)] });
    const r = await run({ dryRun: true, kinds: ["movies"] });
    expect(r.stats.movies).toMatchObject({ fetched: 2, created: 1, updated: 1, complete: true });
    expect(titles.upsertMany).not.toHaveBeenCalled();
    expect(runs.runs.size).toBe(0); // ni registro de corrida ni candado
    expect(existing.embed_url).toBe("x");
  });

  it("es idempotente: la segunda corrida no crea nada", async () => {
    const { run, docs } = setup([], { movies: [raw("movies", 1), raw("movies", 2)], series: [raw("series", 3)] });
    expect((await run()).stats).toMatchObject({ movies: { created: 2 }, series: { created: 1 } });
    const second = await run();
    expect(second.stats).toMatchObject({ movies: { created: 0, updated: 2 }, series: { created: 0, updated: 1 } });
    expect(second.status).toBe("success");
    expect(docs).toHaveLength(3);
  });

  it("un show que viene como anime y como serie se queda como anime", async () => {
    const { run, docs } = setup([], { animes: [raw("animes", 10)], series: [raw("series", 10), raw("series", 11)] });
    const r = await run();
    expect(r.stats.series).toMatchObject({ skipped: 1, created: 1 });
    expect(docs.filter((d) => d.tmdb_id === 10)).toEqual([expect.objectContaining({ type: "anime", embed_url: embed("anime", 10) })]);
  });

  it("sincronizar solo series no pisa el reproductor de un anime ya sincronizado", async () => {
    const { run, docs } = setup([], { animes: [raw("animes", 10)], series: [raw("series", 10), raw("series", 11)] });
    await run({ kinds: ["animes"] });
    const r = await run({ kinds: ["series"] });
    expect(r.stats.series).toMatchObject({ skipped: 1, created: 1, updated: 0 });
    expect(docs.filter((d) => d.tmdb_id === 10)).toEqual([expect.objectContaining({ type: "anime", embed_url: embed("anime", 10) })]);
  });

  it("no pisa el póster curado de un título existente", async () => {
    const d: Doc = { _id: new mongoose.Types.ObjectId(), type: "movie", title: "Curada", tmdb_id: 5, posterUrl: "https://mi.poster/x.jpg" };
    const { run } = setup([d], { movies: [raw("movies", 5)] });
    await run({ kinds: ["movies"] });
    expect(d).toMatchObject({ posterUrl: "https://mi.poster/x.jpg", embed_url: embed("movie", 5) });
  });

  it("con el índice viejo cuenta como choque un tmdb_id usado por una película", async () => {
    const movie: Doc = { _id: new mongoose.Types.ObjectId(), type: "movie", title: "Peli", tmdb_id: 7 };
    const { run, titles } = setup([movie], { series: [raw("series", 7), raw("series", 8)] }, { legacyIndex: true });
    const r = await run({ kinds: ["series"] });
    expect(r.stats.series).toMatchObject({ collisions: 1, created: 1 });
    expect(titles.upsertMany.mock.calls[0][0].map((i: VimeusTitle) => i.tmdbId)).toEqual([8]);
  });

  it("avisa de series sin tmdb_id con el mismo título (posible duplicado)", async () => {
    const curated: Doc = { _id: new mongoose.Types.ObjectId(), type: "anime", title: "Naruto", embed_url: "x" };
    const { run } = setup([curated], { animes: [raw("animes", 46260, "Naruto")] });
    expect((await run({ dryRun: true, kinds: ["animes"] })).possibleDuplicates).toEqual(["Naruto (anime)"]);
  });

  describe("candado", () => {
    it("una segunda corrida simultánea recibe 409 y el candado se suelta al terminar", async () => {
      const { sync, runs } = setup([], { movies: [raw("movies", 1)] });
      const first = await sync.start({ trigger: "admin" });
      await expect(sync.start({ trigger: "cli" })).rejects.toMatchObject({ statusCode: 409 });
      await first.execute();
      expect(runs.locked).toBe(false);
      await expect(sync.run({ trigger: "cli" })).resolves.toMatchObject({ status: "success" });
    });

    it("si Vimeus cambia el formato aborta sin escribir, registra el fallo y suelta el candado", async () => {
      const titles = fakeTitles([]);
      const runs = fakeRuns();
      const client = fakeClient({ animes: [raw("animes", 1)] }, {
        movies: () => {
          throw new VimeusFatalError("Vimeus devolvió un formato inesperado");
        },
      });
      const sync = createVimeusSync({ client, titles, runs, log: { info: () => {}, error: () => {} } });
      await expect(sync.run({ trigger: "cli" })).rejects.toBeInstanceOf(VimeusFatalError);
      expect(titles.upsertMany).not.toHaveBeenCalled();
      expect([...runs.runs.values()][0]).toMatchObject({ status: "failed", error: "Vimeus devolvió un formato inesperado" });
      expect(runs.locked).toBe(false);
    });

    it("sin API key responde 503 sin tomar el candado", async () => {
      const saved = env.VIMEUS_API_KEY;
      env.VIMEUS_API_KEY = undefined;
      try {
        const runs = fakeRuns();
        const sync = createVimeusSync({ titles: fakeTitles([]), runs });
        await expect(sync.start({ trigger: "admin" })).rejects.toMatchObject({ statusCode: 503 });
        expect(runs.locked).toBe(false);
      } finally {
        env.VIMEUS_API_KEY = saved;
      }
    });
  });

  describe("títulos que desaparecen del listado", () => {
    const listing = (ids: number[]) => ({ movies: ids.map((id) => raw("movies", id)) });

    it("sin --unpublish-missing solo se informan", async () => {
      const old: Doc = { _id: new mongoose.Types.ObjectId(), type: "movie", title: "Vieja", tmdb_id: 99, embed_url: "x" };
      const { run, titles } = setup([old], listing([1]));
      const r = await run({ kinds: ["movies"] });
      expect(r.stats.movies).toMatchObject({ missing: 1, unavailable: 0 });
      expect(titles.unpublish).not.toHaveBeenCalled();
      expect(old.embed_url).toBe("x");
    });

    it("nunca en la primera corrida", async () => {
      const old: Doc = { _id: new mongoose.Types.ObjectId(), type: "movie", title: "Vieja", tmdb_id: 99, embed_url: "x" };
      const { run } = setup([old], listing([1]));
      const r = await run({ kinds: ["movies"], unpublishMissing: true });
      expect(r.notes.join()).toMatch(/primera corrida/);
      expect(old.embed_url).toBe("x");
    });

    it("tras una corrida previa, quita solo el reproductor de los no vistos y guarda copia antes", async () => {
      const { run, docs } = setup([], listing([1, 2, 3, 4, 5]));
      await run({ kinds: ["movies"] });
      const gone = docs.find((d) => d.tmdb_id === 5)!;
      const client = fakeClient(listing([1, 2, 3, 4]));
      const titles = fakeTitles(docs);
      const snapshots: unknown[][] = [];
      const again = createVimeusSync({ client, titles, runs: fakeRuns(), log: { info: () => {}, error: () => {} } });
      const r = await again.run({ trigger: "cli", kinds: ["movies"], unpublishMissing: true, onBeforeWrite: (rows) => void snapshots.push(rows) });
      expect(r.stats.movies).toMatchObject({ unavailable: 1, missing: 1 });
      expect(gone).toMatchObject({ title: "t5" });
      expect(gone.embed_url).toBeUndefined();
      expect(snapshots.at(-1)).toEqual([expect.objectContaining({ _id: gone._id, embed_url: embed("movie", 5) })]);
    });

    it("no quita nada si el listado trae menos del 80 % de lo ya sincronizado", async () => {
      const { run, docs } = setup([], listing([1, 2, 3, 4, 5]));
      await run({ kinds: ["movies"] });
      const again = createVimeusSync({ client: fakeClient(listing([1, 2, 3])), titles: fakeTitles(docs), runs: fakeRuns(), log: { info: () => {}, error: () => {} } });
      const r = await again.run({ trigger: "cli", kinds: ["movies"], unpublishMissing: true });
      expect(r.notes.join()).toMatch(/80 %/);
      expect(docs.every((d) => d.embed_url)).toBe(true);
    });

    it("series y anime exigen recorrer ambos listados", async () => {
      const { run } = setup([], { series: [raw("series", 1)] });
      const r = await run({ kinds: ["series"], unpublishMissing: true });
      expect(r.notes.join()).toMatch(/series y animes/);
    });
  });

  it("redactSecrets oculta la API key y las view_key", () => {
    expect(redactSecrets("fallo con KEY123 en https://vimeus.com/e/movie?tmdb=1&view_key=abc&x=1", "KEY123"))
      .toBe("fallo con *** en https://vimeus.com/e/movie?tmdb=1&view_key=***&x=1");
  });
});
