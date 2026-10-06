export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6" role="status" aria-label="Loading">
      <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
      <div className="h-32 animate-pulse rounded bg-muted" />
      <div className="h-48 animate-pulse rounded bg-muted" />
      <span className="sr-only">Loading page content</span>
    </div>
  );
}