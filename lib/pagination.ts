export const PAGE_SIZE = 25;
const MAX_PAGE = 10_000;

export type ListParams = { page: number; q: string };

/**
 * Search text is interpolated into PostgREST filters (ilike / or), where characters such as
 * `% _ , ( ) \ *` change the meaning of the filter. Keep letters, digits, spaces and a few harmless
 * punctuation marks, drop everything else, and cap the length.
 */
export function sanitizeSearch(input: string | undefined | null): string {
  return (input ?? "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N} .@'+-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export function parseListParams(searchParams: { page?: string; q?: string }): ListParams {
  const raw = Number.parseInt(searchParams.page ?? "1", 10);
  const page = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), MAX_PAGE) : 1;
  return { page, q: sanitizeSearch(searchParams.q) };
}

/** Inclusive row range for PostgREST `.range(from, to)`. */
export function pageRange(page: number, pageSize: number = PAGE_SIZE): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function totalPages(total: number, pageSize: number = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Builds a PostgREST `or` filter matching the search text in any of the given columns. */
export function orIlike(columns: string[], q: string): string {
  return columns.map((column) => `${column}.ilike.%${q}%`).join(",");
}
