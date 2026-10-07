import { NextResponse } from "next/server";
import { isAllowedRedirect } from "@/lib/security";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirect = isAllowedRedirect(url.searchParams.get("next")) ?? "/";
  return NextResponse.redirect(new URL(redirect, url.origin));
}
