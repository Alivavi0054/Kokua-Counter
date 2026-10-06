import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv } from "@/lib/env";

export async function middleware(request: NextRequest) {
  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const nonce = btoa(Array.from(nonceBytes, (byte) => String.fromCharCode(byte)).join(""));
  const developmentEval = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  const developmentConnections = process.env.NODE_ENV === "development"
    ? " http://127.0.0.1:54321 ws://127.0.0.1:54321 http://localhost:54321 ws://localhost:54321 ws://localhost:3000"
    : "";
  const contentSecurityPolicy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${developmentEval}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com${developmentConnections}`,
    "frame-src https://checkout.stripe.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self' https://checkout.stripe.com",
  ].join("; ");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const addSecurityHeaders = (response: NextResponse) => {
    response.headers.set("Content-Security-Policy", contentSecurityPolicy);
    response.headers.set(
      "Permissions-Policy",
      request.nextUrl.pathname === "/eatery/scan"
        ? "camera=(self), microphone=(), geolocation=()"
        : "camera=(), microphone=(), geolocation=()",
    );
    return response;
  };

  const methodChangesState = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
  const isStripeWebhook = request.nextUrl.pathname === "/api/donate/webhook";
  const devLoginDisabled = request.nextUrl.pathname === "/api/auth/dev-login" &&
    (process.env.NODE_ENV === "production" || process.env.ENABLE_DEV_LOGIN !== "true");
  if (methodChangesState && !isStripeWebhook && !devLoginDisabled) {
    const origin = request.headers.get("origin");
    if (!origin || origin !== request.nextUrl.origin) {
      return addSecurityHeaders(
        NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 }),
      );
    }
  }

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
  const env = getSupabasePublicEnv("Supabase middleware");

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax",
            }),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const needsAuth =
    path.startsWith("/student") ||
    path.startsWith("/eatery") ||
    path.startsWith("/admin");

  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", path);
    return addSecurityHeaders(NextResponse.redirect(url));
  }

  return addSecurityHeaders(supabaseResponse);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
