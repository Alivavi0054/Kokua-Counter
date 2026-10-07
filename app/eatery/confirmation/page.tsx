import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Pass result",
  description: "Meal pass scan result.",
};

const resultMessages: Record<string, string> = {
  invalid: "This code is not recognized.",
  already_used: "This meal pass has already been used.",
  expired: "This meal pass has expired.",
  unavailable: "Redemption is unavailable for this eatery right now.",
  eatery_limit: "This eatery has reached its daily pass limit. Please contact the team for next steps.",
  try_later: "There have been too many unsuccessful scans. Please wait before trying again.",
};

export default async function EateryConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ redemption_id?: string; result?: string }>;
}) {
  const params = await searchParams;
  await requireRole("eatery");
  if (params.redemption_id) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader className="border-l-4 border-emerald-700 bg-emerald-50 text-emerald-950">
          <CardTitle>Meal pass accepted</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button asChild><Link href="/eatery/scan">Scan next pass</Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader className="border-l-4 border-destructive bg-red-50 text-red-950">
        <CardTitle>Meal pass not accepted</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p role="status">{resultMessages[params.result ?? ""] ?? resultMessages.unavailable}</p>
        <Button asChild><Link href="/eatery/scan">Scan another pass</Link></Button>
      </CardContent>
    </Card>
  );
}