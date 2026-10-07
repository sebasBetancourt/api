import { z } from "zod";
import type { TitleType } from "../interfaces/title.interface.js";
import type { VimeusKind } from "./vimeusClient.js";

export const KIND_TO_TYPE: Record<VimeusKind, TitleType> = { movies: "movie", series: "tv", animes: "anime" };

const TMDB_IMG = "https://image.tmdb.org/t/p";
/** Ruta relativa de imagen de TMDB ("/abc123.jpg"); cualquier otra cosa se descarta. */
const tmdbPath = z.string().regex(/^\/[A-Za-z0-9_-]+\.(jpe?g|png|webp)$/);

const itemSchema = z.object({
  tmdb_id: z.number().int().positive(),
  title: z.string().trim().min(1).max(300),
  embed_url: z.string(),
  imdb_id: z.string().regex(/^tt\d{5,10}$/).nullish().catch(null),
  poster: tmdbPath.nullish().catch(null),
  backdrop: tmdbPath.nullish().catch(null),
  quality: z.string().trim().min(1).max(20).nullish().catch(null),
});

export interface VimeusTitle {
  type: TitleType;
  tmdbId: number;
  title: string;
  embedUrl: string;
  imdbId?: string;
  posterUrl?: string;
  backdropUrl?: string;
  quality?: string;
}

/**
 * `embed_url` acaba en el `src` de un iframe: solo se acepta https://vimeus.com/e/(movie|serie|anime)
 * con su `view_key`, sin credenciales ni fragmento.
 */
export function safeEmbedUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const ok =
    url.protocol === "https:" && url.host === "vimeus.com" && /^\/e\/(movie|serie|anime)$/.test(url.pathname) &&
    !url.username && !url.password && !url.hash && url.searchParams.has("view_key");
  return ok ? url.href : null;
}

/** Valida y traduce un listado de Vimeus. Los ítems inválidos y los `tmdb_id` repetidos se cuentan y se omiten. */
export function mapVimeusItems(kind: VimeusKind, raw: unknown[]) {
  const items: VimeusTitle[] = [];
  const seen = new Set<number>();
  let invalid = 0;
  let duplicates = 0;
  for (const r of raw) {
    const parsed = itemSchema.safeParse(r);
    const embedUrl = parsed.success ? safeEmbedUrl(parsed.data.embed_url) : null;
    if (!parsed.success || !embedUrl) {
      invalid++;
      continue;
    }
    const it = parsed.data;
    if (seen.has(it.tmdb_id)) {
      duplicates++;
      continue;
    }
    seen.add(it.tmdb_id);
    items.push({
      type: KIND_TO_TYPE[kind],
      tmdbId: it.tmdb_id,
      title: it.title,
      embedUrl,
      ...(it.imdb_id && { imdbId: it.imdb_id }),
      ...(it.poster && { posterUrl: `${TMDB_IMG}/w500${it.poster}` }),
      ...(it.backdrop && { backdropUrl: `${TMDB_IMG}/w1280${it.backdrop}` }),
      ...(it.quality && { quality: it.quality }),
    });
  }
  return { items, invalid, duplicates };
}
