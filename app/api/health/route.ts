import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const failures: string[] = [];

  let admin;
  try {
    admin = createAdminClient();
    const { error: pingError } = await admin.from("users").select("id").limit(1);
    if (pingError) {
      failures.push("Database is not reachable.");
    }
  } catch (error) {
    failures.push(error instanceof Error && error.message.startsWith("Missing ")
      ? error.message
      : "Database is not reachable.");
  }

  if (admin) {
    try {
      const { data, error } = await admin.rpc("health_check");
      if (error) {
        failures.push("Database schema check failed.");
      } else if (data && typeof data === "object") {
        const payload = data as { ok?: boolean; failures?: string[] };
        if (payload.ok !== true) {
          failures.push("Database schema check failed.");
        }
      }
    } catch (error) {
      failures.push(error instanceof Error && error.message.startsWith("Missing ")
        ? error.message
        : "Database schema check failed.");
    }
  }

  const response = {
    ok: failures.length === 0,
    failures,
  };

  return NextResponse.json(response, { status: failures.length === 0 ? 200 : 503 });
}
