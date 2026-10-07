"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formatUsdFromCents } from "@/lib/utils";

export function SettleEateryButton({ eateryId, isConnected }: { eateryId: string; isConnected: boolean }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  function settle() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/admin/eateries/${eateryId}/settle`, { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        amount_cents?: number;
      };
      if (!response.ok) {
        setIsError(true);
        setMessage(payload.error ?? "Could not settle this eatery.");
        return;
      }
      setIsError(false);
      setMessage(`Paid out ${formatUsdFromCents(payload.amount_cents ?? 0)}.`);
    });
  }

  if (!isConnected) {
    return <span className="text-xs text-muted-foreground">Not connected</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" disabled={pending} onClick={settle}>
        {pending ? "Settling…" : "Settle payouts"}
      </Button>
      {message ? (
        <p className={isError ? "text-xs text-red-700" : "text-xs text-green-700"}>{message}</p>
      ) : null}
    </div>
  );
}
