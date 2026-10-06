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
      failures.push(`Database unreachable: ${pingError.message}`);
    }
  } catch (error) {
    failures.push(`Database unreachable: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (admin) {
    try {
      const { data, error } = await admin.rpc("health_check");
      if (error) {
        failures.push(`Health check failed: ${error.message}`);
      } else if (data && typeof data === "object") {
        const payload = data as { ok?: boolean; failures?: string[] };
        if (payload.ok !== true) {
          failures.push(...(payload.failures ?? ["Database health check failed"]));
        }
      }
    } catch (error) {
      failures.push(`Health check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const response = {
    ok: failures.length === 0,
    failures,
  };

  return NextResponse.json(response, { status: failures.length === 0 ? 200 : 503 });
}
