import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Meal pass history",
  description: "Review your Kōkua Counter meal pass history.",
};

export default async function StudentHistoryPage() {
  const user = await requireRole("student");
  const supabase = createClient();
  const { data: passes, error } = await supabase
    .from("qr_codes")
    .select("id, status, created_at, expires_at, redeemed_at")
    .eq("student_user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error("Could not load meal history.");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-serif text-3xl">Meal pass history</h1>
      {!passes?.length ? (
        <p className="text-muted-foreground">Your meal pass history will appear here.</p>
      ) : (
        <div className="space-y-3">
          {passes.map((pass) => (
            <Card key={pass.id}>
              <CardHeader><CardTitle className="text-lg">{pass.status === "redeemed" ? "Meal redeemed" : `Pass ${pass.status}`}</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <p>Requested {new Date(pass.created_at).toLocaleString()}</p>
                {pass.redeemed_at ? <p>Redeemed {new Date(pass.redeemed_at).toLocaleString()}</p> : null}
                {pass.status === "active" ? <p>Expires {new Date(pass.expires_at).toLocaleString()}</p> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}