"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

async function post(url: string): Promise<{ ok: boolean; text: string }> {
  const response = await fetch(url, { method: "POST" }).catch(() => null);
  const payload = (await response?.json().catch(() => ({}))) as Record<string, unknown> | undefined;
  if (!response?.ok) return { ok: false, text: String(payload?.error ?? "Request failed.") };
  return { ok: true, text: payload?.message ? String(payload.message) : `Checked ${payload?.checked ?? 0}, recorded ${payload?.recorded ?? 0}.` };
}

export function ReconcileRefundButton({ refundId }: { refundId: string }) {
  const [state, setState] = useState<{ pending: boolean; text: string | null; ok: boolean }>({ pending: false, text: null, ok: true });
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={state.pending}
        onClick={async () => {
          setState({ pending: true, text: null, ok: true });
          const result = await post(`/api/admin/refunds/${refundId}/reconcile`);
          setState({ pending: false, text: result.text, ok: result.ok });
        }}
      >
        {state.pending ? "Checking…" : "Reconcile"}
      </Button>
      {state.text ? <p className={state.ok ? "max-w-48 text-right text-xs text-success" : "max-w-48 text-right text-xs text-destructive"}>{state.text}</p> : null}
    </div>
  );
}

export function BackfillProcessorFeesButton() {
  const [state, setState] = useState<{ pending: boolean; text: string | null; ok: boolean }>({ pending: false, text: null, ok: true });
  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        disabled={state.pending}
        onClick={async () => {
          setState({ pending: true, text: null, ok: true });
          const result = await post("/api/admin/finance/reconcile");
          setState({ pending: false, text: result.text, ok: result.ok });
        }}
      >
        {state.pending ? "Checking with Stripe…" : "Backfill processing fees from Stripe"}
      </Button>
      {state.text ? <p className={state.ok ? "text-sm text-success" : "text-sm text-destructive"}>{state.text}</p> : null}
    </div>
  );
}
