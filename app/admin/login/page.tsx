import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Admin login",
  description: "Admin sign-in for Kōkua Counter organization setup.",
};

export default function AdminLoginPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-3">
        <p className="text-sm font-medium text-primary">Admin access</p>
        <h1 className="font-serif text-4xl">Administrator sign in</h1>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Use the main sign-in page to access admin tools, then create organizations from the management page.
        </p>
        <div className="mt-5">
          <Link href="/auth/login" className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Go to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
