import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DonateSuccessPage() {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="font-serif text-4xl">Mahalo</h1>
      <p className="text-muted-foreground">
        If the payment completed, meal credits will be added to the shared pool
        once Stripe confirms it. You can close this page.
      </p>
      <Button asChild>
        <Link href="/">Back home</Link>
      </Button>
    </div>
  );
}
