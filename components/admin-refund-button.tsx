"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function RefundContributionButton({ contributionId }: { contributionId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  function refund() {
    if (!window.confirm("Refund the remaining amount for this contribution?")) return;
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/admin/contributions/${contributionId}/refund`, { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!response.ok) {
        setIsError(true);
        setMessage(payload.error ?? "Could not start the refund.");
        return;
      }
      setIsError(false);
      setMessage(payload.message ?? "Refund started.");
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" disabled={pending} onClick={refund}>
        {pending ? "Refunding…" : "Refund"}
      </Button>
      {message ? (
        <p className={isError ? "text-xs text-red-700" : "text-xs text-green-700"}>{message}</p>
      ) : null}
    </div>
  );
}
