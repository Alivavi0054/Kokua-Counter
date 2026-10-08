"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ConnectPayoutsButton({ isConnected }: { isConnected: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setPending(true);
    setError(null);
    const response = await fetch("/api/eatery/connect/onboard", { method: "POST" });
    const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!response.ok || !payload.url) {
      setPending(false);
      const errorMsg = payload.error ?? "Could not start payout setup.";
      if (response.status === 403) {
        setError(`${errorMsg} Run: npm run setup:connect`);
      } else {
        setError(errorMsg);
      }
      return;
    }
    window.location.href = payload.url;
  }

  return (
    <div className="space-y-2">
      <Button onClick={onClick} disabled={pending} variant={isConnected ? "outline" : "default"}>
        {pending ? "Opening…" : isConnected ? "Update payout details" : "Set up payouts"}
      </Button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
