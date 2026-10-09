"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="mx-auto max-w-xl space-y-5 py-20 text-center" role="alert">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">Something went wrong</p>
      <h1 className="font-serif text-4xl font-semibold text-primary">We hit a snag</h1>
      <p className="text-muted-foreground">Your information is safe. Please try again, or head back home.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild><Link href="/">Back home</Link></Button>
      </div>
    </section>
  );
}
