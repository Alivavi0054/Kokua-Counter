import { beforeEach, describe, expect, it, vi } from "vitest";

type Profile = { id?: string; role: string; display_name?: string; is_active: boolean } | null;
type FakeUser = { id: string; email: string; email_confirmed_at: string | null } | null;

const state = vi.hoisted(() => ({
  user: null as FakeUser,
  profile: null as Profile,
  signInError: null as unknown,
  signOut: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user } }),
      signInWithPassword: async () => ({ error: state.signInError }),
      signOut: state.signOut,
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: state.profile }) }),
      }),
    }),
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { loadUser, requireApiRole, requireRole } from "@/lib/auth/guards";
import { roleHome } from "@/lib/auth/roles";
import { POST as login } from "@/app/api/auth/login/route";

const CONFIRMED = "2026-10-01T00:00:00Z";

function signedIn(role: string, opts: { active?: boolean; confirmed?: boolean; email?: string } = {}) {
  state.user = {
    id: "user-1",
    email: opts.email ?? "person@example.com",
    email_confirmed_at: opts.confirmed === false ? null : CONFIRMED,
  };
  state.profile = { role, display_name: "Person", is_active: opts.active ?? true };
}

beforeEach(() => {
  state.user = null;
  state.profile = null;
  state.signInError = null;
  state.signOut.mockReset();
  vi.stubEnv("APP_URL", "https://app.example.com");
});

describe("roleHome", () => {
  it("maps each role to its dashboard and everything else to /", () => {
    expect(roleHome("student")).toBe("/student");
    expect(roleHome("eatery")).toBe("/eatery");
    expect(roleHome("admin")).toBe("/admin");
    expect(roleHome("owner")).toBe("/");
    expect(roleHome(null)).toBe("/");
  });
});

describe("loadUser", () => {
  it("returns null when signed out, without a profile, inactive, or with an unknown role", async () => {
    expect(await loadUser()).toBeNull();

    signedIn("admin");
    state.profile = null;
    expect(await loadUser()).toBeNull();

    signedIn("admin", { active: false });
    expect(await loadUser()).toBeNull();

    signedIn("superuser");
    expect(await loadUser()).toBeNull();
  });

  it("requires a confirmed email for students only", async () => {
    signedIn("student", { confirmed: false });
    expect(await loadUser()).toBeNull();

    signedIn("eatery", { confirmed: false });
    expect(await loadUser()).toMatchObject({ role: "eatery" });
  });
});

describe("requireApiRole", () => {
  it("returns 401 when signed out", async () => {
    const result = await requireApiRole("admin");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("returns 403 for the wrong role and ok for the right one", async () => {
    signedIn("student", { email: "s@hawaii.edu" });
    const denied = await requireApiRole("admin");
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.response.status).toBe(403);

    const allowed = await requireApiRole("student");
    expect(allowed.ok).toBe(true);
  });

  it("denies an admin that has been deactivated", async () => {
    signedIn("admin", { active: false });
    const result = await requireApiRole("admin");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });
});

describe("requireRole (pages)", () => {
  it("sends signed-out users to the login page", async () => {
    await expect(requireRole("admin")).rejects.toThrow("REDIRECT:/auth/login");
  });

  it("sends users with the wrong role to their own dashboard", async () => {
    signedIn("student", { email: "s@hawaii.edu" });
    await expect(requireRole("admin")).rejects.toThrow("REDIRECT:/student");

    signedIn("eatery");
    await expect(requireRole("student")).rejects.toThrow("REDIRECT:/eatery");

    signedIn("admin");
    await expect(requireRole("eatery")).rejects.toThrow("REDIRECT:/admin");
  });

  it("lets the matching role through", async () => {
    signedIn("admin");
    await expect(requireRole("admin")).resolves.toMatchObject({ role: "admin" });
  });
});

let ip = 0;
function loginRequest(body: Record<string, unknown>) {
  ip += 1;
  return new Request("https://app.example.com/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://app.example.com",
      "x-real-ip": `198.51.100.${ip}`,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login", () => {
  it("rejects requests from another origin", async () => {
    const request = new Request("https://app.example.com/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example.com" },
      body: JSON.stringify({ email: "a@b.com", password: "x" }),
    });
    expect((await login(request)).status).toBe(403);
  });

  it("returns a generic error for bad credentials", async () => {
    state.signInError = new Error("Invalid login credentials");
    const response = await login(loginRequest({ email: "a@example.com", password: "wrong" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Could not sign in." });
  });

  it("sends each role to its own dashboard", async () => {
    for (const [role, email, expected] of [
      ["admin", "admin@example.com", "/admin"],
      ["eatery", "eatery@example.com", "/eatery"],
      ["student", "student@hawaii.edu", "/student"],
    ] as const) {
      signedIn(role, { email });
      const response = await login(loginRequest({ email, password: "correct" }));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ redirect: expected });
    }
  });

  it("honors a safe next path but ignores unsafe ones", async () => {
    signedIn("student", { email: "student@hawaii.edu" });
    const safe = await login(loginRequest({ email: "student@hawaii.edu", password: "p", next: "/student/history" }));
    expect(await safe.json()).toEqual({ redirect: "/student/history" });

    for (const next of ["//evil.com", "/\\evil.com", "https://evil.com"]) {
      const response = await login(loginRequest({ email: "student@hawaii.edu", password: "p", next }));
      expect(await response.json()).toEqual({ redirect: "/student" });
    }
  });

  it("blocks students without a hawaii.edu email or without a confirmed email, and signs them out", async () => {
    signedIn("student", { email: "student@gmail.com" });
    const wrongDomain = await login(loginRequest({ email: "student@gmail.com", password: "p" }));
    expect(wrongDomain.status).toBe(403);
    expect(state.signOut).toHaveBeenCalledTimes(1);

    signedIn("student", { email: "student@hawaii.edu", confirmed: false });
    const unconfirmed = await login(loginRequest({ email: "student@hawaii.edu", password: "p" }));
    expect(unconfirmed.status).toBe(403);
    expect(state.signOut).toHaveBeenCalledTimes(2);
  });

  it("blocks deactivated accounts and accounts without a profile, and signs them out", async () => {
    signedIn("eatery", { active: false });
    const inactive = await login(loginRequest({ email: "person@example.com", password: "p" }));
    expect(inactive.status).toBe(403);
    expect((await inactive.json()).error).toMatch(/deactivated/);

    signedIn("admin");
    state.profile = null;
    const noProfile = await login(loginRequest({ email: "person@example.com", password: "p" }));
    expect(noProfile.status).toBe(403);
    expect(state.signOut).toHaveBeenCalledTimes(2);
  });
});
