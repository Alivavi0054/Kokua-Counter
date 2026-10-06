"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PassStatus = "active" | "redeemed" | "expired" | "cancelled";

export function StudentMealPass() {
  const [qrId, setQrId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [status, setStatus] = useState<PassStatus>("active");
  const [eateryName, setEateryName] = useState<string | null>(null);
  const [redeemedAt, setRedeemedAt] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [requested, setRequested] = useState(false);

  async function createPass() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/qr/generate", { method: "POST" });
      const payload = (await response.json()) as {
        token?: string;
        qr_id?: string;
        expires_at?: string;
        error?: string;
      };
      if (!response.ok || !payload.token || !payload.expires_at || !payload.qr_id) {
        setError(payload.error ?? "Could not create a meal pass.");
        return;
      }
      setToken(payload.token);
      setQrId(payload.qr_id);
      setExpiresAt(payload.expires_at);
      setRequested(true);
    } catch {
      setError("Could not create a meal pass.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!expiresAt || status !== "active") return;
    const updateCountdown = () => {
      const seconds = Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000));
      setRemainingSeconds(seconds);
      if (seconds === 0) setStatus("expired");
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt, status]);

  useEffect(() => {
    if (!qrId || status !== "active") return;
    let cancelled = false;
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/qr/status?id=${encodeURIComponent(qrId)}`);
        if (!response.ok) return;
        const payload = (await response.json()) as {
          status?: PassStatus;
          eatery_name?: string;
          redeemed_at?: string | null;
        };
        if (!cancelled && payload.status) {
          setStatus(payload.status);
          setEateryName(payload.eatery_name ?? null);
          setRedeemedAt(payload.redeemed_at ?? null);
        }
      } catch {
        // Status polling is best-effort; redemption is still enforced by the server.
      }
    };
    void checkStatus();
    const timer = window.setInterval(checkStatus, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [qrId, status]);

  const countdown = `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, "0")}`;

  if (loading) {
    return <p className="py-12 text-center text-muted-foreground" role="status">Preparing your meal pass…</p>;
  }

  if (!requested && !error) {
    return (
      <Card>
        <CardHeader><CardTitle>Ready for a meal?</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Create a single-use meal pass to show at a participating eatery.</p>
          <Button onClick={createPass}>Get meal pass</Button>
        </CardContent>
      </Card>
    );
  }

  if (status === "redeemed") {
    return (
      <Card>
        <CardHeader><CardTitle>Meal pass redeemed</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p>Your meal was accepted at {eateryName ?? "a participating eatery"}.</p>
          {redeemedAt ? <p className="text-sm text-muted-foreground">{new Date(redeemedAt).toLocaleString()}</p> : null}
          <Button variant="outline" asChild><Link href="/student/history">View history</Link></Button>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader><CardTitle>Meal pass unavailable</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p role="alert">{error}</p>
          <Button variant="outline" asChild><Link href="/student">Back to student home</Link></Button>
        </CardContent>
      </Card>
    );
  }

  if (status !== "active" || !token || !expiresAt) {
    return (
      <Card>
        <CardHeader><CardTitle>Meal pass ended</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p>This pass is no longer active. You can request another one when eligible.</p>
          <Button asChild><Link href="/student">Back to student home</Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader className="text-center">
        <CardTitle>Show this pass at the counter</CardTitle>
        <p className="text-sm text-muted-foreground">One meal · single use</p>
      </CardHeader>
      <CardContent className="space-y-5 text-center">
        <div className="mx-auto w-fit rounded-md bg-white p-3">
          <QRCodeSVG value={token} size={280} level="Q" className="h-auto max-w-full" />
        </div>
        <p className="font-medium" aria-live="polite">Expires in {countdown}</p>
        <p className="text-sm text-muted-foreground">Valid until {new Date(expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. Ask the eatery team to scan this code.</p>
        <p className="text-xs text-muted-foreground">Keep this screen open. For your security, the code cannot be reissued.</p>
      </CardContent>
    </Card>
  );
}