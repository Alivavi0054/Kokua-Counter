"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const errorParam = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(
    errorParam === "unauthorized"
      ? "That account cannot open this page."
      : errorParam === "domain"
        ? "Use a University of Hawaiʻi email ending in @hawaii.edu."
        : null,
  );
  const [pending, setPending] = useState(false);

  async function signInWithPassword(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, next }),
    });
    const payload = (await response.json()) as {
      error?: string;
      redirect?: string;
    };
    setPending(false);
    if (!response.ok) {
      setMessage(payload.error ?? "Could not sign in.");
      return;
    }
    window.location.href = payload.redirect ?? "/";
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Account Login</CardTitle>
          <CardDescription>
            Students, staff at participating food businesses (eateries), and administrators use their account email and password here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={signInWithPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Signing in…" : "Student Login"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {message ? (
        <p className="text-sm" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
