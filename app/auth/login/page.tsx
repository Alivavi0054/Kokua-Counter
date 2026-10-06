import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="font-serif text-4xl">Sign in</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
