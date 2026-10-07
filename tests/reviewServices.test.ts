import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/repositories/review.repository.js", () => ({
  reviewRepository: { findById: vi.fn(), delete: vi.fn(), react: vi.fn(), update: vi.fn() },
}));
vi.mock("../src/repositories/title.repository.js", () => ({ titleRepository: { exists: vi.fn() } }));

import { reviewRepository } from "../src/repositories/review.repository.js";
import { deleteReviewService, reactToReviewService } from "../src/services/reviews/reviewServices.js";

const review = { id: "r1", userId: "owner", titleId: "t1" };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(reviewRepository.findById).mockResolvedValue(review as never);
});

describe("reviewServices", () => {
  it("un usuario ajeno no puede borrar la reseña (403)", async () => {
    await expect(deleteReviewService("r1", { id: "other", role: "user" })).rejects.toMatchObject({ statusCode: 403 });
    expect(reviewRepository.delete).not.toHaveBeenCalled();
  });
  it("el admin sí puede borrarla", async () => {
    await deleteReviewService("r1", { id: "adm", role: "admin" });
    expect(reviewRepository.delete).toHaveBeenCalledWith("r1", "t1");
  });
  it("no se puede reaccionar a la propia reseña (400)", async () => {
    await expect(reactToReviewService("r1", "like", "owner")).rejects.toMatchObject({ statusCode: 400 });
  });
  it("reacciona a una reseña ajena", async () => {
    await reactToReviewService("r1", "like", "other");
    expect(reviewRepository.react).toHaveBeenCalledWith("r1", "other", "like");
  });
});
