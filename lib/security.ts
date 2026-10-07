import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const MAX_JSON_BODY_BYTES = 1_000_000;

export function isAllowedRedirect(value: string | null | undefined): string | null {
  if (!value) return "/";

  const candidate = value.trim();
  if (!candidate || candidate.startsWith("//") || candidate.startsWith("\\")) {
    return null;
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) {
    return null;
  }

  if (!candidate.startsWith("/")) {
    return null;
  }

  const normalized = candidate.replace(/\/+/g, "/");
  if (normalized.includes("..")) {
    return null;
  }

  return normalized || "/";
}

export function verifyOriginMatches(request: Request, appUrl: string): boolean {
  const originHeader = request.headers.get("origin");
  const refererHeader = request.headers.get("referer");
  const expected = new URL(appUrl).origin;

  const actual = originHeader ?? (refererHeader ? new URL(refererHeader).origin : null);
  return Boolean(actual && actual === expected);
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
