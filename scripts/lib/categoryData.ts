import { env } from "../../src/libs/env.js";

/**
 * BD sobre la que trabaja un script de datos (por defecto DB_NAME_TEST) y si escribe (`--apply`).
 * Escribir en la BD de producción exige además `--allow-prod`.
 */
export function parseTarget(args = process.argv.slice(2)) {
  const dbName = args.includes("--db") ? args[args.indexOf("--db") + 1] : env.DB_NAME_TEST;
  const apply = args.includes("--apply");
  if (!dbName) {
    console.error("Falta el nombre de la BD tras --db.");
    process.exit(1);
  }
  if (apply && dbName === env.DB_NAME && !args.includes("--allow-prod")) {
    console.error(`Rechazado: "${dbName}" es la BD de producción. Usa --allow-prod si es lo que quieres.`);
    process.exit(1);
  }
  return { dbName, apply };
}

/** Clave para comparar nombres sin tildes ni mayúsculas ("Ciencia Ficcion" ≡ "Ciencia ficción"). */
export const foldName = (name: string) =>
  name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

/** Nombres actuales → nombre correcto. "Musical" y "Música" son géneros distintos y se quedan como están. */
export const CATEGORY_RENAMES: Record<string, string> = {
  Accion: "Acción",
  Animacion: "Animación",
  "Aventura Fantástica": "Aventura fantástica",
  Belica: "Bélica",
  Biografia: "Biografía",
  "Ciencia Ficcion": "Ciencia ficción",
  Fantasia: "Fantasía",
  Superheroes: "Superhéroes",
  "Film Noir": "Film noir",
  "Game Show": "Game show",
  "Talk Show": "Talk show",
};

export interface Rename<Id> {
  id: Id;
  from: string;
  to: string;
}

/** Renombres pendientes; los que chocarían con otra categoría ya existente se devuelven aparte. */
export function planRenames<Id>(categories: { _id: Id; name: string }[]) {
  const names = new Set(categories.map((c) => c.name));
  const renames: Rename<Id>[] = [];
  const conflicts: Rename<Id>[] = [];
  for (const c of categories) {
    const to = CATEGORY_RENAMES[c.name];
    if (!to || to === c.name) continue;
    (names.has(to) ? conflicts : renames).push({ id: c._id, from: c.name, to });
  }
  return { renames, conflicts };
}

/** Géneros de películas de TMDB → nuestras categorías. 10770 ("TV Movie") no es un género y se ignora. */
const MOVIE_GENRES: Record<number, string[]> = {
  28: ["Acción"],
  12: ["Aventura"],
  16: ["Animación"],
  35: ["Comedia"],
  80: ["Crimen"],
  99: ["Documental"],
  18: ["Drama"],
  10751: ["Familiar"],
  14: ["Fantasía"],
  36: ["Historia"],
  27: ["Terror"],
  10402: ["Música"],
  9648: ["Misterio"],
  10749: ["Romance"],
  878: ["Ciencia ficción"],
  53: ["Suspenso"],
  10752: ["Bélica"],
  37: ["Western"],
};

/** Géneros de series de TMDB. 10763 ("News") y 10766 ("Soap") no tienen equivalente y se ignoran. */
const TV_GENRES: Record<number, string[]> = {
  10759: ["Acción", "Aventura"],
  16: ["Animación"],
  35: ["Comedia"],
  80: ["Crimen"],
  99: ["Documental"],
  18: ["Drama"],
  10751: ["Familiar"],
  10762: ["Familiar"],
  9648: ["Misterio"],
  10764: ["Reality TV"],
  10765: ["Ciencia ficción", "Fantasía"],
  10767: ["Talk show"],
  10768: ["Bélica"],
  37: ["Western"],
};

/** Nombres de categoría (sin repetir) para los géneros TMDB de un título. */
export function genresToCategoryNames(kind: "movie" | "tv", genreIds: number[]): string[] {
  const table = kind === "movie" ? MOVIE_GENRES : TV_GENRES;
  return [...new Set(genreIds.flatMap((id) => table[id] ?? []))];
}
