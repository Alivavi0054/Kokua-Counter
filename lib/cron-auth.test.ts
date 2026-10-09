import { beforeEach, describe, expect, it, vi } from "vitest";
import { authorizeCron } from "@/lib/cron-auth";

const req = (authorization?: string) => new Request("https://app.example.com/api/cron/x", { headers: authorization ? { authorization } : {} });

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("CRON_SECRET", "s3cret-value-for-tests");
});

describe("authorizeCron", () => {
  it("accepts only the exact bearer token", () => {
    expect(authorizeCron(req("Bearer s3cret-value-for-tests")).ok).toBe(true);
    for (const header of [undefined, "", "Bearer ", "Bearer wrong", "s3cret-value-for-tests", "bearer s3cret-value-for-tests"]) {
      const result = authorizeCron(req(header));
      expect(result.ok, String(header)).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(401);
    }
  });

  it("rejects everything (and says nothing about why) when no secret is configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const result = authorizeCron(req("Bearer anything"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(await result.response.json()).toEqual({ error: "Unauthorized." });
  });
});
