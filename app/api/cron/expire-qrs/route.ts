import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { expireStaleQrs } from "@/lib/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validCronSecret(request: Request, secret: string) {
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  return suppliedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export async function GET(request: Request) {
  const { CRON_SECRET } = getServerEnv();
  if (!validCronSecret(request, CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const expiredCount = await expireStaleQrs();
    return NextResponse.json({ expired_count: expiredCount });
  } catch {
    return NextResponse.json({ error: "Could not expire meal passes." }, { status: 500 });
  }
}