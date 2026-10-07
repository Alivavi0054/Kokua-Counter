"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialForm = {
  schoolName: "",
  contactName: "",
  email: "",
  phone: "",
  schoolType: "",
  students: "",
  city: "",
  state: "",
  message: "",
};

export function SchoolRegistrationForm() {
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState(initialForm);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus(null);

    const response = await fetch("/api/schools/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const payload = (await response.json()) as { error?: string; message?: string };
    setPending(false);

    if (!response.ok) {
      setStatus({ type: "error", message: payload.error ?? "Could not submit the registration form." });
      return;
    }

    setForm(initialForm);
    setStatus({
      type: "success",
      message: payload.message ?? "Thanks. Your school registration request has been received.",
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Register your school or institution</CardTitle>
        <CardDescription>
          Share a few details and the Kōkua Counter team will follow up about creating a school partnership.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="school-name">School or organization name</Label>
              <Input
                id="school-name"
                value={form.schoolName}
                onChange={(event) => setForm((current) => ({ ...current, schoolName: event.target.value }))}
                placeholder="e.g. Kaimukī High School"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-name">Primary contact</Label>
              <Input
                id="contact-name"
                value={form.contactName}
                onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))}
                placeholder="Jane Doe"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="principal@school.edu"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                placeholder="(808) 555-0199"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="school-type">School type</Label>
              <Input
                id="school-type"
                value={form.schoolType}
                onChange={(event) => setForm((current) => ({ ...current, schoolType: event.target.value }))}
                placeholder="High school, college, nonprofit, etc."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="students">Estimated student count</Label>
              <Input
                id="students"
                value={form.students}
                onChange={(event) => setForm((current) => ({ ...current, students: event.target.value }))}
                placeholder="250 students"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
                placeholder="Honolulu"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={form.state}
                onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))}
                placeholder="HI"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="message">Message</Label>
              <textarea
                id="message"
                value={form.message}
                onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Tell us how you’d like to participate or what support your school needs."
              />
            </div>
          </div>

          {status ? (
            <p className={status.type === "success" ? "text-sm text-green-700" : "text-sm text-red-700"} role="status">
              {status.message}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Sending…" : "Register my school"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
