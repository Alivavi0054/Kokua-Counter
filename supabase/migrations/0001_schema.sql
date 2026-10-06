CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TYPE public.user_role AS ENUM ('student', 'eatery', 'admin');
CREATE TYPE public.contribution_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE public.qr_status AS ENUM ('active', 'redeemed', 'expired', 'cancelled');
CREATE TYPE public.redemption_status AS ENUM ('completed', 'reversed');
CREATE TYPE public.settlement_status AS ENUM ('pending', 'processing', 'paid', 'failed');
CREATE TYPE public.pool_entry_type AS ENUM (
  'credit',
  'hold',
  'release',
  'redemption',
  'refund',
  'refund_reversal'
);

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role public.user_role NOT NULL,
  display_name TEXT NOT NULL,
  public_alias TEXT,
  verified_school_domain TEXT,
  voucher_code_hash TEXT,
  voucher_region TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.eateries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES public.users (id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL,
  island TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  stripe_connect_account_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_user_id UUID REFERENCES public.users (id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  meal_credit_count INTEGER GENERATED ALWAYS AS (amount_cents / 800) STORED,
  currency TEXT NOT NULL DEFAULT 'usd' CHECK (currency = 'usd'),
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  status public.contribution_status NOT NULL DEFAULT 'pending',
  donor_email TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT TRUE,
  refunded_amount_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contributions_refunded_amount_check CHECK (
    refunded_amount_cents >= 0 AND refunded_amount_cents <= amount_cents
  )
);

CREATE TABLE public.qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID NOT NULL REFERENCES public.users (id),
  token_hash TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  meal_value_cents INTEGER NOT NULL DEFAULT 800 CHECK (meal_value_cents = 800),
  status public.qr_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  redeemed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

CREATE TABLE public.redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id UUID NOT NULL UNIQUE REFERENCES public.qr_codes (id),
  student_user_id UUID NOT NULL REFERENCES public.users (id),
  eatery_id UUID NOT NULL REFERENCES public.eateries (id),
  amount_cents INTEGER NOT NULL DEFAULT 800 CHECK (amount_cents = 800),
  status public.redemption_status NOT NULL DEFAULT 'completed',
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reversed_at TIMESTAMPTZ,
  metadata JSONB
);

CREATE TABLE public.pool_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type public.pool_entry_type NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents <> 0),
  contribution_id UUID REFERENCES public.contributions (id) ON DELETE RESTRICT,
  qr_code_id UUID REFERENCES public.qr_codes (id) ON DELETE RESTRICT,
  redemption_id UUID REFERENCES public.redemptions (id) ON DELETE RESTRICT,
  reference_key TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eatery_id UUID NOT NULL REFERENCES public.eateries (id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  stripe_transfer_id TEXT,
  stripe_payout_id TEXT,
  status public.settlement_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX qr_codes_one_active_per_student
  ON public.qr_codes (student_user_id)
  WHERE status = 'active';

CREATE UNIQUE INDEX pool_ledger_reference_key_uidx
  ON public.pool_ledger (reference_key)
  WHERE reference_key IS NOT NULL;

CREATE INDEX users_role_idx ON public.users (role);
CREATE INDEX eateries_owner_user_id_idx ON public.eateries (owner_user_id);
CREATE INDEX eateries_slug_idx ON public.eateries (slug);
CREATE INDEX contributions_stripe_checkout_session_id_idx
  ON public.contributions (stripe_checkout_session_id);
CREATE INDEX contributions_stripe_payment_intent_id_idx
  ON public.contributions (stripe_payment_intent_id);
CREATE INDEX contributions_status_idx ON public.contributions (status);
CREATE INDEX pool_ledger_entry_type_created_at_idx
  ON public.pool_ledger (entry_type, created_at);
CREATE INDEX qr_codes_token_hash_idx ON public.qr_codes (token_hash);
CREATE INDEX qr_codes_status_idx ON public.qr_codes (status);
CREATE INDEX qr_codes_expires_at_idx ON public.qr_codes (expires_at);
CREATE INDEX qr_codes_token_status_expires_idx
  ON public.qr_codes (token_hash, status, expires_at);
CREATE INDEX redemptions_student_user_id_idx ON public.redemptions (student_user_id);
CREATE INDEX redemptions_eatery_id_idx ON public.redemptions (eatery_id);
CREATE INDEX redemptions_student_eatery_idx
  ON public.redemptions (student_user_id, eatery_id);
CREATE INDEX settlements_eatery_id_idx ON public.settlements (eatery_id);
CREATE INDEX settlements_status_idx ON public.settlements (status);
CREATE INDEX settlements_eatery_status_idx ON public.settlements (eatery_id, status);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER eateries_set_updated_at
  BEFORE UPDATE ON public.eateries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER contributions_set_updated_at
  BEFORE UPDATE ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER settlements_set_updated_at
  BEFORE UPDATE ON public.settlements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE VIEW public.pool_balance AS
SELECT COALESCE(SUM(amount_cents), 0)::BIGINT AS available_balance_cents
FROM public.pool_ledger;

CREATE VIEW public.public_eateries AS
SELECT name, slug, island, address
FROM public.eateries
WHERE is_active = TRUE;
