import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = createClient();
  const { data: eateries } = await supabase
    .from("public_eateries")
    .select("name, slug, island, address")
    .order("name");

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-widest text-primary">
          Shared meal credits
        </p>
        <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
          Kōkua Counter
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Shared meal credits for University of Hawaiʻi students at participating Hawaiʻi eateries.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" asChild>
            <Link href="/donate">Donate a meal</Link>
          </Button>
          <Link className="inline-flex min-h-11 items-center px-3 font-medium text-primary underline-offset-4 hover:underline" href="/auth/login">Student sign in</Link>
        </div>
      </section>

      <section className="grid gap-8 border-y py-8 md:grid-cols-2">
        <div className="space-y-4">
          <h2 className="font-serif text-2xl">For donors</h2>
          <ol className="space-y-3">
            <li><span className="font-semibold">01</span> Choose an amount starting at $8.</li>
            <li><span className="font-semibold">02</span> Complete secure checkout.</li>
            <li><span className="font-semibold">03</span> Your contribution joins the shared meal pool.</li>
          </ol>
        </div>
        <div className="space-y-4">
          <h2 className="font-serif text-2xl">For students</h2>
          <ol className="space-y-3">
            <li><span className="font-semibold">01</span> Sign in with a confirmed `@hawaii.edu` email.</li>
            <li><span className="font-semibold">02</span> Create a single-use meal pass.</li>
            <li><span className="font-semibold">03</span> Show the code at a participating eatery.</li>
          </ol>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-2xl">Participating eateries</h2>
        {!eateries || eateries.length === 0 ? (
          <p className="text-muted-foreground">
            No participating eateries are listed yet.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {eateries.map((eatery) => (
              <Card key={eatery.slug}>
                <CardHeader>
                  <CardTitle className="text-xl">{eatery.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  <p>{eatery.island}</p>
                  <p>{eatery.address}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-2xl">Questions</h2>
        <div className="divide-y border-y">
          <details className="py-4">
            <summary className="cursor-pointer font-medium">How much funds one meal?</summary>
            <p className="mt-2 text-muted-foreground">Each $8 in the shared pool covers one meal credit.</p>
          </details>
          <details className="py-4">
            <summary className="cursor-pointer font-medium">Can donors choose an eatery?</summary>
            <p className="mt-2 text-muted-foreground">Credits are shared across participating eateries; a donor does not choose a recipient or location.</p>
          </details>
          <details className="py-4">
            <summary className="cursor-pointer font-medium">What does the eatery see?</summary>
            <p className="mt-2 text-muted-foreground">The scanner confirms whether a single-use pass is valid. It does not show a student’s name or email.</p>
          </details>
        </div>
      </section>
    </div>
  );
}
