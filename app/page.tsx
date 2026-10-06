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
          Fund a meal. Students pick it up where they already eat.
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Each $8 donation adds one meal credit to a shared pool. Verified
          University of Hawaiʻi students redeem a single-use meal pass at
          participating eateries.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" asChild>
            <Link href="/donate">Donate a meal</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/auth/login">Student sign in</Link>
          </Button>
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
    </div>
  );
}
