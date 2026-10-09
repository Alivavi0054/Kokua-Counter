import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.fn();
let profile: { role: string; is_active: boolean } | null = null;

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: getUserMock,
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }),
    }),
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
    profile = null;
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

  it("sends a signed-in user with the wrong role straight to their own dashboard (307)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });

    profile = { role: "student", is_active: true };
    const toStudent = await proxy(new NextRequest("https://app.example.com/admin/users", { method: "GET" }));
    expect(toStudent.status).toBe(307);
    expect(new URL(toStudent.headers.get("location") ?? "").pathname).toBe("/student");

    profile = { role: "eatery", is_active: true };
    const toEatery = await proxy(new NextRequest("https://app.example.com/student/history", { method: "GET" }));
    expect(new URL(toEatery.headers.get("location") ?? "").pathname).toBe("/eatery");

    profile = { role: "admin", is_active: true };
    const toAdmin = await proxy(new NextRequest("https://app.example.com/eatery/scan", { method: "GET" }));
    expect(new URL(toAdmin.headers.get("location") ?? "").pathname).toBe("/admin");
  });

  it("lets the matching role through and leaves inactive accounts to the page guards", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });

    profile = { role: "admin", is_active: true };
    expect((await proxy(new NextRequest("https://app.example.com/admin", { method: "GET" }))).status).toBe(200);

    profile = { role: "admin", is_active: false };
    expect((await proxy(new NextRequest("https://app.example.com/admin", { method: "GET" }))).status).toBe(200);
  });

  it("skips the login form for signed-in users, honoring only safe next paths", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    profile = { role: "student", is_active: true };

    const home = await proxy(new NextRequest("https://app.example.com/auth/login", { method: "GET" }));
    expect(new URL(home.headers.get("location") ?? "").pathname).toBe("/student");

    const safe = await proxy(new NextRequest("https://app.example.com/auth/login?next=/student/history", { method: "GET" }));
    expect(new URL(safe.headers.get("location") ?? "").pathname).toBe("/student/history");

    const evil = await proxy(new NextRequest("https://app.example.com/auth/login?next=//evil.com", { method: "GET" }));
    expect(new URL(evil.headers.get("location") ?? "").host).toBe("app.example.com");
    expect(new URL(evil.headers.get("location") ?? "").pathname).toBe("/student");
  });
});
