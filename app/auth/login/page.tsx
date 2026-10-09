import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "@/components/login-form";
import { loadUser } from "@/lib/auth/guards";
import { roleHome } from "@/lib/auth/roles";
import { isAllowedRedirect } from "@/lib/security";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Sign in",
  description: "Student, eatery, and administrator sign-in for Kōkua Counter.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // Already signed in: skip the form and go to the right place.
  const user = await loadUser();
  if (user) {
    const { next } = await searchParams;
    redirect((next ? isAllowedRedirect(next) : null) ?? roleHome(user.role));
  }

  return (
    <div className="mx-auto grid max-w-5xl items-center gap-10 py-4 md:grid-cols-[1fr_1.05fr] md:py-10">
      <div className="hidden space-y-5 md:block">
        <BrandMark className="size-12" />
        <h1 className="font-serif text-4xl font-semibold leading-tight text-primary">
          Welcome back to the counter.
        </h1>
        <p className="max-w-md text-base leading-relaxed text-muted-foreground">
          Students create a single-use meal pass, eateries scan passes and see today’s meals, and administrators manage the program.
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2"><span aria-hidden="true" className="text-accent">●</span> Students sign in with their @hawaii.edu email.</li>
          <li className="flex gap-2"><span aria-hidden="true" className="text-accent">●</span> Eatery and admin accounts are created by the program team.</li>
        </ul>
      </div>
      <div className="space-y-5">
        <h1 className="font-serif text-3xl font-semibold text-primary md:hidden">Sign in</h1>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <LoginForm />
        </Suspense>
        <p className="text-center text-sm text-muted-foreground">
          Representing a school?{" "}
          <Link href="/school/register" className="font-medium text-primary underline underline-offset-4">
            Register it here
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
