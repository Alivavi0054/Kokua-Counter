import { EateryScanner } from "@/components/eatery-scanner";
import { requireRole } from "@/lib/auth/guards";

export default async function EateryScanPage() {
  await requireRole("eatery");
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-2">
        <h1 className="font-serif text-3xl">Scan meal pass</h1>
        <p className="text-muted-foreground">Verify each pass once before serving the meal.</p>
      </div>
      <EateryScanner />
    </div>
  );
}