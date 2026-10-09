import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  upsert: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireApiRole: async () => ({ ok: true, user: { id: "admin-test-user" } }),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: () => ({ ok: true }) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { createUser: mocks.createUser, deleteUser: mocks.deleteUser } },
    from: (table: string) => ({
      upsert: (...args: unknown[]) => mocks.upsert(table, ...args),
      insert: (...args: unknown[]) => mocks.insert(table, ...args),
    }),
  }),
}));

import { POST as createEatery } from "@/app/api/admin/eateries/route";
import { POST as createUser } from "@/app/api/admin/users/route";

function jsonRequest(body: unknown) {
  return new Request("https://app.example.com/api/admin/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const userBody = { email: "new@example.com", password: "password123", role: "student", displayName: "New User" };
const eateryBody = {
  name: "Poi Shack",
  address: "1 Aloha St",
  island: "Oahu",
  ownerEmail: "owner@example.com",
  ownerPassword: "password123",
  ownerDisplayName: "Owner",
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.createUser.mockResolvedValue({ data: { user: { id: "auth-user-1" } }, error: null });
  mocks.deleteUser.mockResolvedValue({ error: null });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.insert.mockResolvedValue({ error: null });
});

describe("POST /api/admin/users", () => {
  it("creates the user without touching rollback on success", async () => {
    const response = await createUser(jsonRequest(userBody));
    expect(response.status).toBe(200);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("returns a generic error instead of the raw Supabase message", async () => {
    mocks.createUser.mockResolvedValue({
      data: { user: null },
      error: new Error("A user with this email address has already been registered"),
    });
    const response = await createUser(jsonRequest(userBody));
    const text = await response.text();
    expect(response.status).toBe(409);
    expect(text).not.toContain("already been registered");
    expect(JSON.parse(text).error).toBe("Could not create this account.");
  });

  it("deletes the auth user when the profile upsert fails", async () => {
    mocks.upsert.mockResolvedValue({ error: { code: "XX000", message: "db exploded" } });
    const response = await createUser(jsonRequest(userBody));
    const text = await response.text();
    expect(response.status).toBe(500);
    expect(text).not.toContain("db exploded");
    expect(mocks.deleteUser).toHaveBeenCalledWith("auth-user-1");
  });

  it("still responds with an error if the rollback itself fails", async () => {
    mocks.upsert.mockResolvedValue({ error: { message: "nope" } });
    mocks.deleteUser.mockRejectedValue(new Error("delete failed"));
    const response = await createUser(jsonRequest(userBody));
    expect(response.status).toBe(500);
  });
});

describe("POST /api/admin/eateries", () => {
  it("creates the eatery and returns its slug", async () => {
    const response = await createEatery(jsonRequest(eateryBody));
    expect(response.status).toBe(200);
    expect((await response.json()).slug).toBe("poi-shack");
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("returns a generic error when the owner account cannot be created", async () => {
    mocks.createUser.mockResolvedValue({ data: { user: null }, error: new Error("email exists") });
    const response = await createEatery(jsonRequest(eateryBody));
    expect(response.status).toBe(409);
    expect(await response.text()).not.toContain("email exists");
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("deletes the auth user when the owner profile upsert fails", async () => {
    mocks.upsert.mockResolvedValue({ error: { message: "nope" } });
    const response = await createEatery(jsonRequest(eateryBody));
    expect(response.status).toBe(500);
    expect(mocks.deleteUser).toHaveBeenCalledWith("auth-user-1");
  });

  it("deletes the auth user when the eatery insert fails", async () => {
    mocks.insert.mockResolvedValue({ error: { code: "XX000", message: "nope" } });
    const response = await createEatery(jsonRequest(eateryBody));
    expect(response.status).toBe(500);
    expect(mocks.deleteUser).toHaveBeenCalledWith("auth-user-1");
  });

  it("retries on slug collisions and rolls back if every attempt collides", async () => {
    mocks.insert.mockResolvedValue({ error: { code: "23505", message: "dup" } });
    const response = await createEatery(jsonRequest(eateryBody));
    expect(response.status).toBe(500);
    expect(mocks.insert).toHaveBeenCalledTimes(5);
    expect(mocks.deleteUser).toHaveBeenCalledWith("auth-user-1");
  });
});
