export interface ReviewDto {
  id: string;
  title: string;
  comment: string | null;
  score: number;
  likesCount: number;
  dislikesCount: number;
  createdAt: Date;
  titleId: string;
  userId: string;
  user: { id: string; name: string; avatarUrl: string | null };
  titleRef: { id: string; title: string };
}
