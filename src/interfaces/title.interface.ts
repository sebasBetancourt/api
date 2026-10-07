export type TitleType = "movie" | "tv" | "anime";
export type TitleStatus = "pending" | "approved" | "rejected";

export interface TitleDto {
  id: string;
  type: TitleType;
  title: string;
  description: string;
  author: string | null;
  year: number | null;
  seasons: number | null;
  episodes: number | null;
  posterUrl: string | null;
  images: string[];
  status: TitleStatus;
  tmdbId: number | null;
  imdbId: string | null;
  embedUrl: string | null;
  ratingAvg: number;
  ratingCount: number;
  likes: number;
  dislikes: number;
  createdById: string | null;
  createdAt: Date;
  categories: { id: string; name: string }[];
  creator: string | null;
}
