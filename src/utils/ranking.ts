export interface RankingReview {
  score: number;
  likesCount: number;
  dislikesCount: number;
  createdAt: Date;
}

const DAY_MS = 1000 * 60 * 60 * 24;

/** Promedio de scores con decaimiento por antigüedad (mín. 0.5) y ajuste por likes netos. */
export function calculateRanking(reviews: RankingReview[], now = new Date()): number {
  if (reviews.length === 0) return 0;
  const total = reviews.reduce((acc, r) => {
    const ageInDays = (now.getTime() - r.createdAt.getTime()) / DAY_MS;
    const decay = Math.max(0.5, 1 - ageInDays / 365);
    const interaction = 1 + (r.likesCount - r.dislikesCount) * 0.01;
    return acc + r.score * decay * interaction;
  }, 0);
  return total / reviews.length;
}
