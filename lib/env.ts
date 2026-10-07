import { z } from "zod";

export function requireEnv(name: string, feature: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}; required for ${feature}. Add it to .env.local.`);
  }
  return value;
}

function requireUrl(name: string, feature: string): string {
  const value = requireEnv(name, feature);
  if (!z.string().url().safeParse(value).success) {
    throw new Error(`${name} must be a valid URL for ${feature}.`);
  }
  return value;
}

export function getSupabasePublicEnv(feature: string) {
  return {
    NEXT_PUBLIC_SUPABASE_URL: requireUrl("NEXT_PUBLIC_SUPABASE_URL", feature),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", feature),
  };
}

export function getSupabaseAdminEnv(feature: string) {
  return {
    NEXT_PUBLIC_SUPABASE_URL: requireUrl("NEXT_PUBLIC_SUPABASE_URL", feature),
    SUPABASE_SERVICE_ROLE_KEY: requireEnv("SUPABASE_SERVICE_ROLE_KEY", feature),
  };
}

export function getAppUrl(feature: string): string {
  return requireUrl("APP_URL", feature);
}

export function getStripeSecretKey(): string {
  return requireEnv("STRIPE_SECRET_KEY", "Stripe API operations");
}

export function getCronSecret(): string {
  return requireEnv("CRON_SECRET", "QR expiry cron authorization");
}

export function isDevLoginEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ENABLE_DEV_LOGIN === "true";
}
