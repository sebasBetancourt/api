# Pelixflix backend

Fastify 5 + TypeScript + MongoDB (Mongoose). Arquitectura por capas: `routes → controllers → services → repositories → models`.

## Puesta en marcha
```bash
cp .env.example .env      # completa MONGODB_URI, DB_NAME y JWT_SECRET
pnpm install
pnpm dev                  # http://localhost:3000  ·  docs en /docs
```
Funciona igual en local y desplegado: solo depende de `MONGODB_URI` (tu cluster de Atlas).

## Scripts
| | |
|---|---|
| `pnpm dev` / `build` / `start` | desarrollo (tsx watch) / bundle con tsup / producción |
| `pnpm typecheck` · `pnpm test` | tipos · tests unitarios y de rutas (sin BD) |
| `RUN_DB_TESTS=1 pnpm test` | integración contra Mongo en la BD **separada** `DB_NAME_TEST` (se crea con validadores y se borra al terminar) |
| `pnpm db:setup [--db nombre]` | crea colecciones, índices y validadores en una BD nueva; se niega a tocar `DB_NAME` sin `--allow-prod` |
| `pnpm seed` | categorías base y, si defines `SEED_ADMIN_*`, un admin (solo agrega, no borra) |
| `pnpm clone:catalog [--to nombre]` | copia categorías y títulos de `DB_NAME` a `DB_NAME_TEST` (o a otra BD, nunca a `DB_NAME`) |
| `pnpm categories:normalize [--db nombre] [--apply]` | corrige tildes y mayúsculas de los nombres de categoría; sin `--apply` solo informa |
| `pnpm categories:backfill [--db nombre] [--limit N] [--apply]` | asigna categorías a los títulos sin ninguna según sus géneros en TMDB (`TMDB_API_KEY`); sin `--apply` solo informa y guarda las respuestas en `scripts/.cache/` para retomar |

| `pnpm sync:vimeus [--db nombre] [--kind=…] [--max-pages=N] [--apply] [--unpublish-missing]` | sincroniza el catálogo con Vimeus (ver abajo); sin `--apply` solo informa |
| `pnpm db:tmdb-index [--db nombre] [--apply]` | cambia el índice único `tmdb_id` por `(tmdb_id, type)` |

Los scripts de datos trabajan por defecto sobre `DB_NAME_TEST`; escribir en `DB_NAME` exige `--db <DB_NAME> --apply --allow-prod`.

## Estructura
```
src/
  routes/ controllers/ services/<feature>/ repositories/   capas
  models/        schemas Mongoose sobre las colecciones existentes (campos legacy: embed_url, temps, eps...)
  schemas/       validación zod · interfaces/ DTOs · middlewares/ · libs/ · utils/
scripts/         db-setup, seed, clone-catalog, normalize-categories, backfill-categories-from-tmdb
legacy/          backend Express anterior (referencia)
```

## Notas sobre los datos
- Las colecciones tienen validadores `$jsonSchema` estrictos (ver `src/libs/mongoSetup.ts`): los modelos omiten campos en vez de guardar `null`, y `temps/eps` se guardan como `int32`.
- Favoritos: `?list=watchlist` usa `users.lists` (campo legacy) y `?list=favorites` usa `users.favorites`.
- Los likes se ajustan por delta para conservar los contadores históricos de reseñas.

## Sincronización con Vimeus
Importa y actualiza películas, series y anime desde los listados de Vimeus (`/api/listing/movies|series|animes`, cabecera `X-API-Key`). La forma real de la respuesta es `data: { result, pages }` con 100 ítems por página; una página fuera de rango devuelve `200` con `result: []`.
- Se lanza con `pnpm sync:vimeus`, desde el panel de admin (`POST /api/v1/admin/vimeus/sync` → `202`, `409` si ya hay una; `GET` da el estado de la última) o a diario si `VIMEUS_SYNC_ENABLED=true` (`VIMEUS_SYNC_CRON`, por defecto `0 4 * * *`). Un candado en `sync_locks` impide dos corridas a la vez; cada corrida queda en `sync_runs` (las de prueba, sin `--apply`, no escriben nada).
- Por título: siempre actualiza `embed_url`, `quality`, `backdropUrl` y `vimeusSyncedAt`; `posterUrl` e `imdb_id` solo si faltan. Los nuevos entran aprobados, sin sinopsis, año ni categorías (`source: "vimeus"`). Se empareja por `tmdb_id` (películas por un lado; series y anime comparten ids) y, si un show viene como anime y como serie, se queda como anime.
- `embed_url` solo se acepta si es `https://vimeus.com/e/(movie|serie|anime)?…` con `view_key`; `download_url` nunca se guarda. Si Vimeus cambia el formato, la corrida falla antes de escribir.
- Los títulos que desaparecen del listado conservan todo; solo con `--unpublish-missing`, con los listados completos y si el listado trae ≥ 80 % de lo ya sincronizado, se les quita el reproductor. Antes de escribir, el CLI guarda en `scripts/.cache/` una copia de los campos que cambia.
- Hasta aplicar `pnpm db:tmdb-index`, los `tmdb_id` que ya usa una película y vuelven como serie (o al revés) se omiten y se cuentan como choques.

## Recuperación de contraseña
`POST /auth/forgot-password` → `POST /auth/reset-password/validate` → `POST /auth/reset-password`.
- El token es aleatorio (32 bytes), caduca a los `PASSWORD_RESET_TTL_MINUTES` (30) y es de un solo uso; en la colección `tokens` solo se guarda su hash SHA-256 (`purpose: "password_reset"`), que el índice TTL borra al vencer.
- `forgot-password` responde siempre lo mismo, exista o no el correo. Límites: 5 cada 15 min por IP y por correo; 10 cada 15 min por IP en las otras dos.
- **Aún no se envían correos**: el enlace (`<primer FRONTEND_URL>/reset-password?token=…`) se escribe en los logs del backend, y en producción solo si `PASSWORD_RESET_LOG_LINK=true`. Así, en producción el flujo no entrega el enlace a nadie hasta que haya SMTP: basta implementar `ResetLinkSender` (`src/libs/resetLinkSender.ts`) y pasarlo en `buildApp`.
- Los JWT emitidos antes del cambio siguen vivos hasta que caducan (`JWT_EXPIRES_IN`).
