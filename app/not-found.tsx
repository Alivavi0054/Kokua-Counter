import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-xl space-y-5 py-20 text-center">
      <p className="font-serif text-6xl font-semibold text-accent">404</p>
      <h1 className="font-serif text-3xl font-semibold text-primary">Page not found</h1>
      <p className="text-muted-foreground">That page may have moved or is not available.</p>
      <Button asChild><Link href="/">Return home</Link></Button>
    </section>
  );
}
