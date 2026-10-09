"use client";

import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatFeeRate, percentToBps } from "@/lib/fees";

export function AdminFeeSettingsForm({ currentRateBps }: { currentRateBps: number }) {
  const [percent, setPercent] = useState((currentRateBps / 100).toString());
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const bps = percentToBps(percent);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (bps === null) return;
    if (!window.confirm(`Set the operational fee to ${formatFeeRate(bps)} for all future donations? Existing donations keep the rate they were charged.`)) return;
    setPending(true);
    setResult(null);
    const response = await fetch("/api/admin/fee-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rate_bps: bps, note: note.trim() || undefined }),
    }).catch(() => null);
    const payload = (await response?.json().catch(() => ({}))) as { error?: string; message?: string } | undefined;
    setPending(false);
    if (!response?.ok) {
      setResult({ ok: false, text: payload?.error ?? "Could not update the fee." });
      return;
    }
    setResult({ ok: true, text: `${payload?.message ?? "Fee updated."} Reload to see it in the history.` });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <div className="space-y-2">
          <Label htmlFor="fee-percent">New fee (%)</Label>
          <Input
            id="fee-percent"
            inputMode="decimal"
            value={percent}
            onChange={(event) => setPercent(event.target.value)}
            aria-invalid={bps === null}
            aria-describedby="fee-help"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fee-note">Reason (optional)</Label>
          <Input id="fee-note" value={note} maxLength={200} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Hosting costs increased" />
        </div>
      </div>
      <p id="fee-help" className="text-xs text-muted-foreground">
        0% to 20%, up to two decimals. Applies only to donations started after the change; completed and in-progress
        donations keep the rate they were charged, and refunds always use the original amounts.
      </p>
      {result ? <Alert variant={result.ok ? "success" : "destructive"}>{result.text}</Alert> : null}
      <Button type="submit" disabled={pending || bps === null}>
        {pending ? "Saving…" : bps === null ? "Enter a valid percentage" : `Set fee to ${formatFeeRate(bps)}`}
      </Button>
    </form>
  );
}
