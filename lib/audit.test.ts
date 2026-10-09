import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => ({ insert }) }) }));

import { recordAdminAction } from "@/lib/audit";

beforeEach(() => {
  insert.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("recordAdminAction", () => {
  it("writes who, what and the target", async () => {
    insert.mockResolvedValue({ error: null });
    await recordAdminAction({ actorId: "admin-1", action: "refund.started", targetType: "contribution", targetId: "c1", details: { total_cents: 420 } });
    expect(insert).toHaveBeenCalledWith({
      actor_user_id: "admin-1",
      action: "refund.started",
      target_type: "contribution",
      target_id: "c1",
      details: { total_cents: 420 },
    });
  });

  it("never blocks the admin action when the log write fails, but reports it", async () => {
    insert.mockResolvedValue({ error: { message: "db down" } });
    await expect(recordAdminAction({ actorId: "admin-1", action: "user.created" })).resolves.toBeUndefined();
    insert.mockRejectedValue(new Error("network"));
    await expect(recordAdminAction({ actorId: "admin-1", action: "user.created" })).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledTimes(2);
  });
});
