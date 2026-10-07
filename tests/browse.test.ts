import { describe, expect, it, vi } from "vitest";

vi.mock("../src/repositories/category.repository.js", () => ({ categoryRepository: { summary: vi.fn() } }));

import { categoryRepository } from "../src/repositories/category.repository.js";
import { listSort } from "../src/repositories/title.repository.js";
import { getCategorySummaryService } from "../src/services/categories/categoryServices.js";

describe("listSort", () => {
  it("sin sort conserva el orden natural del Home", () => {
    expect(listSort()).toEqual({ _id: 1 });
  });
  it.each(["popular", "rating", "recent"] as const)("%s termina en _id para paginar sin duplicados", (sort) => {
    const keys = Object.keys(listSort(sort));
    expect(keys.at(-1)).toBe("_id");
    expect(keys.length).toBeGreaterThan(1);
  });
  it("cada orden prioriza su campo", () => {
    expect(Object.keys(listSort("popular"))[0]).toBe("likes");
    expect(Object.keys(listSort("rating"))[0]).toBe("ratingAvg");
    expect(listSort("recent")).toMatchObject({ createdAt: -1 });
  });
});

describe("getCategorySummaryService", () => {
  it("pide el resumen del tipo indicado (o de todos)", async () => {
    vi.mocked(categoryRepository.summary).mockResolvedValue([{ id: "c", name: "Drama", count: 2, posterUrl: null }]);
    await expect(getCategorySummaryService("tv")).resolves.toHaveLength(1);
    expect(categoryRepository.summary).toHaveBeenLastCalledWith("tv");
    await getCategorySummaryService();
    expect(categoryRepository.summary).toHaveBeenLastCalledWith(undefined);
  });
});
