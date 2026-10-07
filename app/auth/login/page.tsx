import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Student Login",
  description: "Student, eatery, and administrator login for Kōkua Counter.",
};

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="font-serif text-4xl">Student Login</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
