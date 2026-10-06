import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

const resultMessages: Record<string, string> = {
  invalid: "This code is not recognized.",
  already_used: "This meal pass has already been used.",
  expired: "This meal pass has expired.",
  unavailable: "Redemption is unavailable for this eatery right now.",
};

export default async function EateryConfirmationPage({
  searchParams,
}: {
  searchParams: { redemption_id?: string; result?: string };
}) {
  await requireRole("eatery");
  const supabase = createClient();
  const redemptionId = searchParams.redemption_id;
  if (redemptionId) {
    const { data: redemption, error } = await supabase
      .from("redemptions")
      .select("id, redeemed_at, metadata")
      .eq("id", redemptionId)
      .eq("status", "completed")
      .maybeSingle();
    if (error) throw new Error("Could not verify redemption.");
    if (!redemption) notFound();
    const metadata = redemption.metadata;
    const eateryName = metadata && typeof metadata === "object" && !Array.isArray(metadata) &&
      typeof metadata.eatery_name === "string" ? metadata.eatery_name : "Participating eatery";
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader><CardTitle>Meal pass accepted</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p>Meal confirmed for {eateryName}.</p>
          <p className="text-sm text-muted-foreground">{new Date(redemption.redeemed_at).toLocaleString()}</p>
          <Button asChild><Link href="/eatery/scan">Scan next pass</Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader><CardTitle>Meal pass not accepted</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p role="status">{resultMessages[searchParams.result ?? ""] ?? resultMessages.unavailable}</p>
        <Button asChild><Link href="/eatery/scan">Scan another pass</Link></Button>
      </CardContent>
    </Card>
  );
}