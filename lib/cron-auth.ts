import { NextResponse } from "next/server";
import { describeError } from "@/lib/errors";
import { getCronSecret } from "@/lib/env";
import { safeTimingCompare } from "@/lib/security";

/**
 * Bearer-token check for cron endpoints (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`).
 * A missing secret is a deployment problem: it is logged and answered exactly like a bad token.
 */
export function authorizeCron(request: Request): { ok: true } | { ok: false; response: NextResponse } {
  let secret: string;
  try {
    secret = getCronSecret();
  } catch (error) {
    console.error("cron: authorization is not configured", describeError(error));
    return { ok: false, response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!safeTimingCompare(supplied, secret)) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }
  return { ok: true };
}
