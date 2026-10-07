import { describe, expect, it } from "vitest";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { isAllowedRedirect, parseJsonBody, safeTimingCompare, verifyOriginMatches } from "@/lib/security";
import { detectSecretPatterns } from "@/scripts/check-secrets";

describe("security helpers", () => {
  it("accepts same-origin requests and rejects mismatched origins", () => {
    const appUrl = "https://app.example.com";
    const sameOriginRequest = new Request("https://app.example.com/api/test", {
      headers: { origin: "https://app.example.com" },
    });
    const badOriginRequest = new Request("https://app.example.com/api/test", {
      headers: { origin: "https://evil.example.com" },
    });

    expect(verifyOriginMatches(sameOriginRequest, appUrl)).toBe(true);
    expect(verifyOriginMatches(badOriginRequest, appUrl)).toBe(false);
  });

  it("accepts localhost development requests across different local ports", () => {
    const request = new Request("http://localhost:3001/api/test", {
      headers: { origin: "http://localhost:3001" },
    });

    expect(verifyOriginMatches(request, "http://localhost:3000")).toBe(true);
  });

  it("allows only relative safe redirects", () => {
    expect(isAllowedRedirect("/student")).toBe("/student");
    expect(isAllowedRedirect("https://evil.example.com")).toBeNull();
    expect(isAllowedRedirect("//evil.example.com")).toBeNull();
    expect(isAllowedRedirect("/student?next=/admin")).toBe("/student?next=/admin");
  });

  it("compares secrets with constant-time semantics", () => {
    expect(safeTimingCompare("alpha", "alpha")).toBe(true);
    expect(safeTimingCompare("alpha", "beta")).toBe(false);
    expect(safeTimingCompare("alpha", "alph")).toBe(false);
  });

  it("rate-limits by key and enforces windows", () => {
    const key = "login:test";
    expect(rateLimit(key, 2, 60_000, 1_000)).toEqual({ ok: true });
    expect(rateLimit(key, 2, 60_000, 1_001)).toEqual({ ok: true });
    expect(rateLimit(key, 2, 60_000, 1_002)).toEqual({ ok: false, retryAfterMs: 59998 });
  });

  it("rejects unknown json fields and oversized payloads", async () => {
    const schema = z.object({ name: z.string() }).strict();
    const request = new Request("https://app.example.com/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Alice", extra: true }),
    });

    const strictResult = await parseJsonBody(request, schema, 1024);
    expect(strictResult.ok).toBe(false);
    if (!strictResult.ok) {
      expect(strictResult.status).toBe(400);
    }

    const hugeRequest = new Request("https://app.example.com/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "A" }),
    });

    const largeResult = await parseJsonBody(hugeRequest, z.object({ name: z.string() }), 0);
    expect(largeResult.ok).toBe(false);
    if (!largeResult.ok) {
      expect(largeResult.status).toBe(413);
    }
  });

  it("detects common secret patterns without printing values", () => {
    const sample = "const key = 'sk_live_abc123';\nconst webhook = 'whsec_test_123';\nconst url = 'postgres://user:pass@host/db';";
    const hits = detectSecretPatterns(sample);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((hit) => hit.startsWith("sk_live") || hit.startsWith("whsec_test"))).toBe(true);
  });
});
