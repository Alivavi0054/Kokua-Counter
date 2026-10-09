import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { describeError } from "@/lib/errors";
import { expireStaleQrs } from "@/lib/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = authorizeCron(request);
  if (!auth.ok) return auth.response;
  try {
    const expiredCount = await expireStaleQrs();
    return NextResponse.json({ expired_count: expiredCount });
  } catch (error) {
    console.error("cron/expire-qrs: expiry failed", describeError(error));
    return NextResponse.json({ error: "Could not expire meal passes." }, { status: 500 });
  }
}
