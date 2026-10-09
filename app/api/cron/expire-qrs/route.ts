import { NextResponse } from "next/server";
import { describeError } from "@/lib/errors";
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
    console.error("cron/expire-qrs: authorization is not configured", describeError(error));
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!validCronSecret(request, secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const expiredCount = await expireStaleQrs();
    return NextResponse.json({ expired_count: expiredCount });
  } catch (error) {
    console.error("cron/expire-qrs: expiry failed", describeError(error));
    return NextResponse.json({ error: "Could not expire meal passes." }, { status: 500 });
  }
}