"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function ConnectPayoutsButton({ isConnected }: { isConnected: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setPending(true);
    setError(null);
    let response: Response;
    try {
      response = await fetch("/api/eatery/connect/onboard", { method: "POST" });
    } catch {
      setPending(false);
      setError("Network error. Check your connection and try again.");
      return;
    }
    const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!response.ok || !payload.url) {
      setPending(false);
      setError(
        response.status === 403
          ? "Payout setup isn't available yet. Please contact the program team."
          : payload.error ?? "Could not start payout setup. Please try again.",
      );
      return;
    }
    window.location.href = payload.url;
  }

  return (
    <div className="space-y-2">
      <Button onClick={onClick} disabled={pending} variant={isConnected ? "outline" : "default"}>
        {pending ? "Opening…" : isConnected ? "Update payout details" : "Set up payouts"}
      </Button>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
    </div>
  );
}
