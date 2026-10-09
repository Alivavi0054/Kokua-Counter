// Permission checks against a running Kōkua Counter server whose Supabase URL points at
// ./mock-supabase.mjs. Started by scripts/e2e/run-permissions.mjs; no real Supabase or Stripe.
import { startMock } from "./mock-supabase.mjs";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3999";
const MOCK_PORT = Number(process.env.E2E_MOCK_PORT ?? 54399);
const mock = await startMock(MOCK_PORT);
let ipn = 0;
let failures = 0;
const results = [];

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + detail}`);
}

async function req(path, { method = "GET", cookie = "", json, headers = {} } = {}) {
  ipn += 1;
  const res = await fetch(BASE + path, {
    method,
    redirect: "manual",
    headers: {
      "x-real-ip": `203.0.113.${ipn}`,
      ...(cookie ? { cookie } : {}),
      ...(method !== "GET" ? { origin: BASE } : {}),
      ...(json ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: json ? JSON.stringify(json) : undefined,
  });
  const text = await res.text();
  const setCookies = res.headers.getSetCookie?.() ?? [];
  return { status: res.status, location: res.headers.get("location"), text, setCookies, headers: res.headers };
}

function jarFrom(setCookies) {
  const jar = new Map();
  for (const line of setCookies) {
    const [pair] = line.split(";");
    const idx = pair.indexOf("=");
    const name = pair.slice(0, idx);
    const value = pair.slice(idx + 1);
    if (/max-age=0|expires=thu, 01 jan 1970/i.test(line) || value === "") jar.delete(name);
    else jar.set(name, value);
  }
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function login(email, password = "pw", next) {
  const r = await req("/api/auth/login", { method: "POST", json: { email, password, ...(next ? { next } : {}) } });
  let body = {};
  try { body = JSON.parse(r.text); } catch {}
  return { ...r, body, cookie: jarFrom(r.setCookies) };
}

const path = (loc) => (loc ? new URL(loc, BASE).pathname + new URL(loc, BASE).search : null);

// ---- 1. anonymous access
for (const p of ["/student", "/student/history", "/eatery", "/eatery/scan", "/admin", "/admin/users"]) {
  const r = await req(p);
  check(`anon GET ${p} redirects to login`, r.status === 307 && path(r.location).startsWith("/auth/login"), `${r.status} ${r.location}`);
}
for (const [p, method] of [["/api/admin/users", "POST"], ["/api/qr/generate", "POST"], ["/api/qr/redeem", "POST"], ["/api/eatery/connect/onboard", "POST"], ["/api/admin/organizations/export", "GET"]]) {
  const r = await req(p, { method, json: method === "POST" ? {} : undefined });
  check(`anon ${method} ${p} is 401`, r.status === 401, String(r.status));
}
check("cross-origin POST is rejected by the proxy", (await req("/api/auth/login", { method: "POST", json: { email: "a@b.co", password: "x" }, headers: { origin: "https://evil.example.com" } })).status === 403);

// ---- 2. login outcomes
const sessions = {};
for (const [email, expectedStatus, expectedRedirect] of [
  ["admin@example.com", 200, "/admin"],
  ["eatery@example.com", 200, "/eatery"],
  ["student@hawaii.edu", 200, "/student"],
  ["outsider@gmail.com", 403, null],
  ["inactive@example.com", 403, null],
  ["unconfirmed@hawaii.edu", 403, null],
  ["noprofile@example.com", 403, null],
]) {
  const r = await login(email);
  check(`login ${email} -> ${expectedStatus}${expectedRedirect ? " " + expectedRedirect : ""}`, r.status === expectedStatus && (!expectedRedirect || r.body.redirect === expectedRedirect), `${r.status} ${r.text}`);
  if (r.status === 200) sessions[email] = r.cookie;
}
check("wrong password -> generic 400", (await login("admin@example.com", "nope")).status === 400);
check("open-redirect next is ignored", (await login("student@hawaii.edu", "pw", "/\\evil.com")).body.redirect === "/student");
check("safe next is honored", (await login("student@hawaii.edu", "pw", "/student/history")).body.redirect === "/student/history");

// ---- 3. role x area matrix (pages)
const roles = { admin: sessions["admin@example.com"], eatery: sessions["eatery@example.com"], student: sessions["student@hawaii.edu"] };
const home = { admin: "/admin", eatery: "/eatery", student: "/student" };
const areas = { admin: ["/admin", "/admin/finance", "/admin/users", "/admin/eateries", "/admin/organizations", "/admin/registrations"], eatery: ["/eatery", "/eatery/scan"], student: ["/student", "/student/history", "/student/meal"] };
for (const [role, cookie] of Object.entries(roles)) {
  for (const [areaRole, pages] of Object.entries(areas)) {
    for (const p of pages) {
      const r = await req(p, { cookie });
      if (areaRole === role) check(`${role} can open ${p}`, r.status === 200, `${r.status} ${r.location ?? ""}`);
      else check(`${role} is bounced from ${p} to ${home[role]}`, r.status === 307 && path(r.location) === home[role], `${r.status} ${r.location}`);
    }
  }
  const lp = await req("/auth/login", { cookie });
  check(`${role} visiting /auth/login is sent to ${home[role]}`, lp.status === 307 && path(lp.location) === home[role], `${lp.status} ${lp.location}`);
}

// ---- 4. role x API matrix
const apiCases = [
  ["POST", "/api/admin/users", "admin"],
  ["POST", "/api/admin/eateries", "admin"],
  ["POST", "/api/admin/organizations", "admin"],
  ["GET", "/api/admin/organizations/export", "admin"],
  ["GET", "/api/admin/registrations/export", "admin"],
  ["GET", "/api/admin/fee-settings", "admin"],
  ["POST", "/api/admin/fee-settings", "admin"],
  ["POST", "/api/admin/contributions/22222222-2222-4222-8222-222222222222/refund", "admin"],
  ["POST", "/api/admin/refunds/22222222-2222-4222-8222-222222222222/reconcile", "admin", { denyOnly: true }],
  // Deny-only: letting an admin through would call the real Stripe API.
  ["POST", "/api/admin/finance/reconcile", "admin", { denyOnly: true }],
  ["POST", "/api/qr/generate", "student"],
  ["GET", "/api/qr/status?id=00000000-0000-4000-8000-000000000000", "student"],
  ["POST", "/api/qr/redeem", "eatery"],
  // Deny-only: letting an eatery through would make the app call the real Stripe API.
  ["POST", "/api/eatery/connect/onboard", "eatery", { denyOnly: true }],
];
for (const [method, p, owner, options] of apiCases) {
  for (const [role, cookie] of Object.entries(roles)) {
    if (role === owner && options?.denyOnly) continue;
    const r = await req(p, { method, cookie, json: method === "POST" ? {} : undefined });
    if (role === owner) check(`${role} ${method} ${p} is allowed through the guard`, r.status !== 401 && r.status !== 403, String(r.status));
    else check(`${role} ${method} ${p} is 403`, r.status === 403, String(r.status));
  }
}

// ---- 5. sign out and deactivation
const out = await req("/auth/signout", { method: "POST", cookie: roles.admin });
check("sign out redirects home", out.status === 302 || out.status === 307 || out.status === 303, String(out.status));

console.log(`\n${results.length - failures}/${results.length} checks passed`);
mock.close();
process.exit(failures ? 1 : 0);
