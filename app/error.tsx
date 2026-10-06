"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="mx-auto max-w-xl space-y-5 py-16 text-center" role="alert">
      <h1 className="font-serif text-4xl">Something went wrong</h1>
      <p className="text-muted-foreground">Your information is safe. Please try again.</p>
      <Button onClick={reset}>Try again</Button>
    </section>
  );
}