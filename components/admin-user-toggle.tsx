"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function UserActiveToggle({ userId, isActive }: { userId: string; isActive: boolean }) {
  const [active, setActive] = useState(isActive);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !active;
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: next }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? "Could not update user.");
        return;
      }
      setActive(next);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant={active ? "outline" : "default"} disabled={pending} onClick={toggle}>
        {pending ? "Saving…" : active ? "Deactivate" : "Activate"}
      </Button>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
