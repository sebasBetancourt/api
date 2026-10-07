import { beforeAll, describe, expect, it } from "vitest";

process.env.MONGODB_URI = "mongodb://localhost:27017";
process.env.JWT_SECRET = "test-secret-123";
process.env.NODE_ENV = "test";

let app: Awaited<ReturnType<typeof import("../src/app.js").buildApp>>;
beforeAll(async () => {
  app = await (await import("../src/app.js")).buildApp();
});

describe("seguridad de rutas", () => {
  it("/health responde ok", async () => {
    expect((await app.inject("/health")).statusCode).toBe(200);
  });
  it.each([
    ["POST", "/api/v1/categories/create"],
    ["DELETE", "/api/v1/categories/00000000-0000-4000-8000-000000000000"],
    ["DELETE", "/api/v1/reviews/00000000-0000-4000-8000-000000000000"],
    ["POST", "/api/v1/titles/create"],
    ["GET", "/api/v1/reviews/csv"],
  ])("%s %s exige token", async (method, url) => {
    const res = await app.inject({ method: method as "GET", url });
    expect(res.statusCode).toBe(401);
  });
  it("login con body inválido da 400", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: "x" } });
    expect(res.statusCode).toBe(400);
  });
  it.each([
    ["/api/v1/auth/reset-password/validate", { token: "corto" }],
    ["/api/v1/auth/reset-password", { token: "a".repeat(43), password: "123" }],
    ["/api/v1/auth/reset-password", { password: "secret123" }],
  ])("POST %s con body inválido da 400", async (url, payload) => {
    expect((await app.inject({ method: "POST", url, payload })).statusCode).toBe(400);
  });
  it("forgot-password: body inválido da 400 y la 6.ª petición en la ventana da 429", async () => {
    const ask = () => app.inject({ method: "POST", url: "/api/v1/auth/forgot-password", payload: { email: "no-es-correo" } });
    for (let i = 0; i < 5; i++) expect((await ask()).statusCode).toBe(400);
    const limited = await ask();
    expect(limited.statusCode).toBe(429);
    expect(limited.json().message).toMatch(/Demasiadas solicitudes/);
    // El límite es por ruta: login sigue respondiendo con normalidad.
    expect((await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: "x" } })).statusCode).toBe(400);
  });
  it("un usuario normal no puede crear categorías (403)", async () => {
    const token = app.jwt.sign({ id: "u", email: "a@b.c", role: "user" });
    const res = await app.inject({
      method: "POST", url: "/api/v1/categories/create",
      headers: { authorization: `Bearer ${token}` }, payload: { name: "Drama" },
    });
    expect(res.statusCode).toBe(403);
  });
});
