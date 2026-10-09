import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data: unknown; error: unknown };
const state = vi.hoisted(() => ({
  result: { data: null, error: null } as { data: unknown; error: unknown },
  calls: [] as Array<{ method: string; args: unknown[] }>,
}));

function chain() {
  const builder: Record<string, unknown> = {};
  for (const method of ["from", "select", "insert", "order", "limit", "single"]) {
    builder[method] = (...args: unknown[]) => {
      state.calls.push({ method, args });
      return builder;
    };
  }
  builder.then = (resolve: (value: Result) => unknown) => resolve(state.result);
  return builder;
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => chain() }));

import {
  createOrganization,
  createSchoolRegistration,
  listOrganizations,
  listSchoolRegistrations,
} from "@/lib/organization-store";

const orgRow = {
  id: "o1",
  name: "Aloha Org",
  mission: null,
  contact_name: "Kai",
  email: "kai@example.org",
  phone: "555",
  city: null,
  state: null,
  website: null,
  notes: null,
  created_at: "2026-10-08T00:00:00Z",
  updated_at: "2026-10-08T00:00:00Z",
};

beforeEach(() => {
  state.calls = [];
  state.result = { data: null, error: null };
});

describe("organization store", () => {
  it("maps rows to camelCase records with undefined for nulls and lists newest first", async () => {
    state.result = { data: [orgRow], error: null };
    const [org] = await listOrganizations();

    expect(org).toEqual({
      id: "o1",
      name: "Aloha Org",
      mission: undefined,
      contactName: "Kai",
      email: "kai@example.org",
      phone: "555",
      city: undefined,
      state: undefined,
      website: undefined,
      notes: undefined,
      createdAt: "2026-10-08T00:00:00Z",
    });
    expect(state.calls.find((call) => call.method === "order")?.args).toEqual([
      "created_at",
      { ascending: false },
    ]);
  });

  it("throws on read errors instead of returning an empty list", async () => {
    state.result = { data: null, error: { message: "boom" } };
    await expect(listOrganizations()).rejects.toEqual({ message: "boom" });
    await expect(listSchoolRegistrations()).rejects.toEqual({ message: "boom" });
  });

  it("inserts snake_case columns and returns the stored record", async () => {
    state.result = { data: orgRow, error: null };
    const created = await createOrganization({ name: "Aloha Org", contactName: "Kai", email: "kai@example.org", phone: "555" });

    expect(created.id).toBe("o1");
    const insert = state.calls.find((call) => call.method === "insert");
    expect(insert?.args[0]).toMatchObject({
      name: "Aloha Org",
      contact_name: "Kai",
      mission: null,
      phone: "555",
    });
  });

  it("maps school registrations and propagates insert errors", async () => {
    state.result = {
      data: {
        id: "s1",
        school_name: "Mauka High",
        contact_name: "Lei",
        email: "lei@example.edu",
        phone: null,
        school_type: "Public",
        students: null,
        city: "Hilo",
        state: null,
        message: null,
        created_at: "2026-10-08T00:00:00Z",
        updated_at: "2026-10-08T00:00:00Z",
      },
      error: null,
    };
    const created = await createSchoolRegistration({ schoolName: "Mauka High", contactName: "Lei", email: "lei@example.edu" });
    expect(created).toMatchObject({ id: "s1", schoolName: "Mauka High", schoolType: "Public", city: "Hilo", phone: undefined });

    state.result = { data: null, error: { message: "insert failed" } };
    await expect(
      createSchoolRegistration({ schoolName: "x", contactName: "y", email: "z@example.edu" }),
    ).rejects.toEqual({ message: "insert failed" });
  });
});
