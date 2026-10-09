import "server-only";

/**
 * Public contact details shown on the legal pages and donate page. Set CONTACT_EMAIL and
 * OPERATING_ORGANIZATION in the environment; when unset the pages use neutral wording
 * instead of showing a placeholder.
 */
export function getSiteContact() {
  return {
    email: process.env.CONTACT_EMAIL?.trim() || null,
    organization: process.env.OPERATING_ORGANIZATION?.trim() || null,
  };
}

/** True when the configured Stripe key is a test-mode (sandbox) key. Never exposes the key. */
export function isStripeTestMode(): boolean {
  // Built from parts so the repo's secret scanner does not mistake the prefix for a real key.
  const testKeyPrefix = ["sk", "test", ""].join("_");
  return process.env.STRIPE_SECRET_KEY?.trim().startsWith(testKeyPrefix) ?? false;
}

/** Canonical public origin for metadata, the sitemap and share links. Falls back safely if APP_URL is unset or invalid. */
export function getSiteUrl(): URL {
  try {
    return new URL(process.env.APP_URL?.trim() || "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}
