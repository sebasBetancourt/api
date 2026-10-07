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

## Estructura
```
src/
  routes/ controllers/ services/<feature>/ repositories/   capas
  models/        schemas Mongoose sobre las colecciones existentes (campos legacy: embed_url, temps, eps...)
  schemas/       validación zod · interfaces/ DTOs · middlewares/ · libs/ · utils/
scripts/         db-setup, seed
legacy/          backend Express anterior (referencia)
```

## Notas sobre los datos
- Las colecciones tienen validadores `$jsonSchema` estrictos (ver `src/libs/mongoSetup.ts`): los modelos omiten campos en vez de guardar `null`, y `temps/eps` se guardan como `int32`.
- Favoritos: `?list=watchlist` usa `users.lists` (campo legacy) y `?list=favorites` usa `users.favorites`.
- Los likes se ajustan por delta para conservar los contadores históricos de reseñas.
