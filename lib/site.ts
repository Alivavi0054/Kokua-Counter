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
  return process.env.STRIPE_SECRET_KEY?.trim().startsWith("sk_test_") ?? false;
}
