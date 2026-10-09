"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Notice = { tone: "info" | "destructive"; text: string };

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const errorParam = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(
    errorParam === "unauthorized"
      ? { tone: "destructive", text: "That account cannot open this page." }
      : errorParam === "domain"
        ? { tone: "destructive", text: "Use a University of Hawaiʻi email ending in @hawaii.edu." }
        : null,
  );
  const [pending, setPending] = useState(false);

  async function signInWithPassword(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setNotice(null);

    if (!email.trim() || !password) {
      setPending(false);
      setNotice({ tone: "destructive", text: "Email and password are required." });
      return;
    }

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, next }),
      });
      const payload = (await response.json()) as { error?: string; redirect?: string };

      if (!response.ok) {
        setPending(false);
        setNotice({ tone: "destructive", text: payload.error ?? "Could not sign in. Please try again." });
        return;
      }

      window.location.href = payload.redirect ?? "/";
    } catch {
      setPending(false);
      setNotice({ tone: "destructive", text: "Network error. Check your internet connection and try again." });
    }
  }

  return (
    <Card className="shadow-lift">
      <CardHeader>
        <CardTitle className="text-2xl">Sign in to your account</CardTitle>
        <CardDescription>Students, eatery staff, and administrators all sign in here.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={signInWithPassword} className="space-y-5" noValidate>
          {notice ? <Alert variant={notice.tone}>{notice.text}</Alert> : null}
          <div className="space-y-2">
            <Label htmlFor="login-email">Email address</Label>
            <Input
              id="login-email"
              type="email"
              inputMode="email"
              placeholder="you@hawaii.edu"
              required
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              disabled={pending}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-password">Password</Label>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                disabled={pending}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="pr-16"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 px-3.5 text-xs font-semibold text-primary hover:underline"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
