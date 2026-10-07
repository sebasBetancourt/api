import { describe, expect, it, vi } from "vitest";
import { createVimeusClient, VimeusFatalError } from "../src/libs/vimeusClient.js";
import { mapVimeusItems, safeEmbedUrl } from "../src/libs/vimeusMapper.js";

const KEY = "secret-api-key";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const page = (result: unknown[], pages = 1) => json({ error: false, message: "Success", data: { pages, result } });

function client(responses: ((url: URL) => Response | Promise<Response>)[]) {
  const calls: { url: URL; headers: Record<string, string> }[] = [];
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url, headers: init?.headers as Record<string, string> });
    const next = responses.shift();
    if (!next) throw new Error("sin más respuestas");
    return next(url);
  });
  const c = createVimeusClient({ apiKey: KEY, baseUrl: "https://vimeus.test", fetchImpl: fetchImpl as typeof fetch, sleep: async () => {} });
  return { c, calls };
}

describe("vimeusClient", () => {
  it("manda la clave solo en la cabecera y recorre todas las páginas", async () => {
    const { c, calls } = client([() => page([{ a: 1 }], 2), () => page([{ a: 2 }], 2)]);
    const r = await c.listAll("movies");
    expect(r).toMatchObject({ items: [{ a: 1 }, { a: 2 }], pages: 2, complete: true, failedPages: [] });
    expect(calls.map((x) => x.url.search)).toEqual(["?page=1", "?page=2"]);
    expect(calls[0].headers["X-API-Key"]).toBe(KEY);
    expect(calls.every((x) => !x.url.href.includes(KEY))).toBe(true);
  });

  it("reintenta en 500 y en errores de red", async () => {
    const { c, calls } = client([
      () => json({}, 500),
      () => Promise.reject(new DOMException("timeout", "TimeoutError")),
      () => page([{ a: 1 }]),
    ]);
    expect((await c.listAll("series")).items).toHaveLength(1);
    expect(calls).toHaveLength(3);
  });

  it("una página que sigue fallando deja la corrida incompleta sin abortar", async () => {
    const fail = () => json({}, 503);
    const { c } = client([() => page([{ a: 1 }], 3), fail, fail, fail, fail, () => page([{ a: 3 }], 3)]);
    expect(await c.listAll("animes")).toMatchObject({ items: [{ a: 1 }, { a: 3 }], failedPages: [2], complete: false });
  });

  it("página fuera de rango (200 con result vacío) corta el recorrido", async () => {
    const { c, calls } = client([() => page([{ a: 1 }], 5), () => page([], 5)]);
    expect((await c.listAll("movies")).items).toHaveLength(1);
    expect(calls).toHaveLength(2);
  });

  it("maxPages limita y marca el listado como incompleto", async () => {
    const { c } = client([() => page([{ a: 1 }], 9)]);
    expect(await c.listAll("movies", { maxPages: 1 })).toMatchObject({ pages: 9, complete: false });
  });

  it.each([
    ["formato inesperado", () => json({ data: { movies: [] } })],
    ["clave rechazada", () => json({ error: true, message: "Invalid API key", data: null }, 401)],
  ])("%s aborta con un error que no contiene la clave", async (_, res) => {
    const { c } = client([res]);
    const err = await c.listAll("movies").catch((e) => e);
    expect(err).toBeInstanceOf(VimeusFatalError);
    expect(err.message).not.toContain(KEY);
  });
});

describe("vimeusMapper", () => {
  const item = (over: object = {}) => ({
    tmdb_id: 75214, title: "Violet Evergarden", quality: "FULL HD", poster: "/p.jpg", backdrop: "/b.jpg",
    embed_url: "https://vimeus.com/e/anime?tmdb=75214&view_key=k", download_url: "https://vimeus.com/d/movie?tmdb=75214&view_key=k",
    ...over,
  });

  it("traduce un ítem válido y no conserva download_url", () => {
    const { items } = mapVimeusItems("animes", [item({ imdb_id: "tt6900448" })]);
    expect(items).toEqual([{
      type: "anime", tmdbId: 75214, title: "Violet Evergarden", quality: "FULL HD", imdbId: "tt6900448",
      embedUrl: "https://vimeus.com/e/anime?tmdb=75214&view_key=k",
      posterUrl: "https://image.tmdb.org/t/p/w500/p.jpg", backdropUrl: "https://image.tmdb.org/t/p/w1280/b.jpg",
    }]);
    expect(JSON.stringify(items)).not.toContain("/d/");
  });

  it("series se guardan como tv", () => {
    expect(mapVimeusItems("series", [item({ embed_url: "https://vimeus.com/e/serie?tmdb=1&view_key=k" })]).items[0].type).toBe("tv");
  });

  it("descarta ítems sin campos obligatorios y cuenta repetidos", () => {
    const r = mapVimeusItems("movies", [item(), item(), { title: "x" }, item({ tmdb_id: -1 }), item({ title: "" })]);
    expect(r).toMatchObject({ invalid: 3, duplicates: 1 });
    expect(r.items).toHaveLength(1);
  });

  it("ignora imágenes o imdb con formato raro sin descartar el título", () => {
    const [t] = mapVimeusItems("movies", [item({ poster: "https://evil.test/x.jpg", backdrop: null, imdb_id: "123" })]).items;
    expect(t).not.toHaveProperty("posterUrl");
    expect(t).not.toHaveProperty("backdropUrl");
    expect(t).not.toHaveProperty("imdbId");
  });

  it.each([
    "https://evil.test/e/movie?view_key=k",
    "http://vimeus.com/e/movie?view_key=k",
    "https://vimeus.com.evil.test/e/movie?view_key=k",
    "https://user:pw@vimeus.com/e/movie?view_key=k",
    "https://vimeus.com/d/movie?tmdb=1&view_key=k",
    "https://vimeus.com/e/movie?tmdb=1",
    "https://vimeus.com/e/movie?view_key=k#x",
    "javascript:alert(1)//vimeus.com/e/movie?view_key=k",
    "/e/movie?tmdb=1&view_key=k",
  ])("rechaza el embed %s", (url) => {
    expect(safeEmbedUrl(url)).toBeNull();
    expect(mapVimeusItems("movies", [item({ embed_url: url })]).invalid).toBe(1);
  });
});
