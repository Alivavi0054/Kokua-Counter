"use client";

import { useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { allocateRefund } from "@/lib/fees";
import { formatUsdFromCents } from "@/lib/utils";

type Props = {
  contributionId: string;
  donationCents: number;
  feeCents: number;
  refundedDonationCents: number;
  refundedFeeCents: number;
};

/** Parses "4.20" into 420 cents with string arithmetic (no floating point). */
function dollarsToCents(input: string): number | null {
  const match = /^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || "0");
}

export function RefundContributionButton({ contributionId, donationCents, feeCents, refundedDonationCents, refundedFeeCents }: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  // One key per open dialog: a double click re-sends the same key and cannot create a second refund.
  const requestKey = useRef<string>("");

  const remainingCents = donationCents - refundedDonationCents + (feeCents - refundedFeeCents);
  const requested = amount.trim() === "" ? remainingCents : dollarsToCents(amount);
  const valid = requested !== null && requested > 0 && requested <= remainingCents;
  const split = valid
    ? allocateRefund({
        principalCents: donationCents,
        feeCents,
        principalAlreadyAllocatedCents: refundedDonationCents,
        feeAlreadyAllocatedCents: refundedFeeCents,
        amountCents: requested,
      })
    : null;

  function start() {
    requestKey.current = crypto.randomUUID();
    setOpen(true);
    setResult(null);
  }

  async function submit() {
    if (!valid) return;
    setPending(true);
    setResult(null);
    const response = await fetch(`/api/admin/contributions/${contributionId}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey.current },
      body: JSON.stringify({ amount_cents: requested, reason: reason.trim() || undefined }),
    }).catch(() => null);
    const payload = (await response?.json().catch(() => ({}))) as { error?: string; message?: string } | undefined;
    setPending(false);
    if (!response || !response.ok) {
      setResult({ ok: false, text: payload?.error ?? "Could not reach the server. Check the Finance page before retrying." });
      return;
    }
    setResult({ ok: true, text: payload?.message ?? "Refund started." });
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={start}>
        Refund
      </Button>
    );
  }

  return (
    <div className="w-64 space-y-2 rounded-lg border bg-card p-3 text-left shadow-soft">
      <label className="block text-xs font-medium" htmlFor={`refund-amount-${contributionId}`}>
        Amount to return to the donor (blank = all {formatUsdFromCents(remainingCents)})
      </label>
      <Input
        id={`refund-amount-${contributionId}`}
        inputMode="decimal"
        placeholder={(remainingCents / 100).toFixed(2)}
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        className="h-9 text-sm"
        aria-invalid={!valid}
      />
      <Input
        placeholder="Reason (optional)"
        value={reason}
        maxLength={200}
        onChange={(event) => setReason(event.target.value)}
        className="h-9 text-sm"
        aria-label="Refund reason"
      />
      {split ? (
        <p className="text-xs text-muted-foreground">
          Reverses {formatUsdFromCents(split.principalCents)} donation + {formatUsdFromCents(split.feeCents)} operational fee. Stripe&apos;s own processing fee is not
          returned.
        </p>
      ) : (
        <p className="text-xs text-destructive">Enter an amount up to {formatUsdFromCents(remainingCents)}.</p>
      )}
      {result ? <Alert variant={result.ok ? "success" : "destructive"} className="px-3 py-2 text-xs">{result.text}</Alert> : null}
      <div className="flex gap-2">
        <Button size="sm" disabled={!valid || pending || result?.ok === true} onClick={() => void submit()}>
          {pending ? "Refunding…" : "Confirm refund"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Close</Button>
      </div>
    </div>
  );
}
