"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialForm = {
  name: "",
  address: "",
  island: "",
  ownerEmail: "",
  ownerPassword: "",
  ownerDisplayName: "",
};

export function AdminCreateEateryForm() {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [form, setForm] = useState(initialForm);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus(null);

    const response = await fetch("/api/admin/eateries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const payload = (await response.json()) as { error?: string; message?: string };
    setPending(false);

    if (!response.ok) {
      setStatus({ type: "error", message: payload.error ?? "Could not create the eatery." });
      return;
    }

    setForm(initialForm);
    setStatus({ type: "success", message: payload.message ?? "Eatery created successfully." });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create eatery</CardTitle>
        <CardDescription>Add a new participating eatery and its owner account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="new-eatery-name">Eatery name</Label>
              <Input
                id="new-eatery-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-eatery-address">Address</Label>
              <Input
                id="new-eatery-address"
                value={form.address}
                onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-eatery-island">Island</Label>
              <Input
                id="new-eatery-island"
                value={form.island}
                onChange={(event) => setForm((current) => ({ ...current, island: event.target.value }))}
                placeholder="Oahu"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-eatery-owner-name">Owner display name</Label>
              <Input
                id="new-eatery-owner-name"
                value={form.ownerDisplayName}
                onChange={(event) => setForm((current) => ({ ...current, ownerDisplayName: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-eatery-owner-email">Owner email</Label>
              <Input
                id="new-eatery-owner-email"
                type="email"
                value={form.ownerEmail}
                onChange={(event) => setForm((current) => ({ ...current, ownerEmail: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-eatery-owner-password">Owner password</Label>
              <Input
                id="new-eatery-owner-password"
                type="password"
                minLength={8}
                value={form.ownerPassword}
                onChange={(event) => setForm((current) => ({ ...current, ownerPassword: event.target.value }))}
                required
              />
            </div>
          </div>

          {status ? (
            <p className={status.type === "success" ? "text-sm text-green-700" : "text-sm text-red-700"} role="status">
              {status.message}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating…" : "Create eatery"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
