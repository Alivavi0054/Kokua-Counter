import { NextResponse } from "next/server";
import { getCronSecret } from "@/lib/env";
import { expireStaleQrs } from "@/lib/ledger";
import { safeTimingCompare } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validCronSecret(request: Request, secret: string) {
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  return safeTimingCompare(supplied, secret);
}

export async function GET(request: Request) {
  let secret: string;
  try {
    secret = getCronSecret();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron authorization is not configured.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
  if (!validCronSecret(request, secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const expiredCount = await expireStaleQrs();
    return NextResponse.json({ expired_count: expiredCount });
  } catch {
    return NextResponse.json({ error: "Could not expire meal passes." }, { status: 500 });
  }
}