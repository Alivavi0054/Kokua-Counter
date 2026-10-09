import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";

export const MAX_JSON_BODY_BYTES = 1_000_000;

export function isAllowedRedirect(value: string | null | undefined): string | null {
  if (!value) return "/";

  const candidate = value.trim();
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return null;
  }

  // Browsers treat "\" like "/" and silently drop tabs/newlines inside URLs, so
  // "/\evil.com" or "/\t/evil.com" would become "//evil.com". Reject them outright,
  // including percent-encoded forms.
  if (/[\\\u0000-\u001f\u007f]/.test(candidate) || /%5c|%09|%0a|%0d|%00/i.test(candidate)) {
    return null;
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) {
    return null;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(candidate);
  } catch {
    return null;
  }
  if (decoded.startsWith("//") || decoded.includes("\\") || decoded.includes("..")) {
    return null;
  }

  const normalized = candidate.replace(/\/+/g, "/");
  if (normalized.includes("..")) {
    return null;
  }

  return normalized || "/";
}

function validIp(value: string | null | undefined): string | null {
  const candidate = value?.trim();
  return candidate && isIP(candidate) ? candidate : null;
}

/**
 * Best-effort client IP for rate limiting. Prefers headers the hosting platform sets
 * itself (x-vercel-forwarded-for, x-real-ip). If only x-forwarded-for is present we use its
 * LAST entry (appended by the nearest proxy); the first entry is client-controlled and
 * must not be trusted. Falls back to "local" when no valid IP is available.
 */
export function getClientIp(request: Request): string {
  const headers = request.headers;
  const platformIp = validIp(headers.get("x-vercel-forwarded-for")?.split(",")[0]) ?? validIp(headers.get("x-real-ip"));
  if (platformIp) return platformIp;

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",");
    const nearestProxyIp = validIp(parts[parts.length - 1]);
    if (nearestProxyIp) return nearestProxyIp;
  }

  return "local";
}

export function verifyOriginMatches(request: Request, appUrl: string): boolean {
  const originHeader = request.headers.get("origin");
  const refererHeader = request.headers.get("referer");
  const expected = new URL(appUrl);
  const actualOrigin = originHeader ?? (refererHeader ? new URL(refererHeader).origin : null);

  if (!actualOrigin) {
    return false;
  }

  const actual = new URL(actualOrigin);
  if (actual.origin === expected.origin) {
    return true;
  }

  const localhostHostnames = new Set(["localhost", "127.0.0.1", "::1"]);
  if (
    localhostHostnames.has(actual.hostname) &&
    localhostHostnames.has(expected.hostname)
  ) {
    return true;
  }

  return false;
}

export function safeTimingCompare(supplied: string | undefined, expected: string | undefined): boolean {
  if (typeof supplied !== "string" || typeof expected !== "string") {
    return false;
  }

  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodSchema<T>,
  maxBytes = MAX_JSON_BODY_BYTES,
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return { ok: false, status: 415, error: "Unsupported media type." };
  }

  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    return { ok: false, status: 413, error: "Request body is too large." };
  }

  if (!text.trim()) {
    return { ok: false, status: 400, error: "Invalid request." };
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, status: 400, error: "Invalid request." };
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Invalid request." };
  }

  return { ok: true, data: parsed.data };
}
