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

## Recuperación de contraseña
`POST /auth/forgot-password` → `POST /auth/reset-password/validate` → `POST /auth/reset-password`.
- El token es aleatorio (32 bytes), caduca a los `PASSWORD_RESET_TTL_MINUTES` (30) y es de un solo uso; en la colección `tokens` solo se guarda su hash SHA-256 (`purpose: "password_reset"`), que el índice TTL borra al vencer.
- `forgot-password` responde siempre lo mismo, exista o no el correo. Límites: 5 cada 15 min por IP y por correo; 10 cada 15 min por IP en las otras dos.
- **Aún no se envían correos**: el enlace (`<primer FRONTEND_URL>/reset-password?token=…`) se escribe en los logs del backend, y en producción solo si `PASSWORD_RESET_LOG_LINK=true`. Así, en producción el flujo no entrega el enlace a nadie hasta que haya SMTP: basta implementar `ResetLinkSender` (`src/libs/resetLinkSender.ts`) y pasarlo en `buildApp`.
- Los JWT emitidos antes del cambio siguen vivos hasta que caducan (`JWT_EXPIRES_IN`).
