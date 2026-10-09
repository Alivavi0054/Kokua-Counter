import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Meal pass history",
  description: "Review your Kōkua Counter meal pass history.",
};

const statusVariant: Record<string, "success" | "info" | "outline"> = {
  redeemed: "success",
  active: "info",
};

export default async function StudentHistoryPage() {
  const user = await requireRole("student");
  const supabase = await createClient();
  const { data: passes, error } = await supabase
    .from("qr_codes")
    .select("id, status, created_at, expires_at, redeemed_at")
    .eq("student_user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error("Could not load meal history.");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        eyebrow="Student"
        title="Meal pass history"
        actions={<Button asChild variant="outline"><Link href="/student">Back to my pass</Link></Button>}
      />
      {!passes?.length ? (
        <EmptyState title="No passes yet">Your meal pass history will appear here after you request your first pass.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {passes.map((pass) => (
            <li key={pass.id}>
              <Card>
                <CardContent className="flex flex-wrap items-start justify-between gap-3 p-5">
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Requested {new Date(pass.created_at).toLocaleString()}</p>
                    {pass.redeemed_at ? <p>Redeemed {new Date(pass.redeemed_at).toLocaleString()}</p> : null}
                    {pass.status === "active" ? <p>Expires {new Date(pass.expires_at).toLocaleString()}</p> : null}
                  </div>
                  <Badge variant={statusVariant[pass.status] ?? "outline"} className="capitalize">
                    {pass.status === "redeemed" ? "Meal redeemed" : pass.status}
                  </Badge>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
