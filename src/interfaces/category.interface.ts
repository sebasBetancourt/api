export interface CategoryDto {
  id: string;
  name: string;
  createdAt: Date;
}

/** Categoría con títulos aprobados: cuántos tiene y el póster del mejor valorado. */
export interface CategorySummaryDto {
  id: string;
  name: string;
  count: number;
  posterUrl: string | null;
}
