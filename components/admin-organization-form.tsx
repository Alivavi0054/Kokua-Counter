"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialForm = {
  name: "",
  mission: "",
  contactName: "",
  email: "",
  phone: "",
  city: "",
  state: "",
  website: "",
  notes: "",
};

export function AdminOrganizationForm() {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [form, setForm] = useState(initialForm);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus(null);

    const response = await fetch("/api/admin/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const payload = (await response.json()) as { error?: string; message?: string };
    setPending(false);

    if (!response.ok) {
      setStatus({ type: "error", message: payload.error ?? "Could not create the organization." });
      return;
    }

    setForm(initialForm);
    setStatus({
      type: "success",
      message: payload.message ?? "Organization created successfully.",
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create organization</CardTitle>
        <CardDescription>Add a new school or nonprofit partner to the Kōkua Counter network.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="org-name">Organization name</Label>
              <Input
                id="org-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="org-mission">Mission</Label>
              <Input
                id="org-mission"
                value={form.mission}
                onChange={(event) => setForm((current) => ({ ...current, mission: event.target.value }))}
                placeholder="Supporting student meals and food access"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-contact">Contact name</Label>
              <Input
                id="org-contact"
                value={form.contactName}
                onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-email">Contact email</Label>
              <Input
                id="org-email"
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-phone">Phone</Label>
              <Input
                id="org-phone"
                type="tel"
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-website">Website</Label>
              <Input
                id="org-website"
                type="url"
                value={form.website}
                onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-city">City</Label>
              <Input
                id="org-city"
                value={form.city}
                onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-state">State</Label>
              <Input
                id="org-state"
                value={form.state}
                onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="org-notes">Notes</Label>
              <textarea
                id="org-notes"
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Useful context for program onboarding"
              />
            </div>
          </div>

          {status ? (
            <p className={status.type === "success" ? "text-sm text-green-700" : "text-sm text-red-700"} role="status">
              {status.message}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating…" : "Create organization"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
