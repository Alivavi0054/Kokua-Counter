import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Checkout canceled",
  description: "Your Kōkua Counter checkout was canceled.",
};

export default function DonateCanceledPage() {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="font-serif text-4xl">Checkout canceled</h1>
      <p className="text-muted-foreground">
        No payment was taken. You can start again whenever you are ready.
      </p>
      <Button asChild>
        <Link href="/donate">Return to donate</Link>
      </Button>
    </div>
  );
}
