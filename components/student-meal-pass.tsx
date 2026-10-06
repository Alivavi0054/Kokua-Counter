"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QR_TTL_MS } from "@/lib/public-constants";

type PassStatus = "active" | "redeemed" | "expired" | "cancelled";

type StoredPass = {
  token: string;
  qrId: string;
  expiresAt: string;
};

const SESSION_KEY = "kokua-counter-student-pass";

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

  function persistPass(nextToken: string, nextQrId: string, nextExpiresAt: string) {
    if (typeof window === "undefined") return;
    const payload: StoredPass = {
      token: nextToken,
      qrId: nextQrId,
      expiresAt: nextExpiresAt,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  }

  function clearPersistedPass() {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem(SESSION_KEY);
  }

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
      setStatus("active");
      setRequested(true);
      persistPass(payload.token, payload.qr_id, payload.expires_at);
    } catch {
      setError("Could not create a meal pass.");
    } finally {
      setLoading(false);
    }
  }

  async function replacePass() {
    if (!qrId || status !== "active") {
      clearPersistedPass();
      setToken(null);
      setQrId(null);
      setExpiresAt(null);
      setStatus("cancelled");
      setRequested(false);
      await createPass();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/qr/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qr_id: qrId }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Could not cancel the current pass.");
        return;
      }
      clearPersistedPass();
      setToken(null);
      setQrId(null);
      setExpiresAt(null);
      setStatus("cancelled");
      setRequested(false);
      setEateryName(null);
      setRedeemedAt(null);
      await createPass();
    } catch {
      setError("Could not get a new meal pass.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<StoredPass>;
      if (!parsed.token || !parsed.qrId || !parsed.expiresAt) {
        clearPersistedPass();
        return;
      }
      if (Date.parse(parsed.expiresAt) <= Date.now()) {
        clearPersistedPass();
        return;
      }
      setToken(parsed.token);
      setQrId(parsed.qrId);
      setExpiresAt(parsed.expiresAt);
      setStatus("active");
      setRequested(true);
    } catch {
      clearPersistedPass();
    }
  }, []);

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

  useEffect(() => {
    if (status === "active" && token && qrId && expiresAt) {
      persistPass(token, qrId, expiresAt);
      return;
    }
    clearPersistedPass();
  }, [token, qrId, expiresAt, status]);

  const countdown = `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, "0")}`;
  const expiresAtHawaii = expiresAt
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "Pacific/Honolulu",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(expiresAt))
    : "";

  if (loading) {
    return <p className="py-12 text-center text-muted-foreground" role="status">Preparing your meal pass…</p>;
  }

  if (!requested && !error) {
    return (
      <Card>
        <CardHeader><CardTitle>Ready for a meal?</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Create a single-use meal pass to show at a participating eatery.</p>
          <Button onClick={() => void createPass()}>Get meal pass</Button>
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
          <Button onClick={() => void replacePass()}>Get a new pass</Button>
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
          <Button onClick={() => void replacePass()}>Get a new pass</Button>
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
        <div className="mx-auto w-full max-w-[304px] rounded-md bg-white p-3">
          <QRCodeSVG title="Single-use meal pass QR code" value={token} size={280} level="Q" className="mx-auto h-auto w-full max-w-[280px]" />
        </div>
        <div
          className="mx-auto grid size-28 place-items-center rounded-full p-2"
          style={{ background: `conic-gradient(var(--coral) ${Math.min(remainingSeconds / (QR_TTL_MS / 1000), 1) * 360}deg, var(--sand) 0deg)` }}
          role="timer"
          aria-label={`Pass expires in ${countdown}`}
        >
          <div className="grid size-full place-items-center rounded-full bg-background font-mono text-2xl font-semibold" aria-live="polite">
            {countdown}
          </div>
        </div>
        <p className="font-medium">Pass expires at {expiresAtHawaii} Hawaiʻi time.</p>
        <p className="text-sm text-muted-foreground">Ask the eatery team to scan this code. Your active pass is saved for this browser session.</p>
        <Button variant="outline" onClick={() => void replacePass()}>Get a new pass</Button>
      </CardContent>
    </Card>
  );
}