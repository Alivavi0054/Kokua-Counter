/** Small Kōkua Counter mark: a bowl with a leaf, matching app/icon.svg's palette. */
export function BrandMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="hsl(153 40% 17%)" />
      <path d="M7 15h18a9 9 0 0 1-18 0Z" fill="hsl(48 38% 97%)" />
      <path d="M16 13c0-4 2.2-6.2 6-6.5-.1 3.8-2.1 6.1-6 6.5Z" fill="hsl(12 56% 52%)" />
      <path d="M16 13c-3.5-.2-5.4-2-5.7-5 3.3.2 5.3 1.9 5.7 5Z" fill="hsl(150 45% 55%)" />
    </svg>
  );
}
