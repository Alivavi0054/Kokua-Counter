import type { Metadata } from "next";
import { EateryScanner } from "@/components/eatery-scanner";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Scan meal pass",
  description: "Scan and verify a single-use Kōkua Counter meal pass.",
};

export default async function EateryScanPage() {
  await requireRole("eatery");
  return (
    <div className="mx-auto min-h-[calc(100vh-12rem)] max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="font-serif text-3xl">Scan meal pass</h1>
        <p className="text-muted-foreground">Verify each pass once before serving the meal.</p>
      </div>
      <EateryScanner />
    </div>
  );
}