import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isDevLoginEnabled } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Developer sign in",
  description: "Local-only developer sign-in for Kōkua Counter.",
};

export default function DevLoginPage() {
  if (!isDevLoginEnabled()) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="font-serif text-4xl">Developer login</h1>
      <form action="/api/auth/dev-login" method="post" className="space-y-4 rounded border p-4">
        <label className="block text-sm font-medium">
          Email
          <input name="email" type="email" defaultValue="student@hawaii.edu" className="mt-1 w-full rounded border px-3 py-2" required />
        </label>
        <label className="block text-sm font-medium">
          Password
          <input name="password" type="password" className="mt-1 w-full rounded border px-3 py-2" required />
        </label>
        <button type="submit" className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Sign in
        </button>
      </form>
    </div>
  );
}
