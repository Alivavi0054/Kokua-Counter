export function parseQrPayload(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const fromQuery = url.searchParams.get("token");
    if (fromQuery) return fromQuery.trim();
  } catch {
    // Scanned content is not a URL; treat it as the raw token.
  }

  if (/\s/.test(trimmed) || trimmed.length > 128) {
    return null;
  }

  return trimmed;
}
