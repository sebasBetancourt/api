import { describe, expect, it } from "vitest";
import { calculateRanking } from "../src/utils/ranking.js";

const now = new Date("2026-01-01T00:00:00Z");
const r = (score: number, days: number, likes = 0, dislikes = 0) => ({
  score, likesCount: likes, dislikesCount: dislikes,
  createdAt: new Date(now.getTime() - days * 86_400_000),
});

describe("calculateRanking", () => {
  it("devuelve 0 sin reseñas", () => expect(calculateRanking([], now)).toBe(0));
  it("no decae una reseña de hoy", () => expect(calculateRanking([r(4, 0)], now)).toBe(4));
  it("el decaimiento tiene piso de 0.5", () => expect(calculateRanking([r(4, 3650)], now)).toBe(2));
  it("los likes netos suben el valor", () => {
    expect(calculateRanking([r(4, 0, 10, 0)], now)).toBeCloseTo(4.4);
  });
});
