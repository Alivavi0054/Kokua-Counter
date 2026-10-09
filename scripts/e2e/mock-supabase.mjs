// Minimal in-memory stand-in for Supabase Auth + PostgREST, for local end-to-end checks only.
import http from "node:http";

export const accounts = {
  "admin@example.com": { id: "11111111-1111-4111-8111-111111111111", role: "admin", name: "Program Admin", active: true, confirmed: true },
  "eatery@example.com": { id: "22222222-2222-4222-8222-222222222222", role: "eatery", name: "Kai's Poi Shack", active: true, confirmed: true },
  "student@hawaii.edu": { id: "33333333-3333-4333-8333-333333333333", role: "student", name: "Student 4821", active: true, confirmed: true },
  "outsider@gmail.com": { id: "44444444-4444-4444-8444-444444444444", role: "student", name: "Outsider", active: true, confirmed: true },
  "inactive@example.com": { id: "55555555-5555-4555-8555-555555555555", role: "eatery", name: "Inactive", active: false, confirmed: true },
  "unconfirmed@hawaii.edu": { id: "66666666-6666-4666-8666-666666666666", role: "student", name: "New Student", active: true, confirmed: false },
  "noprofile@example.com": { id: "77777777-7777-4777-8777-777777777777", role: null, name: null, active: true, confirmed: true },
};
const byId = Object.fromEntries(Object.entries(accounts).map(([email, a]) => [a.id, { ...a, email }]));
const userJson = (a) => ({ id: a.id, aud: "authenticated", role: "authenticated", email: a.email, email_confirmed_at: a.confirmed ? "2026-10-01T00:00:00Z" : null, app_metadata: {}, user_metadata: {}, created_at: "2026-10-01T00:00:00Z" });
const sampleUsers = Object.values(byId).filter((a) => a.role).map((a) => ({ id: a.id, role: a.role, display_name: a.name, is_active: a.active, created_at: "2026-10-02T10:00:00Z" }));

function rows(table, url) {
  const q = url.searchParams;
  if (table === "users") {
    const id = (q.get("id") || "").replace("eq.", "");
    if (id) { const a = byId[id]; return a && a.role ? [{ id, role: a.role, display_name: a.name, is_active: a.active }] : []; }
    return sampleUsers;
  }
  if (table === "eateries") {
    const owner = (q.get("owner_user_id") || "").replace("eq.", "");
    const eatery = { id: "e1", name: "Kai's Poi Shack", slug: "kais-poi-shack", island: "Oʻahu", address: "123 Kapiʻolani Blvd", contact_email: "eatery@example.com", is_active: true, stripe_connect_account_id: null, created_at: "2026-10-02T10:00:00Z" };
    if (owner) return owner === accounts["eatery@example.com"].id ? [eatery] : [];
    return [eatery, { ...eatery, id: "e2", name: "Aloha Plate Lunch", island: "Maui", stripe_connect_account_id: "acct_test_123" }];
  }
  if (table === "public_eateries") return [{ name: "Kai's Poi Shack", slug: "kais-poi-shack", island: "Oʻahu", address: "123 Kapiʻolani Blvd" }, { name: "Aloha Plate Lunch", slug: "aloha-plate-lunch", island: "Maui", address: "45 Front St" }];
  if (table === "qr_codes") return [{ id: "q1", status: "redeemed", created_at: "2026-10-07T18:00:00Z", expires_at: "2026-10-07T18:10:00Z", redeemed_at: "2026-10-07T18:04:00Z" }, { id: "q2", status: "expired", created_at: "2026-10-06T18:00:00Z", expires_at: "2026-10-06T18:10:00Z", redeemed_at: null }];
  if (table === "contributions") return [{ id: "c1", amount_cents: 2400, refunded_amount_cents: 0, status: "completed", created_at: "2026-10-07T12:00:00Z" }, { id: "c2", amount_cents: 800, refunded_amount_cents: 800, status: "refunded", created_at: "2026-10-06T12:00:00Z" }];
  if (table === "redemptions") return [{ id: "r1", eatery_id: "e1", amount_cents: 800, redeemed_at: "2026-10-07T18:04:00Z" }];
  if (table === "fee_settings") return [{ id: "f1", rate_bps: 500, effective_at: "1970-01-01T00:00:00Z", note: "Default 5% operational fee", created_at: "2026-10-01T00:00:00Z" }];
  if (table === "organizations" || table === "school_registrations") return [];
  return [];
}

export function startMock(port) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const send = (status, obj, headers = {}) => { res.writeHead(status, { "content-type": "application/json", ...headers }); res.end(obj === undefined ? "" : JSON.stringify(obj)); };
      if (url.pathname === "/auth/v1/user") {
        const token = (req.headers.authorization || "").replace("Bearer ", "");
        const a = byId[token.replace("tok-", "")];
        return a ? send(200, userJson(a)) : send(401, { code: 401, error_code: "bad_jwt", msg: "invalid" });
      }
      if (url.pathname === "/auth/v1/token") {
        const { email, password } = JSON.parse(body || "{}");
        const a = accounts[email];
        if (!a || password !== "pw") return send(400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
        const u = userJson({ ...a, email });
        return send(200, { access_token: `tok-${a.id}`, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: `ref-${a.id}`, user: u });
      }
      if (url.pathname === "/auth/v1/logout") return send(204);
      if (url.pathname.startsWith("/rest/v1/rpc/")) {
        const fn = url.pathname.split("/").pop();
        if (fn === "current_fee_rate_bps") return send(200, 500);
        if (fn === "finance_reconciliation") return send(200, { ok: true, issues: [] });
        if (fn === "contributions_missing_processor_fee") return send(200, []);
        if (fn === "finance_summary") {
          const zero = ["principal_credited_cents", "principal_refunded_cents", "net_principal_cents", "chargeback_principal_cents", "fees_charged_cents", "fees_refunded_cents", "net_fees_retained_cents", "processor_fees_cents", "dispute_fees_cents", "net_operational_revenue_cents", "pool_balance_cents", "redeemed_value_cents", "settlements_paid_cents", "settlements_pending_cents", "pending_contributions_count", "pending_contributions_total_cents", "refunds_requested_count", "refunds_pending_count", "refunds_succeeded_count", "refunds_failed_count", "outstanding_recovery_cents", "disputes_open_count", "disputes_open_principal_cents", "disputes_open_fee_cents"];
          return send(200, Object.fromEntries(zero.map((k) => [k, 0])));
        }
        return send(200, 0);
      }
      if (url.pathname.startsWith("/rest/v1/")) {
        const table = url.pathname.split("/").pop();
        const data = rows(table, url);
        const range = { "content-range": `0-${Math.max(data.length - 1, 0)}/${data.length}` };
        if (req.method === "HEAD") { res.writeHead(200, range); return res.end(); }
        if ((req.headers.accept || "").includes("vnd.pgrst.object")) return data.length ? send(200, data[0], range) : send(406, { code: "PGRST116", message: "no rows" });
        return send(200, data, range);
      }
      send(404, { error: "not found" });
    });
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}
