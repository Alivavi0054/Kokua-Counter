"use client";

import { useState, type FormEvent } from "react";
import {
  MAX_DONATION_CENTS,
  MEAL_VALUE_CENTS,
  PRESET_DONATION_CENTS,
} from "@/lib/public-constants";
import { formatUsdFromCents, mealsFromCents } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DonateForm() {
  const [preset, setPreset] = useState<number | "custom">(PRESET_DONATION_CENTS[0]);
  const [customDollars, setCustomDollars] = useState("8");
  const [email, setEmail] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const amountCents =
    preset === "custom"
      ? Math.round(Number.parseFloat(customDollars || "0") * 100)
      : preset;
  const customIsWholeDollar = preset !== "custom" ||
    (Number.isFinite(Number(customDollars)) && Number.isInteger(Number(customDollars)));
  const amountIsValid = customIsWholeDollar && Number.isSafeInteger(amountCents) &&
    amountCents >= MEAL_VALUE_CENTS && amountCents <= MAX_DONATION_CENTS;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/donate/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_cents: amountCents,
          donor_email: email.trim() || undefined,
          is_anonymous: isAnonymous,
        }),
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        setError(payload.error ?? "Could not start checkout.");
        setPending(false);
        return;
      }
      window.location.href = payload.url;
    } catch {
      setError("Could not start checkout.");
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fund meal credits</CardTitle>
        <CardDescription>
          Each {formatUsdFromCents(MEAL_VALUE_CENTS)} adds one meal to a shared
          pool used at participating eateries. Donations are anonymous by default.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Amount</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PRESET_DONATION_CENTS.map((cents) => (
                <Button
                  key={cents}
                  type="button"
                  variant={preset === cents ? "default" : "outline"}
                  aria-pressed={preset === cents}
                  onClick={() => setPreset(cents)}
                >
                  <span className="grid gap-1">
                    <span>{formatUsdFromCents(cents)}</span>
                    <span className="text-xs font-normal">{mealsFromCents(cents)} meal{mealsFromCents(cents) === 1 ? "" : "s"}</span>
                  </span>
                </Button>
              ))}
              <Button
                type="button"
                variant={preset === "custom" ? "default" : "outline"}
                aria-pressed={preset === "custom"}
                onClick={() => setPreset("custom")}
              >
                Custom
              </Button>
            </div>
            {preset === "custom" ? (
              <div className="space-y-2">
                <Label htmlFor="custom-amount">Amount in dollars</Label>
                <Input
                  id="custom-amount"
                  type="number"
                  inputMode="decimal"
                  min={8}
                  max={MAX_DONATION_CENTS / 100}
                  step="1"
                  aria-invalid={!amountIsValid}
                  aria-describedby="amount-help"
                  value={customDollars}
                  onChange={(event) => setCustomDollars(event.target.value)}
                />
              </div>
            ) : null}
            <p id="amount-help" className="text-sm text-muted-foreground" role={amountIsValid ? undefined : "status"}>
              {amountIsValid
                ? `${mealsFromCents(amountCents)} meal${mealsFromCents(amountCents) === 1 ? "" : "s"}`
                : `Enter an amount from ${formatUsdFromCents(MEAL_VALUE_CENTS)} to ${formatUsdFromCents(MAX_DONATION_CENTS)} in whole dollars.`}
            </p>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="donor-email">Email for Stripe receipt (optional)</Label>
            <Input
              id="donor-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[hsl(var(--primary))]"
              checked={isAnonymous}
              onChange={(event) => setIsAnonymous(event.target.checked)}
            />
            Keep this donation anonymous
          </label>

          {error ? (
            <Alert variant="destructive">{error}</Alert>
          ) : null}

          <Button type="submit" size="lg" variant="accent" className="w-full" disabled={pending || !amountIsValid}>
            {pending ? "Redirecting to checkout…" : "Continue to checkout"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
