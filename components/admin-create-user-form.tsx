"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { USER_ROLES } from "@/lib/auth/roles";

const initialForm = {
  email: "",
  password: "",
  role: "student" as (typeof USER_ROLES)[number],
  displayName: "",
};

export function AdminCreateUserForm() {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [form, setForm] = useState(initialForm);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus(null);

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const payload = (await response.json()) as { error?: string; message?: string };
    setPending(false);

    if (!response.ok) {
      setStatus({ type: "error", message: payload.error ?? "Could not create the user." });
      return;
    }

    setForm(initialForm);
    setStatus({ type: "success", message: payload.message ?? "User created successfully." });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create user</CardTitle>
        <CardDescription>Add a new account directly to the database.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-user-email">Email</Label>
              <Input
                id="new-user-email"
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-user-password">Password</Label>
              <Input
                id="new-user-password"
                type="password"
                minLength={8}
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-user-name">Display name</Label>
              <Input
                id="new-user-name"
                value={form.displayName}
                onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-user-role">Role</Label>
              <select
                id="new-user-role"
                value={form.role}
                onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as (typeof USER_ROLES)[number] }))}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {USER_ROLES.map((role) => (
                  <option key={role} value={role} className="capitalize">
                    {role}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {status ? (
            <p className={status.type === "success" ? "text-sm text-green-700" : "text-sm text-red-700"} role="status">
              {status.message}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating…" : "Create user"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
