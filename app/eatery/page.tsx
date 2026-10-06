import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Eatery counter",
  description: "Today’s meal pass activity at your participating eatery.",
};

function hawaiiDayRange(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Pacific/Honolulu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const getPart = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const localDate = `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
  const start = new Date(`${localDate}T00:00:00-10:00`);
  return { start: start.toISOString(), end: new Date(start.getTime() + 86_400_000).toISOString() };
}

export default async function EateryPage() {
  const user = await requireRole("eatery");
  const supabase = createClient();
  const { data: eatery, error: eateryError } = await supabase
    .from("eateries")
    .select("id, name, is_active")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (eateryError) throw new Error("Could not load eatery.");

  let acceptedCount = 0;
  if (eatery?.is_active) {
    const range = hawaiiDayRange(new Date());
    const { count, error } = await createAdminClient()
      .from("redemptions")
      .select("id", { count: "exact", head: true })
      .eq("eatery_id", eatery.id)
      .eq("status", "completed")
      .gte("redeemed_at", range.start)
      .lt("redeemed_at", range.end);
    if (error) throw new Error("Could not load today's accepted meals.");
    acceptedCount = count ?? 0;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">Eatery counter</p>
        <h1 className="font-serif text-4xl">{eatery?.name ?? "Eatery account"}</h1>
      </div>
      {!eatery || !eatery.is_active ? (
        <p className="text-muted-foreground">This account does not have an active eatery.</p>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle>Meals accepted today</CardTitle></CardHeader>
            <CardContent><p className="font-serif text-5xl">{acceptedCount}</p></CardContent>
          </Card>
          <Button asChild><Link href="/eatery/scan">Scan meal pass</Link></Button>
        </>
      )}
    </div>
  );
}