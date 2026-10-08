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
    
    if (!email || !password) {
      setPending(false);
      setMessage("Email and password are required.");
      return;
    }

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, next }),
      });
      
      const payload = (await response.json()) as {
        error?: string;
        redirect?: string;
      };
      
      if (!response.ok) {
        setPending(false);
        setMessage(payload.error ?? "Could not sign in. Please try again.");
        console.error("[Login Error]", response.status, payload.error);
        return;
      }
      
      // Successful login - redirect
      const redirectUrl = payload.redirect ?? "/";
      window.location.href = redirectUrl;
    } catch (error) {
      setPending(false);
      setMessage("Network error. Check your internet connection and try again.");
      console.error("[Login Network Error]", error);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Account Login</CardTitle>
          <CardDescription>
            Enter your email and password to sign in as a student, eatery staff, or administrator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={signInWithPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email Address</Label>
              <Input
                id="login-email"
                type="email"
                inputMode="email"
                placeholder="your.email@hawaii.edu"
                required
                autoComplete="email"
                disabled={pending}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                disabled={pending}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="text-base"
              />
            </div>
            <Button type="submit" className="w-full h-12" disabled={pending}>
              {pending ? "Signing in…" : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {message ? (
        <p className={`text-sm font-medium ${message.includes("Could not") || message.includes("Network") || message.includes("required") ? "text-red-600" : "text-blue-600"}`} role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
