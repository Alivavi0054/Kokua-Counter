export const MEAL_VALUE_CENTS = 800;
export const CURRENCY = "usd" as const;
export const QR_TTL_MINUTES = 30;
export const MAX_DONATION_CENTS = 80_000;
export const HAWAII_EDU_DOMAIN = "hawaii.edu";
export const POOL_LOCK_KEY = 8242026;
export const PRESET_DONATION_CENTS = [800, 2400, 8000] as const;
/** Default operational fee, in basis points (500 = 5%). The live rate lives in the fee_settings table. */
export const DEFAULT_OPERATIONAL_FEE_BPS = 500;
/** Hard ceiling for any configured operational fee (20%). Also enforced by a database CHECK. */
export const MAX_OPERATIONAL_FEE_BPS = 2000;
