import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FilterOption = { value: string; label: string };

/** GET form for server-side search and filtering: works without JavaScript and keeps URLs shareable. */
export function ListSearch({
  q,
  placeholder,
  filter,
  clearHref,
  searchable = true,
}: {
  q: string;
  placeholder: string;
  filter?: { name: string; value: string; allLabel: string; options: FilterOption[] };
  clearHref: string;
  /** Set false for filter-only lists (no free-text search box). */
  searchable?: boolean;
}) {
  return (
    <form method="get" className="flex flex-wrap items-center gap-3" role="search">
      {searchable ? <Input name="q" defaultValue={q} placeholder={placeholder} aria-label={placeholder} className="max-w-sm" maxLength={60} /> : null}
      {filter ? (
        <select
          name={filter.name}
          defaultValue={filter.value}
          aria-label={filter.allLabel}
          className="h-11 rounded-lg border border-input bg-card px-3 text-sm shadow-sm"
        >
          <option value="">{filter.allLabel}</option>
          {filter.options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ) : null}
      <Button type="submit" variant="secondary">{searchable ? "Search" : "Apply"}</Button>
      {q || filter?.value ? (
        <Button asChild variant="ghost"><Link href={clearHref}>Clear</Link></Button>
      ) : null}
    </form>
  );
}

export function Pagination({
  basePath,
  page,
  pages,
  total,
  params = {},
}: {
  basePath: string;
  page: number;
  pages: number;
  total: number;
  params?: Record<string, string>;
}) {
  const href = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
    if (target > 1) search.set("page", String(target));
    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
  };
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <p>
        Page {Math.min(page, pages)} of {pages} · {total} {total === 1 ? "result" : "results"}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm"><Link href={href(page - 1)} rel="prev">Previous</Link></Button>
        ) : (
          <Button variant="outline" size="sm" disabled>Previous</Button>
        )}
        {page < pages ? (
          <Button asChild variant="outline" size="sm"><Link href={href(page + 1)} rel="next">Next</Link></Button>
        ) : (
          <Button variant="outline" size="sm" disabled>Next</Button>
        )}
      </div>
    </nav>
  );
}
