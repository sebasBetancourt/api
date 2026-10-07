import { describe, expect, it } from "vitest";
import { CATEGORY_RENAMES, foldName, genresToCategoryNames, planRenames } from "../scripts/lib/categoryData.js";

describe("foldName", () => {
  it("ignora tildes, mayúsculas y espacios", () => {
    expect(foldName(" Ciencia Ficcion")).toBe(foldName("Ciencia ficción"));
    expect(foldName("Música")).not.toBe(foldName("Musical"));
  });
});

describe("planRenames", () => {
  it("solo renombra las que lo necesitan y es idempotente", () => {
    const cats = [
      { _id: 1, name: "Accion" },
      { _id: 2, name: "Drama" },
      { _id: 3, name: "Talk Show" },
    ];
    const { renames, conflicts } = planRenames(cats);
    expect(renames).toEqual([
      { id: 1, from: "Accion", to: "Acción" },
      { id: 3, from: "Talk Show", to: "Talk show" },
    ]);
    expect(conflicts).toEqual([]);

    const after = cats.map((c) => ({ ...c, name: CATEGORY_RENAMES[c.name] ?? c.name }));
    expect(planRenames(after).renames).toEqual([]);
  });

  it("no pisa una categoría que ya tiene el nombre correcto", () => {
    const { renames, conflicts } = planRenames([
      { _id: 1, name: "Fantasia" },
      { _id: 2, name: "Fantasía" },
    ]);
    expect(renames).toEqual([]);
    expect(conflicts).toEqual([{ id: 1, from: "Fantasia", to: "Fantasía" }]);
  });
});

describe("genresToCategoryNames", () => {
  it("traduce géneros de película e ignora los que no tienen equivalente", () => {
    expect(genresToCategoryNames("movie", [28, 18, 10770])).toEqual(["Acción", "Drama"]);
  });
  it("desdobla los géneros combinados de series sin repetir", () => {
    expect(genresToCategoryNames("tv", [10759, 10765, 10751, 10762, 10763])).toEqual([
      "Acción",
      "Aventura",
      "Ciencia ficción",
      "Fantasía",
      "Familiar",
    ]);
  });
});
