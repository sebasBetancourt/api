// Integración contra MongoDB real, en una BD SEPARADA (DB_NAME_TEST) con los validadores
// $jsonSchema estrictos aplicados. Se omite salvo que RUN_DB_TESTS=1. Nunca toca DB_NAME.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const run = process.env.RUN_DB_TESTS === "1";
const tag = `e2e${Date.now()}`;

describe.skipIf(!run)("flujo completo contra MongoDB", { timeout: 30_000 }, () => {
  let app: Awaited<ReturnType<typeof import("../src/app.js").buildApp>>;
  let mongo: typeof import("../src/libs/mongo.js");
  let UserModel: typeof import("../src/models/user.model.js").UserModel;
  let adminToken = "", userToken = "", titleId = "", reviewId = "", categoryId = "", userId = "";
  const adminEmail = `${tag}-admin@test.dev`;
  const userEmail = `${tag}-user@test.dev`;
  const resetLinks: string[] = [];
  const nextToken = async (n: number) => {
    await vi.waitFor(() => expect(resetLinks).toHaveLength(n));
    return new URL(resetLinks[n - 1]).searchParams.get("token")!;
  };

  const call = (method: string, url: string, token?: string, payload?: object) =>
    app.inject({
      method: method as "GET", url: `/api/v1${url}`, payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  beforeAll(async () => {
    const { env } = await import("../src/libs/env.js");
    if (env.DB_NAME_TEST === env.DB_NAME) throw new Error("DB_NAME_TEST no puede ser la BD de producción");
    mongo = await import("../src/libs/mongo.js");
    const conn = await mongo.connectMongo(env.DB_NAME_TEST);
    await (await import("../src/libs/mongoSetup.js")).setupCollections(conn.db!);
    UserModel = (await import("../src/models/user.model.js")).UserModel;
    app = await (await import("../src/app.js")).buildApp({
      resetLinkSender: { send: async (_email, link) => void resetLinks.push(link) },
    });
  });

  afterAll(async () => {
    const { env } = await import("../src/libs/env.js");
    if (mongo && env.DB_NAME_TEST !== env.DB_NAME) await (await import("mongoose")).default.connection.dropDatabase();
    await mongo?.disconnectMongo();
  });

  it("registro y login (documento cumple el validador de users)", async () => {
    for (const email of [adminEmail, userEmail]) {
      const r = await call("POST", "/auth/register", undefined, { email, password: "secret123", name: tag, phone: null, country: null });
      expect(r.statusCode).toBe(201);
    }
    expect((await call("POST", "/auth/register", undefined, { email: userEmail, password: "secret123", name: tag })).statusCode).toBe(409);
    await UserModel.updateOne({ email: adminEmail }, { $set: { role: "admin" } });
    adminToken = (await call("POST", "/auth/login", undefined, { email: adminEmail, password: "secret123" })).json().token;
    const login = (await call("POST", "/auth/login", undefined, { email: userEmail, password: "secret123" })).json();
    userToken = login.token;
    userId = login.user.id;
    expect(adminToken && userToken).toBeTruthy();
    expect(userId).toMatch(/^[0-9a-f]{24}$/);
    expect((await call("POST", "/auth/login", undefined, { email: userEmail, password: "mala" })).statusCode).toBe(401);
  });

  it("categorías: solo admin crea; duplicada da 409", async () => {
    expect((await call("POST", "/categories/create", userToken, { name: `${tag}-cat` })).statusCode).toBe(403);
    const r = await call("POST", "/categories/create", adminToken, { name: `${tag}-cat` });
    expect(r.statusCode).toBe(201);
    categoryId = r.json().category.id;
    expect((await call("POST", "/categories/create", adminToken, { name: `${tag}-cat` })).statusCode).toBe(409);
    expect((await call("PATCH", `/categories/${categoryId}`, adminToken, { name: `${tag}-cat2` })).json().name).toBe(`${tag}-cat2`);
  });

  it("título: crear, pendiente oculto, aprobar, embed, serie con temporadas int", async () => {
    const r = await call("POST", "/titles/create", userToken, {
      title: `${tag}-peli`, description: "d", type: "movie", year: 2020, author: "a", categoriesIds: [categoryId],
    });
    expect(r.statusCode).toBe(201);
    titleId = r.json().id;
    expect((await call("POST", "/titles/create", userToken, {
      title: `${tag.toUpperCase()}-PELI`, description: "d", type: "movie", year: 2020, author: "a", categoriesIds: [categoryId],
    })).statusCode).toBe(409); // duplicado ignorando mayúsculas
    const serie = await call("POST", "/titles/create", userToken, {
      title: `${tag}-serie`, description: "d", type: "tv", year: 2021, author: "a", categoriesIds: [categoryId], seasons: 2, episodes: 10,
    });
    expect(serie.statusCode).toBe(201); // temps/eps como int32 cumplen el validador

    expect((await call("GET", `/titles/list?search=${tag}`)).json()).toHaveLength(0);
    expect((await call("PATCH", `/titles/${titleId}/approve`, userToken)).statusCode).toBe(403);
    expect((await call("PATCH", `/titles/${titleId}/approve`, adminToken)).statusCode).toBe(200);
    expect((await call("PUT", `/titles/${titleId}/embed`, adminToken, { embedUrl: "https://example.com/e/1" })).statusCode).toBe(200);
    const shown = await call("GET", `/titles/list?search=${tag}&categoryId=${categoryId}`);
    expect(shown.json()).toHaveLength(1);
    const detail = (await call("GET", `/titles/${titleId}`)).json();
    expect(detail).toMatchObject({ embedUrl: "https://example.com/e/1", creator: tag, categories: [{ id: categoryId }] });
    const serieDetail = (await call("GET", `/titles/${serie.json().id}`)).json();
    expect(serieDetail).toMatchObject({ seasons: 2, episodes: 10 });
    const upd = await call("PATCH", `/titles/${titleId}`, adminToken, { description: "nueva", year: 2019, posterUrl: null });
    expect(upd.statusCode).toBe(200);
    expect(upd.json()).toMatchObject({ description: "nueva", year: 2019, posterUrl: null });
    expect((await call("PATCH", `/titles/${titleId}`, userToken, { year: 2000 })).statusCode).toBe(403);
    expect((await call("PUT", `/titles/${titleId}/embed`, adminToken, { embedUrl: null })).statusCode).toBe(200);
    expect((await call("GET", `/titles/${titleId}`)).json().embedUrl).toBeNull();
  });

  it("reseñas: rating, likes por delta, ranking, permisos, CSV", async () => {
    const r = await call("POST", "/reviews/create", userToken, { title: "buena", titleId, score: 4, comment: "ok" });
    expect(r.statusCode).toBe(201);
    reviewId = r.json().id;
    expect((await call("GET", `/titles/${titleId}`)).json()).toMatchObject({ ratingAvg: 4, ratingCount: 1 });
    expect((await call("PUT", `/reviews/like/${reviewId}`, userToken)).statusCode).toBe(400); // propia
    expect((await call("PUT", `/reviews/like/${reviewId}`, adminToken)).json()).toMatchObject({ likesCount: 1 });
    expect((await call("PUT", `/reviews/dislike/${reviewId}`, adminToken)).json()).toMatchObject({ likesCount: 0, dislikesCount: 1 });
    expect((await call("PUT", `/reviews/dislike/${reviewId}`, adminToken)).json()).toMatchObject({ likesCount: 0, dislikesCount: 0 });
    expect((await call("GET", `/reviews/ranking/${titleId}`)).json().ranking).toBeGreaterThan(3);
    const list = (await call("GET", `/reviews/list?titleId=${titleId}`)).json();
    expect(list[0].user.email).toBeUndefined();
    expect(list[0].user.name).toBe(tag);
    expect((await call("PUT", `/reviews/${reviewId}`, adminToken, { score: 5 })).statusCode).toBe(200);
    expect((await call("GET", `/titles/${titleId}`)).json()).toMatchObject({ ratingAvg: 5 });
    expect((await call("GET", `/reviews/csv?titleId=${titleId}`, adminToken)).headers["content-type"]).toContain("text/csv");
    expect((await call("DELETE", `/reviews/${reviewId}`, adminToken)).statusCode).toBe(200);
    expect((await call("GET", `/titles/${titleId}`)).json()).toMatchObject({ ratingCount: 0, ratingAvg: 0 });
  });

  it("favoritos (watchlist y favorites), perfil, preferencias y admin", async () => {
    for (const list of ["favorites", "watchlist"]) {
      expect((await call("PUT", `/favorites/${titleId}?list=${list}`, userToken)).statusCode).toBe(200);
      expect((await call("PUT", `/favorites/${titleId}?list=${list}`, userToken)).statusCode).toBe(200); // idempotente
      const favs = (await call("GET", `/favorites?list=${list}`, userToken)).json();
      expect(favs.total).toBe(1);
      expect(favs.items[0].id).toBe(titleId);
    }
    expect((await call("GET", "/favorites/ids", userToken)).json()).toEqual({ favorites: [titleId], watchlist: [titleId] });
    expect((await call("GET", "/titles/list/collection", userToken)).json()).toHaveLength(1);
    expect((await call("DELETE", `/favorites/${titleId}?list=favorites`, userToken)).statusCode).toBe(200);
    expect((await call("GET", "/favorites?list=favorites", userToken)).json().total).toBe(0);

    const me = (await call("GET", "/me", userToken)).json();
    expect(me).not.toHaveProperty("passwordHash");
    expect(me.preferences).toMatchObject({ personalizedRecs: true });
    await call("PATCH", "/me/preferences", userToken, { marketingEmails: true, dataRetentionMonths: 6 });
    expect((await call("GET", "/me", userToken)).json().preferences).toMatchObject({
      marketingEmails: true, personalizedRecs: true, dataRetentionMonths: 6,
    });
    expect((await call("PATCH", "/me", userToken, { name: `${tag}x`, phone: null })).statusCode).toBe(200);
    expect((await call("PATCH", "/me/password", userToken, { currentPassword: "x", newPassword: "nuevo123" })).statusCode).toBe(401);
    expect((await call("GET", "/me/export", userToken)).json().favorites).toEqual([{ titleId, list: "watchlist" }]);

    expect((await call("GET", "/admin/metrics", userToken)).statusCode).toBe(403);
    expect((await call("GET", "/admin/metrics", adminToken)).json().users).toBe(2);
    expect((await call("PATCH", `/admin/users/${userId}/status`, adminToken, { banned: true })).statusCode).toBe(200);
    expect((await call("POST", "/auth/login", undefined, { email: userEmail, password: "secret123" })).statusCode).toBe(403);
    expect((await call("DELETE", `/admin/users/${userId}`, adminToken)).statusCode).toBe(200);
    expect((await call("GET", "/admin/metrics", adminToken)).json().users).toBe(1);
  });

  it("recuperación de contraseña: un solo enlace vivo, de un solo uso, y solo el hash en la BD", async () => {
    const { env } = await import("../src/libs/env.js");
    const { hashToken } = await import("../src/libs/tokens.js");
    const { PasswordResetTokenModel } = await import("../src/models/passwordResetToken.model.js");
    const { AuditLogModel } = await import("../src/models/auditLog.model.js");
    const forgot = (email: string) => call("POST", "/auth/forgot-password", undefined, { email });
    const validate = (token: string) => call("POST", "/auth/reset-password/validate", undefined, { token });
    const reset = (token: string, password: string) => call("POST", "/auth/reset-password", undefined, { token, password });
    const login = (password: string) => call("POST", "/auth/login", undefined, { email: adminEmail, password });

    const unknown = await forgot(`${tag}-nadie@test.dev`);
    const known = await forgot(adminEmail);
    expect(unknown.statusCode).toBe(200);
    expect(unknown.json()).toEqual(known.json());
    const oldToken = await nextToken(1);
    await forgot(adminEmail);
    const token = await nextToken(2);
    expect(resetLinks).toHaveLength(2); // el correo inexistente no generó enlace

    expect((await validate(oldToken)).statusCode).toBe(400); // pedir otro invalida el anterior
    expect((await validate(token)).json()).toEqual({ valid: true });
    const stored = await PasswordResetTokenModel.find({ purpose: "password_reset" }).lean();
    expect(stored).toHaveLength(1);
    expect(stored[0].hash).toBe(hashToken(token));
    expect(JSON.stringify(stored)).not.toContain(token);
    const ttlMs = stored[0].expiresAt.getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan((env.PASSWORD_RESET_TTL_MINUTES - 1) * 60_000);
    expect(ttlMs).toBeLessThanOrEqual(env.PASSWORD_RESET_TTL_MINUTES * 60_000);

    expect((await reset(token, "123")).statusCode).toBe(400); // misma regla que el registro
    expect((await reset(token, "nueva456")).statusCode).toBe(200);
    expect((await login("secret123")).statusCode).toBe(401);
    expect((await login("nueva456")).statusCode).toBe(200);
    expect((await reset(token, "otra7890")).statusCode).toBe(400);
    expect((await validate(token)).statusCode).toBe(400);
    expect(await PasswordResetTokenModel.countDocuments({ purpose: "password_reset" })).toBe(0);
    expect(await AuditLogModel.countDocuments({ action: "user.password_reset" })).toBe(1);
  });
});
