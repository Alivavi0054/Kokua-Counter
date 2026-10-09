import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const API_DIR = path.join(process.cwd(), "app", "api");

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return routeFiles(full);
    return entry === "route.ts" ? [full] : [];
  });
}

// Routes that are intentionally reachable without a session, with what protects them instead.
const PUBLIC_ROUTES: Record<string, string> = {
  "auth/login": "credentials + origin check + rate limit",
  "auth/dev-login": "disabled outside local development",
  "donate/checkout": "origin check + rate limit",
  "donate/webhook": "Stripe signature",
  "cron/expire-qrs": "CRON_SECRET bearer token",
  "health": "no sensitive data",
  "schools/register": "rate limit + validation",
};

function expectedRole(route: string): string | null {
  if (route.startsWith("admin/")) return "admin";
  if (route.startsWith("eatery/")) return "eatery";
  if (route === "qr/redeem") return "eatery";
  if (route.startsWith("qr/")) return "student";
  return null;
}

describe("API route permissions", () => {
  const routes = routeFiles(API_DIR).map((file) => ({
    name: path.relative(API_DIR, path.dirname(file)).split(path.sep).join("/"),
    source: readFileSync(file, "utf8"),
  }));

  it("finds the API routes", () => {
    expect(routes.length).toBeGreaterThan(15);
  });

  it("every route is either public-by-design or guarded with the right role", () => {
    for (const { name, source } of routes) {
      const role = expectedRole(name);
      if (role) {
        expect(source, `${name} must call requireApiRole("${role}")`).toContain(`requireApiRole("${role}")`);
        // A route for one role must not be satisfied by a different role's guard.
        for (const other of ["admin", "eatery", "student"].filter((r) => r !== role)) {
          expect(source, `${name} must not use requireApiRole("${other}")`).not.toContain(`requireApiRole("${other}")`);
        }
      } else {
        expect(Object.keys(PUBLIC_ROUTES), `${name} has no role guard and is not in the public allowlist`).toContain(name);
      }
    }
  });

  it("the public allowlist has no stale entries", () => {
    const names = routes.map((route) => route.name);
    for (const publicRoute of Object.keys(PUBLIC_ROUTES)) {
      expect(names).toContain(publicRoute);
    }
  });
});

describe("page permissions", () => {
  it("each role area is wrapped in a layout that requires that role", () => {
    for (const role of ["admin", "student", "eatery"]) {
      const layout = readFileSync(path.join(process.cwd(), "app", role, "layout.tsx"), "utf8");
      expect(layout).toContain(`requireRole("${role}")`);
    }
  });
});
