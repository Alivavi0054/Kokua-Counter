import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: getUserMock,
    },
  })),
}));

vi.mock("@/lib/env", () => ({
  getSupabasePublicEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  }),
}));

import { proxy } from "@/proxy";

describe("proxy security behavior", () => {
  beforeEach(() => {
    getUserMock.mockReset();
  });

  it("rejects cross-origin state-changing requests", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const request = new NextRequest("https://app.example.com/student", {
      method: "POST",
      headers: { origin: "https://evil.example.com" },
    });

    const response = await proxy(request);

    expect(response.status).toBe(403);
    expect(await response.text()).toContain("Cross-origin request rejected.");
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
  });

  it("redirects unauthenticated users from private routes to login", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const request = new NextRequest("https://app.example.com/student", {
      method: "POST",
      headers: { origin: "https://app.example.com" },
    });

    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/auth/login?next=%2Fstudent");
  });

  it("adds security headers to valid responses", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const request = new NextRequest("https://app.example.com/", { method: "GET" });

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Security-Policy")).toContain("script-src 'self'");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });
});
