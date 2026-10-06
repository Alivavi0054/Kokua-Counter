import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-xl space-y-5 py-16 text-center">
      <p className="font-mono text-sm text-primary">404</p>
      <h1 className="font-serif text-4xl">Page not found</h1>
      <p className="text-muted-foreground">That page may have moved or is not available.</p>
      <Button asChild><Link href="/">Return home</Link></Button>
    </section>
  );
}