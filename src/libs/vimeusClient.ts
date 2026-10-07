import { z } from "zod";

export type VimeusKind = "movies" | "series" | "animes";

/** Forma real de /api/listing/* (la documentación dice otra cosa: ver README). */
const pageSchema = z.object({
  data: z.object({ pages: z.number().int().nonnegative(), result: z.array(z.unknown()) }),
});

/** Fallo que invalida toda la corrida: clave rechazada o respuesta con un formato que no entendemos. */
export class VimeusFatalError extends Error {}
/** Una página que no respondió tras los reintentos: la corrida sigue, pero queda incompleta. */
export class VimeusPageError extends Error {}

export interface VimeusClientOptions {
  apiKey: string;
  baseUrl: string;
  timeoutMs?: number;
  retries?: number;
  /** Pausa entre páginas para no saturar a Vimeus. */
  pauseMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export interface VimeusListing {
  items: unknown[];
  pages: number;
  failedPages: number[];
  /** Se recorrieron todas las páginas sin errores; solo entonces se puede deducir qué desapareció. */
  complete: boolean;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createVimeusClient({
  apiKey, baseUrl, timeoutMs = 15_000, retries = 3, pauseMs = 150, fetchImpl = fetch, sleep = realSleep,
}: VimeusClientOptions) {
  async function getPage(kind: VimeusKind, page: number) {
    const url = new URL(`/api/listing/${kind}`, baseUrl);
    url.searchParams.set("page", String(page));
    const where = `${kind} página ${page}`;
    for (let attempt = 0; ; attempt++) {
      const res = await fetchImpl(url, {
        headers: { Accept: "application/json", "X-API-Key": apiKey, "User-Agent": "pelixflix-sync" },
        signal: AbortSignal.timeout(timeoutMs),
      }).catch(() => null);
      if (res?.ok) {
        const parsed = pageSchema.safeParse(await res.json().catch(() => null));
        if (!parsed.success) throw new VimeusFatalError(`Vimeus devolvió un formato inesperado (${where}); no se escribe nada.`);
        return parsed.data.data;
      }
      if (res?.status === 404) return { pages: 0, result: [] };
      if (res?.status === 401 || res?.status === 403) {
        throw new VimeusFatalError(`Vimeus rechazó la API key (HTTP ${res.status}).`);
      }
      const retryable = !res || res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= retries) {
        throw new VimeusPageError(`Vimeus no respondió (${where}): ${res ? `HTTP ${res.status}` : "error de red o timeout"}.`);
      }
      const retryAfter = Number(res?.headers.get("retry-after"));
      await sleep(retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt);
    }
  }

  /** Recorre las páginas de un listado (hasta `maxPages`) y devuelve los ítems sin validar. */
  async function listAll(kind: VimeusKind, { maxPages = Infinity } = {}): Promise<VimeusListing> {
    const first = await getPage(kind, 1);
    const items = [...first.result];
    const failedPages: number[] = [];
    const last = Math.min(first.pages, maxPages);
    for (let page = 2; page <= last; page++) {
      await sleep(pauseMs);
      try {
        const { result } = await getPage(kind, page);
        if (result.length === 0) break;
        items.push(...result);
      } catch (e) {
        if (!(e instanceof VimeusPageError)) throw e;
        failedPages.push(page);
      }
    }
    return { items, pages: first.pages, failedPages, complete: failedPages.length === 0 && last === first.pages };
  }

  return { getPage, listAll };
}

export type VimeusClient = ReturnType<typeof createVimeusClient>;
