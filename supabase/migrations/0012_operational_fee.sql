-- Operational fee, refund allocation and platform operations ledger.
--
-- Model (see docs/FINANCE.md):
--   * contributions.amount_cents stays the DONATION PRINCIPAL. The operational fee is charged
--     ON TOP of it and snapshotted per contribution (rate, fee, total). Historical rows keep
--     rate 0 / fee 0: they really were charged exactly their principal, nothing is invented.
--   * pool_ledger keeps tracking the shared meal pool (principal only). It never sees fees.
--   * operations_ledger (new, append-only) tracks platform operating money: fees charged and
--     refunded, processor fees and dispute costs. Net operational revenue = SUM(amount_cents).
--   * refunds (new) is the audit record of every refund: reserved before Stripe is called,
--     finalised only from verified Stripe events, with the principal/fee split stored on it.
--   * disputes (new) tracks chargebacks separately from voluntary refunds.
--
-- All money is integer cents; the fee rate is integer basis points (500 = 5%).

-- ---------------------------------------------------------------------------
-- Fee settings (append-only; the newest row whose effective_at has passed applies)
-- ---------------------------------------------------------------------------
CREATE TABLE public.fee_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_bps INTEGER NOT NULL CHECK (rate_bps >= 0 AND rate_bps <= 2000),
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT,
  created_by UUID REFERENCES public.users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX fee_settings_effective_at_idx ON public.fee_settings (effective_at DESC, created_at DESC);

CREATE OR REPLACE FUNCTION public.append_only_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER fee_settings_append_only
  BEFORE UPDATE OR DELETE ON public.fee_settings
  FOR EACH ROW EXECUTE FUNCTION public.append_only_guard();

-- The launch rate: 5%, effective from the beginning of time so every checkout has a rate.
INSERT INTO public.fee_settings (rate_bps, effective_at, note)
VALUES (500, 'epoch', 'Default 5% operational fee');

-- ---------------------------------------------------------------------------
-- Fee arithmetic (authoritative; lib/fees.ts mirrors it for previews and tests)
-- ---------------------------------------------------------------------------
-- Rounding rule: round half up to the nearest cent, in pure integer arithmetic.
CREATE FUNCTION public.calculate_operational_fee(p_principal_cents BIGINT, p_rate_bps INTEGER)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ((p_principal_cents * p_rate_bps + 5000) / 10000)::INTEGER
$$;

CREATE FUNCTION public.current_fee_rate_bps(p_at TIMESTAMPTZ DEFAULT now())
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT rate_bps
  FROM public.fee_settings
  WHERE effective_at <= p_at
  ORDER BY effective_at DESC, created_at DESC
  LIMIT 1
$$;

-- Splits an amount between principal and fee in proportion to the ORIGINAL payment split.
-- Mirrors allocateRefund() in lib/fees.ts. The final amount that exhausts what remains takes
-- exactly the remaining principal and fee, so rounding remainders always land on the last one.
CREATE FUNCTION public.allocate_refund_components(
  p_principal BIGINT,
  p_fee BIGINT,
  p_principal_used BIGINT,
  p_fee_used BIGINT,
  p_amount BIGINT
)
RETURNS TABLE (principal_cents BIGINT, fee_cents BIGINT)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_rem_principal BIGINT := p_principal - p_principal_used;
  v_rem_fee BIGINT := p_fee - p_fee_used;
  v_rem_total BIGINT := (p_principal - p_principal_used) + (p_fee - p_fee_used);
  v_total BIGINT := p_principal + p_fee;
  v_fee BIGINT;
  v_principal BIGINT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'refund_amount_must_be_positive';
  END IF;
  IF v_rem_principal < 0 OR v_rem_fee < 0 THEN
    RAISE EXCEPTION 'allocation_state_invalid';
  END IF;
  IF p_amount > v_rem_total THEN
    RAISE EXCEPTION 'refund_exceeds_remaining';
  END IF;

  IF p_amount = v_rem_total THEN
    RETURN QUERY SELECT v_rem_principal, v_rem_fee;
    RETURN;
  END IF;

  v_fee := (2 * p_amount * p_fee + v_total) / (2 * v_total);
  v_fee := LEAST(v_fee, v_rem_fee);
  v_principal := p_amount - v_fee;
  IF v_principal > v_rem_principal THEN
    v_principal := v_rem_principal;
    v_fee := p_amount - v_rem_principal;
  END IF;

  RETURN QUERY SELECT v_principal, v_fee;
END;
$$;

-- ---------------------------------------------------------------------------
-- Contribution snapshot columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.contributions
  ADD COLUMN fee_rate_bps INTEGER NOT NULL DEFAULT 0
    CHECK (fee_rate_bps >= 0 AND fee_rate_bps <= 2000),
  ADD COLUMN operational_fee_cents INTEGER NOT NULL DEFAULT 0
    CHECK (operational_fee_cents >= 0),
  ADD COLUMN total_charged_cents INTEGER
    GENERATED ALWAYS AS (amount_cents + operational_fee_cents) STORED,
  ADD COLUMN fee_refunded_cents INTEGER NOT NULL DEFAULT 0
    CHECK (fee_refunded_cents >= 0),
  ADD COLUMN client_request_key TEXT,
  ADD COLUMN failure_reason TEXT,
  ADD CONSTRAINT contributions_fee_refunded_check
    CHECK (fee_refunded_cents <= operational_fee_cents),
  ADD CONSTRAINT contributions_fee_matches_rate_check
    CHECK (operational_fee_cents = ((amount_cents::BIGINT * fee_rate_bps + 5000) / 10000));

CREATE UNIQUE INDEX contributions_client_request_key_uidx
  ON public.contributions (client_request_key)
  WHERE client_request_key IS NOT NULL;

-- The amounts agreed at checkout are immutable; refunds only move the refunded counters.
CREATE FUNCTION public.contributions_snapshot_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.amount_cents IS DISTINCT FROM OLD.amount_cents
     OR NEW.fee_rate_bps IS DISTINCT FROM OLD.fee_rate_bps
     OR NEW.operational_fee_cents IS DISTINCT FROM OLD.operational_fee_cents THEN
    RAISE EXCEPTION 'contribution amount, fee rate and operational fee are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER contributions_snapshot_guard_update
  BEFORE UPDATE ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.contributions_snapshot_guard();

-- ---------------------------------------------------------------------------
-- Operations ledger (append-only). Sign = effect on net operational revenue.
-- ---------------------------------------------------------------------------
CREATE TYPE public.ops_entry_type AS ENUM (
  'fee_charge',
  'fee_refund',
  'fee_refund_reversal',
  'processor_fee',
  'processor_fee_reversal',
  'dispute_fee',
  'dispute_fee_reversal'
);

CREATE TYPE public.refund_status AS ENUM ('requested', 'pending', 'succeeded', 'failed', 'canceled');

CREATE TABLE public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id UUID NOT NULL REFERENCES public.contributions (id) ON DELETE RESTRICT,
  source TEXT NOT NULL DEFAULT 'admin' CHECK (source IN ('admin', 'external')),
  status public.refund_status NOT NULL DEFAULT 'requested',
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  principal_cents INTEGER NOT NULL CHECK (principal_cents >= 0),
  fee_cents INTEGER NOT NULL CHECK (fee_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'usd' CHECK (currency = 'usd'),
  reason TEXT,
  requested_by UUID REFERENCES public.users (id),
  idempotency_ref TEXT,
  stripe_refund_id TEXT,
  failure_code TEXT,
  failure_detail TEXT,
  recovery_obligation_cents INTEGER NOT NULL DEFAULT 0 CHECK (recovery_obligation_cents >= 0),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  reversed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT refunds_components_sum_check CHECK (principal_cents + fee_cents = amount_cents)
);

CREATE UNIQUE INDEX refunds_stripe_refund_id_uidx ON public.refunds (stripe_refund_id) WHERE stripe_refund_id IS NOT NULL;
CREATE UNIQUE INDEX refunds_idempotency_ref_uidx ON public.refunds (idempotency_ref) WHERE idempotency_ref IS NOT NULL;
CREATE INDEX refunds_contribution_id_idx ON public.refunds (contribution_id);
CREATE INDEX refunds_status_idx ON public.refunds (status, requested_at);

CREATE TRIGGER refunds_set_updated_at
  BEFORE UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id UUID NOT NULL REFERENCES public.contributions (id) ON DELETE RESTRICT,
  stripe_dispute_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  principal_cents INTEGER NOT NULL CHECK (principal_cents >= 0),
  fee_cents INTEGER NOT NULL CHECK (fee_cents >= 0),
  dispute_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (dispute_fee_cents >= 0),
  recovery_obligation_cents INTEGER NOT NULL DEFAULT 0 CHECK (recovery_obligation_cents >= 0),
  reason TEXT,
  stripe_status TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT disputes_components_sum_check CHECK (principal_cents + fee_cents <= amount_cents)
);

CREATE INDEX disputes_contribution_id_idx ON public.disputes (contribution_id);
CREATE INDEX disputes_status_idx ON public.disputes (status);

CREATE TRIGGER disputes_set_updated_at
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.operations_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type public.ops_entry_type NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents <> 0),
  contribution_id UUID NOT NULL REFERENCES public.contributions (id) ON DELETE RESTRICT,
  refund_id UUID REFERENCES public.refunds (id) ON DELETE RESTRICT,
  dispute_id UUID REFERENCES public.disputes (id) ON DELETE RESTRICT,
  reference_key TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX operations_ledger_reference_key_uidx
  ON public.operations_ledger (reference_key)
  WHERE reference_key IS NOT NULL;
CREATE INDEX operations_ledger_contribution_id_idx ON public.operations_ledger (contribution_id);
CREATE INDEX operations_ledger_entry_type_created_at_idx ON public.operations_ledger (entry_type, created_at);

CREATE FUNCTION public.operations_ledger_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'operations_ledger is append-only';
  END IF;

  IF NEW.entry_type IN ('fee_charge', 'fee_refund_reversal', 'processor_fee_reversal', 'dispute_fee_reversal')
     AND NEW.amount_cents <= 0 THEN
    RAISE EXCEPTION '% entries must be positive', NEW.entry_type;
  ELSIF NEW.entry_type IN ('fee_refund', 'processor_fee', 'dispute_fee')
     AND NEW.amount_cents >= 0 THEN
    RAISE EXCEPTION '% entries must be negative', NEW.entry_type;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER operations_ledger_before_change
  BEFORE INSERT OR UPDATE OR DELETE ON public.operations_ledger
  FOR EACH ROW EXECUTE FUNCTION public.operations_ledger_guard();

-- Backfill the refund audit table from refunds that pre-date it (principal-only, no fee).
INSERT INTO public.refunds (
  contribution_id, source, status, amount_cents, principal_cents, fee_cents,
  stripe_refund_id, reason, completed_at, reversed_at, requested_at
)
SELECT
  r.contribution_id,
  'external',
  CASE WHEN rev.id IS NULL THEN 'succeeded'::public.refund_status ELSE 'failed'::public.refund_status END,
  (-r.amount_cents)::INTEGER,
  (-r.amount_cents)::INTEGER,
  0,
  substr(r.reference_key, length('stripe-refund:') + 1),
  'backfilled from pool_ledger',
  r.created_at,
  rev.created_at,
  r.created_at
FROM public.pool_ledger r
LEFT JOIN public.pool_ledger rev
  ON rev.reference_key = 'stripe-refund-reversal:' || substr(r.reference_key, length('stripe-refund:') + 1)
WHERE r.entry_type = 'refund'
  AND r.reference_key LIKE 'stripe-refund:%'
  AND r.contribution_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Fee configuration
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.set_operational_fee_rate(
  p_rate_bps INTEGER,
  p_effective_at TIMESTAMPTZ,
  p_created_by UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective TIMESTAMPTZ := COALESCE(p_effective_at, now());
  v_id UUID;
BEGIN
  IF p_rate_bps IS NULL OR p_rate_bps < 0 OR p_rate_bps > 2000 THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'invalid_rate');
  END IF;
  -- Rates apply only to future checkouts: no back-dating, so history is never rewritten.
  IF v_effective < now() - INTERVAL '1 minute' THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'effective_in_past');
  END IF;

  INSERT INTO public.fee_settings (rate_bps, effective_at, note, created_by)
  VALUES (p_rate_bps, GREATEST(v_effective, now()), p_note, p_created_by)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', TRUE, 'id', v_id, 'rate_bps', p_rate_bps);
END;
$$;

-- ---------------------------------------------------------------------------
-- Checkout: the one place the fee is calculated and snapshotted
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.create_contribution(
  p_donor_user_id UUID,
  p_principal_cents INTEGER,
  p_is_anonymous BOOLEAN,
  p_client_request_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate INTEGER;
  v_fee INTEGER;
  v_existing public.contributions%ROWTYPE;
  v_id UUID;
BEGIN
  IF p_principal_cents IS NULL OR p_principal_cents <= 0 THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'invalid_amount');
  END IF;

  IF p_client_request_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.contributions WHERE client_request_key = p_client_request_key;
    IF FOUND THEN
      IF v_existing.amount_cents <> p_principal_cents THEN
        RETURN jsonb_build_object('ok', FALSE, 'error_code', 'request_key_reused');
      END IF;
      RETURN jsonb_build_object(
        'ok', TRUE, 'replay', TRUE,
        'contribution_id', v_existing.id,
        'principal_cents', v_existing.amount_cents,
        'operational_fee_cents', v_existing.operational_fee_cents,
        'total_charged_cents', v_existing.total_charged_cents,
        'fee_rate_bps', v_existing.fee_rate_bps,
        'status', v_existing.status,
        'stripe_checkout_session_id', v_existing.stripe_checkout_session_id
      );
    END IF;
  END IF;

  v_rate := public.current_fee_rate_bps(now());
  IF v_rate IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'fee_not_configured');
  END IF;
  v_fee := public.calculate_operational_fee(p_principal_cents, v_rate);

  INSERT INTO public.contributions (
    donor_user_id, amount_cents, currency, status, is_anonymous,
    fee_rate_bps, operational_fee_cents, client_request_key
  ) VALUES (
    CASE WHEN p_is_anonymous THEN NULL ELSE p_donor_user_id END,
    p_principal_cents, 'usd', 'pending', p_is_anonymous,
    v_rate, v_fee, p_client_request_key
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'ok', TRUE, 'replay', FALSE,
    'contribution_id', v_id,
    'principal_cents', p_principal_cents,
    'operational_fee_cents', v_fee,
    'total_charged_cents', p_principal_cents + v_fee,
    'fee_rate_bps', v_rate,
    'status', 'pending',
    'stripe_checkout_session_id', NULL
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Payment confirmation. Called only from a verified, paid Stripe event.
-- ---------------------------------------------------------------------------
DROP FUNCTION public.record_credit(UUID, TEXT, TEXT);

CREATE FUNCTION public.record_credit(
  p_contribution_id UUID,
  p_checkout_session_id TEXT,
  p_payment_intent_id TEXT,
  p_amount_total_cents BIGINT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_principal BIGINT;
  v_fee BIGINT;
  v_total BIGINT;
BEGIN
  PERFORM pg_advisory_xact_lock(8242026);

  SELECT amount_cents, operational_fee_cents, total_charged_cents
  INTO v_principal, v_fee, v_total
  FROM public.contributions
  WHERE id = p_contribution_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'contribution_not_found';
  END IF;

  IF p_amount_total_cents IS NOT NULL AND p_amount_total_cents <> v_total THEN
    RAISE EXCEPTION 'charged_amount_mismatch';
  END IF;

  UPDATE public.contributions
  SET
    status = 'completed',
    stripe_checkout_session_id = COALESCE(p_checkout_session_id, stripe_checkout_session_id),
    stripe_payment_intent_id = COALESCE(p_payment_intent_id, stripe_payment_intent_id),
    failure_reason = NULL
  WHERE id = p_contribution_id
    AND status IN ('pending', 'failed');

  -- Principal goes to the shared pool; the fee never touches the pool.
  INSERT INTO public.pool_ledger (
    entry_type, amount_cents, contribution_id, reference_key, metadata
  ) VALUES (
    'credit', v_principal, p_contribution_id,
    'stripe-credit:' || p_checkout_session_id,
    jsonb_build_object(
      'checkout_session_id', p_checkout_session_id,
      'payment_intent_id', p_payment_intent_id
    )
  )
  ON CONFLICT (reference_key) WHERE reference_key IS NOT NULL DO NOTHING;

  IF v_fee > 0 THEN
    INSERT INTO public.operations_ledger (
      entry_type, amount_cents, contribution_id, reference_key, metadata
    ) VALUES (
      'fee_charge', v_fee, p_contribution_id,
      'stripe-fee-charge:' || p_checkout_session_id,
      jsonb_build_object('checkout_session_id', p_checkout_session_id, 'payment_intent_id', p_payment_intent_id)
    )
    ON CONFLICT (reference_key) WHERE reference_key IS NOT NULL DO NOTHING;
  END IF;
END;
$$;

CREATE FUNCTION public.record_processor_fee(
  p_contribution_id UUID,
  p_payment_intent_id TEXT,
  p_fee_cents BIGINT,
  p_balance_transaction_id TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(8242026);

  IF p_fee_cents IS NULL OR p_fee_cents < 0 THEN
    RAISE EXCEPTION 'processor_fee_invalid';
  END IF;
  IF p_fee_cents = 0 THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.contributions
    WHERE id = p_contribution_id
      AND status IN ('completed', 'refunded')
      AND stripe_payment_intent_id = p_payment_intent_id
  ) THEN
    RAISE EXCEPTION 'contribution_not_completed';
  END IF;

  -- The processor keeps its fee even when the donor is fully refunded, so this is a plain expense.
  INSERT INTO public.operations_ledger (
    entry_type, amount_cents, contribution_id, reference_key, metadata
  ) VALUES (
    'processor_fee', -p_fee_cents, p_contribution_id,
    'stripe-processor-fee:' || p_payment_intent_id,
    jsonb_build_object('payment_intent_id', p_payment_intent_id, 'balance_transaction_id', p_balance_transaction_id)
  )
  ON CONFLICT (reference_key) WHERE reference_key IS NOT NULL DO NOTHING;
END;
$$;

-- ---------------------------------------------------------------------------
-- Refunds: reserve -> submit to Stripe -> finalise from a verified event
-- ---------------------------------------------------------------------------

-- Principal/fee already spoken for on a contribution: completed refunds and chargebacks (counters),
-- plus refunds that are reserved or pending at Stripe, plus open disputes.
CREATE FUNCTION public.contribution_allocated(p_contribution_id UUID)
RETURNS TABLE (principal_cents BIGINT, fee_cents BIGINT)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    c.refunded_amount_cents::BIGINT
      + COALESCE((SELECT SUM(r.principal_cents) FROM public.refunds r
                  WHERE r.contribution_id = c.id AND r.status IN ('requested', 'pending')), 0)
      + COALESCE((SELECT SUM(d.principal_cents) FROM public.disputes d
                  WHERE d.contribution_id = c.id AND d.status = 'open'), 0),
    c.fee_refunded_cents::BIGINT
      + COALESCE((SELECT SUM(r.fee_cents) FROM public.refunds r
                  WHERE r.contribution_id = c.id AND r.status IN ('requested', 'pending')), 0)
      + COALESCE((SELECT SUM(d.fee_cents) FROM public.disputes d
                  WHERE d.contribution_id = c.id AND d.status = 'open'), 0)
  FROM public.contributions c
  WHERE c.id = p_contribution_id
$$;

CREATE FUNCTION public.reserve_refund(
  p_contribution_id UUID,
  p_amount_cents BIGINT,
  p_reason TEXT,
  p_requested_by UUID,
  p_idempotency_ref TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_c public.contributions%ROWTYPE;
  v_existing public.refunds%ROWTYPE;
  v_used_principal BIGINT;
  v_used_fee BIGINT;
  v_remaining BIGINT;
  v_amount BIGINT;
  v_principal BIGINT;
  v_fee BIGINT;
  v_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(8242026);

  IF p_idempotency_ref IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.refunds WHERE idempotency_ref = p_idempotency_ref;
    IF FOUND THEN
      IF v_existing.contribution_id <> p_contribution_id
         OR (p_amount_cents IS NOT NULL AND v_existing.amount_cents <> p_amount_cents) THEN
        RETURN jsonb_build_object('ok', FALSE, 'error_code', 'idempotency_key_reused');
      END IF;
      RETURN jsonb_build_object(
        'ok', TRUE, 'replay', TRUE, 'refund_id', v_existing.id, 'status', v_existing.status,
        'amount_cents', v_existing.amount_cents, 'principal_cents', v_existing.principal_cents,
        'fee_cents', v_existing.fee_cents, 'stripe_refund_id', v_existing.stripe_refund_id,
        'payment_intent_id', (SELECT stripe_payment_intent_id FROM public.contributions WHERE id = v_existing.contribution_id)
      );
    END IF;
  END IF;

  SELECT * INTO v_c FROM public.contributions WHERE id = p_contribution_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'not_found');
  END IF;
  IF v_c.stripe_payment_intent_id IS NULL OR v_c.status NOT IN ('completed', 'refunded') THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'not_refundable');
  END IF;
  IF EXISTS (SELECT 1 FROM public.disputes WHERE contribution_id = p_contribution_id AND status = 'open') THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'disputed');
  END IF;

  SELECT a.principal_cents, a.fee_cents INTO v_used_principal, v_used_fee
  FROM public.contribution_allocated(p_contribution_id) a;

  v_remaining := (v_c.amount_cents - v_used_principal) + (v_c.operational_fee_cents - v_used_fee);
  IF v_remaining <= 0 THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'nothing_to_refund');
  END IF;

  v_amount := COALESCE(p_amount_cents, v_remaining);
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'invalid_amount');
  END IF;
  IF v_amount > v_remaining THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'exceeds_remaining', 'remaining_cents', v_remaining);
  END IF;

  SELECT a.principal_cents, a.fee_cents INTO v_principal, v_fee
  FROM public.allocate_refund_components(
    v_c.amount_cents, v_c.operational_fee_cents, v_used_principal, v_used_fee, v_amount
  ) a;

  INSERT INTO public.refunds (
    contribution_id, source, status, amount_cents, principal_cents, fee_cents,
    reason, requested_by, idempotency_ref
  ) VALUES (
    p_contribution_id, 'admin', 'requested', v_amount, v_principal, v_fee,
    p_reason, p_requested_by, p_idempotency_ref
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'ok', TRUE, 'replay', FALSE, 'refund_id', v_id, 'status', 'requested',
    'amount_cents', v_amount, 'principal_cents', v_principal, 'fee_cents', v_fee,
    'stripe_refund_id', NULL, 'payment_intent_id', v_c.stripe_payment_intent_id
  );
END;
$$;

CREATE FUNCTION public.mark_refund_submitted(
  p_refund_id UUID,
  p_stripe_refund_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(8242026);

  -- No-op if a webhook already finished (or failed) the refund before we got here.
  UPDATE public.refunds
  SET stripe_refund_id = COALESCE(stripe_refund_id, p_stripe_refund_id),
      status = CASE WHEN status = 'requested' THEN 'pending'::public.refund_status ELSE status END
  WHERE id = p_refund_id;
END;
$$;

CREATE FUNCTION public.mark_refund_failed(
  p_refund_id UUID,
  p_failure_code TEXT,
  p_failure_detail TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(8242026);

  -- Only an un-finalised refund can fail; this releases its reservation.
  UPDATE public.refunds
  SET status = 'failed',
      failure_code = LEFT(p_failure_code, 100),
      failure_detail = LEFT(p_failure_detail, 500)
  WHERE id = p_refund_id
    AND status IN ('requested', 'pending');
END;
$$;

DROP FUNCTION public.record_refund(UUID, TEXT, BIGINT);

-- Applies a provider refund event. p_amount_cents is the TOTAL refunded to the donor.
--   p_provider_status 'pending'   -> registers/updates the refund, no ledger entries
--   p_provider_status 'succeeded' -> books the principal and fee reversals (idempotent)
CREATE FUNCTION public.record_refund(
  p_contribution_id UUID,
  p_stripe_refund_id TEXT,
  p_amount_cents BIGINT,
  p_internal_refund_id UUID DEFAULT NULL,
  p_provider_status TEXT DEFAULT 'succeeded'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_c public.contributions%ROWTYPE;
  v_refund public.refunds%ROWTYPE;
  v_used_principal BIGINT;
  v_used_fee BIGINT;
  v_principal BIGINT;
  v_fee BIGINT;
  v_pool_before BIGINT;
  v_recovery BIGINT;
  v_pool_entry UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(8242026);

  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'refund_amount_must_be_positive';
  END IF;
  IF p_provider_status NOT IN ('pending', 'succeeded') THEN
    RAISE EXCEPTION 'unsupported_provider_status';
  END IF;

  SELECT * INTO v_c FROM public.contributions WHERE id = p_contribution_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'contribution_not_found';
  END IF;
  -- A refund event that outruns the payment event must be retried later, not booked early.
  IF v_c.status NOT IN ('completed', 'refunded') THEN
    RAISE EXCEPTION 'contribution_not_completed';
  END IF;

  SELECT * INTO v_refund FROM public.refunds
  WHERE stripe_refund_id = p_stripe_refund_id
     OR (p_internal_refund_id IS NOT NULL AND id = p_internal_refund_id)
  ORDER BY (stripe_refund_id = p_stripe_refund_id) DESC NULLS LAST
  LIMIT 1;

  IF FOUND THEN
    IF v_refund.contribution_id <> p_contribution_id OR v_refund.amount_cents <> p_amount_cents THEN
      RAISE EXCEPTION 'refund_record_mismatch';
    END IF;
    IF v_refund.status = 'succeeded' THEN
      RETURN;
    END IF;
    IF v_refund.status IN ('failed', 'canceled') AND p_provider_status = 'pending' THEN
      RETURN;
    END IF;
    UPDATE public.refunds
    SET stripe_refund_id = COALESCE(stripe_refund_id, p_stripe_refund_id)
    WHERE id = v_refund.id
    RETURNING * INTO v_refund;
  ELSE
    -- A refund created outside this app (e.g. in the Stripe dashboard): allocate it now.
    SELECT a.principal_cents, a.fee_cents INTO v_used_principal, v_used_fee
    FROM public.contribution_allocated(p_contribution_id) a;

    IF p_amount_cents > (v_c.amount_cents - v_used_principal) + (v_c.operational_fee_cents - v_used_fee) THEN
      RAISE EXCEPTION 'refund_exceeds_unrefunded_amount';
    END IF;

    SELECT a.principal_cents, a.fee_cents INTO v_principal, v_fee
    FROM public.allocate_refund_components(
      v_c.amount_cents, v_c.operational_fee_cents, v_used_principal, v_used_fee, p_amount_cents
    ) a;

    INSERT INTO public.refunds (
      contribution_id, source, status, amount_cents, principal_cents, fee_cents,
      reason, stripe_refund_id
    ) VALUES (
      p_contribution_id, 'external', 'pending', p_amount_cents, v_principal, v_fee,
      'created outside the app', p_stripe_refund_id
    )
    RETURNING * INTO v_refund;
  END IF;

  IF p_provider_status = 'pending' THEN
    UPDATE public.refunds
    SET status = 'pending'
    WHERE id = v_refund.id AND status IN ('requested', 'pending');
    RETURN;
  END IF;

  -- Succeeded: this is the only place a refund hits the ledgers.
  v_pool_before := public.get_pool_balance();
  v_recovery := GREATEST(0, v_refund.principal_cents - GREATEST(v_pool_before, 0));

  IF v_refund.principal_cents > 0 THEN
    INSERT INTO public.pool_ledger (
      entry_type, amount_cents, contribution_id, reference_key, metadata
    ) VALUES (
      'refund', -v_refund.principal_cents, p_contribution_id,
      'stripe-refund:' || p_stripe_refund_id,
      jsonb_build_object('stripe_refund_id', p_stripe_refund_id, 'refund_id', v_refund.id,
                         'component', 'principal', 'total_refund_cents', v_refund.amount_cents)
    )
    ON CONFLICT (reference_key) WHERE reference_key IS NOT NULL DO NOTHING
    RETURNING id INTO v_pool_entry;
  END IF;

  IF v_refund.fee_cents > 0 THEN
    INSERT INTO public.operations_ledger (
      entry_type, amount_cents, contribution_id, refund_id, reference_key, metadata
    ) VALUES (
      'fee_refund', -v_refund.fee_cents, p_contribution_id, v_refund.id,
      'stripe-refund-fee:' || p_stripe_refund_id,
      jsonb_build_object('stripe_refund_id', p_stripe_refund_id, 'component', 'operational_fee')
    )
    ON CONFLICT (reference_key) WHERE reference_key IS NOT NULL DO NOTHING;
  END IF;

  UPDATE public.contributions
  SET
    refunded_amount_cents = refunded_amount_cents + v_refund.principal_cents,
    fee_refunded_cents = fee_refunded_cents + v_refund.fee_cents,
    status = CASE
      WHEN refunded_amount_cents + v_refund.principal_cents >= amount_cents
       AND fee_refunded_cents + v_refund.fee_cents >= operational_fee_cents
        THEN 'refunded'::public.contribution_status
      ELSE 'completed'::public.contribution_status
    END
  WHERE id = p_contribution_id;

  UPDATE public.refunds
  SET status = 'succeeded',
      completed_at = now(),
      recovery_obligation_cents = v_recovery,
      failure_code = NULL,
      failure_detail = NULL
  WHERE id = v_refund.id;
END;
$$;

DROP FUNCTION public.record_refund_reversal(TEXT);

-- A refund the provider later reports as failed or canceled. If it was already booked, reverse
-- the ledger entries (never edit them); if it was only reserved, just release the reservation.
CREATE FUNCTION public.record_refund_reversal(
  p_stripe_refund_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_refund public.refunds%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(8242026);

  SELECT * INTO v_refund FROM public.refunds WHERE stripe_refund_id = p_stripe_refund_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_refund.status IN ('requested', 'pending') THEN
    UPDATE public.refunds SET status = 'failed', failure_code = 'provider_failed' WHERE id = v_refund.id;
    RETURN;
  END IF;

  IF v_refund.status <> 'succeeded' OR v_refund.reversed_at IS NOT NULL THEN
    RETURN;
  END IF;

  IF v_refund.principal_cents > 0 THEN
    INSERT INTO public.pool_ledger (
      entry_type, amount_cents, contribution_id, reference_key, metadata
    ) VALUES (
      'refund_reversal', v_refund.principal_cents, v_refund.contribution_id,
      'stripe-refund-reversal:' || p_stripe_refund_id,
      jsonb_build_object('stripe_refund_id', p_stripe_refund_id, 'refund_id', v_refund.id)
    )
    ON CONFLICT (reference_key) WHERE reference_key IS NOT NULL DO NOTHING;
  END IF;

  IF v_refund.fee_cents > 0 THEN
    INSERT INTO public.operations_ledger (
      entry_type, amount_cents, contribution_id, refund_id, reference_key, metadata
    ) VALUES (
      'fee_refund_reversal', v_refund.fee_cents, v_refund.contribution_id, v_refund.id,
      'stripe-refund-fee-reversal:' || p_stripe_refund_id,
      jsonb_build_object('stripe_refund_id', p_stripe_refund_id)
    )
    ON CONFLICT (reference_key) WHERE reference_key IS NOT NULL DO NOTHING;
  END IF;

  UPDATE public.contributions
  SET refunded_amount_cents = GREATEST(0, refunded_amount_cents - v_refund.principal_cents),
      fee_refunded_cents = GREATEST(0, fee_refunded_cents - v_refund.fee_cents),
      status = 'completed'
  WHERE id = v_refund.contribution_id;

  UPDATE public.refunds
  SET status = 'failed', reversed_at = now(), failure_code = 'provider_reversed'
  WHERE id = v_refund.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Disputes (chargebacks), tracked separately from voluntary refunds
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.record_dispute_fee(
  p_dispute public.disputes,
  p_target_fee_cents INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recorded INTEGER;
  v_delta INTEGER;
BEGIN
  IF p_target_fee_cents IS NULL OR p_target_fee_cents < 0 THEN
    RETURN;
  END IF;
  SELECT dispute_fee_cents INTO v_recorded FROM public.disputes WHERE id = p_dispute.id;
  v_delta := p_target_fee_cents - v_recorded;
  IF v_delta = 0 THEN
    RETURN;
  END IF;

  IF v_delta > 0 THEN
    INSERT INTO public.operations_ledger (entry_type, amount_cents, contribution_id, dispute_id, reference_key, metadata)
    VALUES ('dispute_fee', -v_delta, p_dispute.contribution_id, p_dispute.id,
            'stripe-dispute-fee:' || p_dispute.stripe_dispute_id || ':' || p_target_fee_cents,
            jsonb_build_object('stripe_dispute_id', p_dispute.stripe_dispute_id))
    ON CONFLICT (reference_key) WHERE reference_key IS NOT NULL DO NOTHING;
  ELSE
    INSERT INTO public.operations_ledger (entry_type, amount_cents, contribution_id, dispute_id, reference_key, metadata)
    VALUES ('dispute_fee_reversal', -v_delta, p_dispute.contribution_id, p_dispute.id,
            'stripe-dispute-fee:' || p_dispute.stripe_dispute_id || ':' || p_target_fee_cents,
            jsonb_build_object('stripe_dispute_id', p_dispute.stripe_dispute_id))
    ON CONFLICT (reference_key) WHERE reference_key IS NOT NULL DO NOTHING;
  END IF;

  UPDATE public.disputes SET dispute_fee_cents = p_target_fee_cents WHERE id = p_dispute.id;
END;
$$;

CREATE FUNCTION public.record_dispute_opened(
  p_contribution_id UUID,
  p_stripe_dispute_id TEXT,
  p_amount_cents BIGINT,
  p_reason TEXT,
  p_stripe_status TEXT,
  p_dispute_fee_cents INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_c public.contributions%ROWTYPE;
  v_dispute public.disputes%ROWTYPE;
  v_used_principal BIGINT;
  v_used_fee BIGINT;
  v_remaining BIGINT;
  v_allocated BIGINT;
  v_principal BIGINT;
  v_fee BIGINT;
BEGIN
  PERFORM pg_advisory_xact_lock(8242026);

  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'dispute_amount_invalid';
  END IF;

  SELECT * INTO v_c FROM public.contributions WHERE id = p_contribution_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'contribution_not_found';
  END IF;
  IF v_c.status NOT IN ('completed', 'refunded') THEN
    RAISE EXCEPTION 'contribution_not_completed';
  END IF;

  SELECT * INTO v_dispute FROM public.disputes WHERE stripe_dispute_id = p_stripe_dispute_id;
  IF NOT FOUND THEN
    SELECT a.principal_cents, a.fee_cents INTO v_used_principal, v_used_fee
    FROM public.contribution_allocated(p_contribution_id) a;
    v_remaining := (v_c.amount_cents - v_used_principal) + (v_c.operational_fee_cents - v_used_fee);
    v_allocated := LEAST(p_amount_cents, v_remaining);

    IF v_allocated > 0 THEN
      SELECT a.principal_cents, a.fee_cents INTO v_principal, v_fee
      FROM public.allocate_refund_components(
        v_c.amount_cents, v_c.operational_fee_cents, v_used_principal, v_used_fee, v_allocated
      ) a;
    ELSE
      v_principal := 0;
      v_fee := 0;
    END IF;

    INSERT INTO public.disputes (
      contribution_id, stripe_dispute_id, status, amount_cents, principal_cents, fee_cents, reason, stripe_status
    ) VALUES (
      p_contribution_id, p_stripe_dispute_id, 'open', p_amount_cents, v_principal, v_fee, p_reason, p_stripe_status
    )
    RETURNING * INTO v_dispute;
  ELSE
    UPDATE public.disputes SET stripe_status = p_stripe_status
    WHERE id = v_dispute.id AND status = 'open';
  END IF;

  PERFORM public.record_dispute_fee(v_dispute, p_dispute_fee_cents);
END;
$$;

CREATE FUNCTION public.record_dispute_closed(
  p_stripe_dispute_id TEXT,
  p_outcome TEXT,
  p_dispute_fee_cents INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dispute public.disputes%ROWTYPE;
  v_pool_before BIGINT;
  v_recovery BIGINT;
BEGIN
  PERFORM pg_advisory_xact_lock(8242026);

  IF p_outcome NOT IN ('won', 'lost') THEN
    RAISE EXCEPTION 'unsupported_dispute_outcome';
  END IF;

  SELECT * INTO v_dispute FROM public.disputes WHERE stripe_dispute_id = p_stripe_dispute_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'dispute_not_found';
  END IF;

  PERFORM 1 FROM public.contributions WHERE id = v_dispute.contribution_id FOR UPDATE;

  IF p_dispute_fee_cents IS NOT NULL THEN
    PERFORM public.record_dispute_fee(v_dispute, p_dispute_fee_cents);
  END IF;

  IF v_dispute.status <> 'open' THEN
    RETURN;
  END IF;

  IF p_outcome = 'won' THEN
    UPDATE public.disputes SET status = 'won', closed_at = now() WHERE id = v_dispute.id;
    RETURN;
  END IF;

  -- Lost: the bank took the money back. Book it like a forced refund, but tagged as a chargeback.
  v_pool_before := public.get_pool_balance();
  v_recovery := GREATEST(0, v_dispute.principal_cents - GREATEST(v_pool_before, 0));

  IF v_dispute.principal_cents > 0 THEN
    INSERT INTO public.pool_ledger (entry_type, amount_cents, contribution_id, reference_key, metadata)
    VALUES ('refund', -v_dispute.principal_cents, v_dispute.contribution_id,
            'stripe-dispute-loss:' || p_stripe_dispute_id,
            jsonb_build_object('kind', 'chargeback', 'stripe_dispute_id', p_stripe_dispute_id, 'dispute_id', v_dispute.id))
    ON CONFLICT (reference_key) WHERE reference_key IS NOT NULL DO NOTHING;
  END IF;

  IF v_dispute.fee_cents > 0 THEN
    INSERT INTO public.operations_ledger (entry_type, amount_cents, contribution_id, dispute_id, reference_key, metadata)
    VALUES ('fee_refund', -v_dispute.fee_cents, v_dispute.contribution_id, v_dispute.id,
            'stripe-dispute-loss-fee:' || p_stripe_dispute_id,
            jsonb_build_object('kind', 'chargeback', 'stripe_dispute_id', p_stripe_dispute_id))
    ON CONFLICT (reference_key) WHERE reference_key IS NOT NULL DO NOTHING;
  END IF;

  UPDATE public.contributions
  SET refunded_amount_cents = refunded_amount_cents + v_dispute.principal_cents,
      fee_refunded_cents = fee_refunded_cents + v_dispute.fee_cents,
      status = CASE
        WHEN refunded_amount_cents + v_dispute.principal_cents >= amount_cents
         AND fee_refunded_cents + v_dispute.fee_cents >= operational_fee_cents
          THEN 'refunded'::public.contribution_status
        ELSE 'completed'::public.contribution_status
      END
  WHERE id = v_dispute.contribution_id;

  UPDATE public.disputes
  SET status = 'lost', closed_at = now(), recovery_obligation_cents = v_recovery
  WHERE id = v_dispute.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Reporting and reconciliation (derived from the ledgers, never from running totals)
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.finance_summary()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_principal_credited BIGINT;
  v_principal_refunded BIGINT;
  v_fees_charged BIGINT;
  v_fees_refunded BIGINT;
  v_processor BIGINT;
  v_dispute_fees BIGINT;
  v_net BIGINT;
BEGIN
  SELECT COALESCE(SUM(amount_cents) FILTER (WHERE entry_type = 'credit'), 0),
         COALESCE(-SUM(amount_cents) FILTER (WHERE entry_type = 'refund'), 0)
         - COALESCE(SUM(amount_cents) FILTER (WHERE entry_type = 'refund_reversal'), 0)
  INTO v_principal_credited, v_principal_refunded
  FROM public.pool_ledger;

  SELECT COALESCE(SUM(amount_cents) FILTER (WHERE entry_type = 'fee_charge'), 0),
         COALESCE(-SUM(amount_cents) FILTER (WHERE entry_type = 'fee_refund'), 0)
         - COALESCE(SUM(amount_cents) FILTER (WHERE entry_type = 'fee_refund_reversal'), 0),
         COALESCE(-SUM(amount_cents) FILTER (WHERE entry_type IN ('processor_fee', 'processor_fee_reversal')), 0),
         COALESCE(-SUM(amount_cents) FILTER (WHERE entry_type IN ('dispute_fee', 'dispute_fee_reversal')), 0),
         COALESCE(SUM(amount_cents), 0)
  INTO v_fees_charged, v_fees_refunded, v_processor, v_dispute_fees, v_net
  FROM public.operations_ledger;

  RETURN jsonb_build_object(
    'principal_credited_cents', v_principal_credited,
    'principal_refunded_cents', v_principal_refunded,
    'net_principal_cents', v_principal_credited - v_principal_refunded,
    'chargeback_principal_cents', COALESCE((SELECT SUM(principal_cents) FROM public.disputes WHERE status = 'lost'), 0),
    'fees_charged_cents', v_fees_charged,
    'fees_refunded_cents', v_fees_refunded,
    'net_fees_retained_cents', v_fees_charged - v_fees_refunded,
    'processor_fees_cents', v_processor,
    'dispute_fees_cents', v_dispute_fees,
    'net_operational_revenue_cents', v_net,
    'pool_balance_cents', public.get_pool_balance(),
    'redeemed_value_cents', COALESCE((SELECT SUM(amount_cents) FROM public.redemptions WHERE status = 'completed'), 0),
    'settlements_paid_cents', COALESCE((SELECT SUM(amount_cents) FROM public.settlements WHERE status = 'paid'), 0),
    'settlements_pending_cents', COALESCE((SELECT SUM(amount_cents) FROM public.settlements WHERE status IN ('pending', 'processing')), 0),
    'pending_contributions_count', (SELECT COUNT(*) FROM public.contributions WHERE status = 'pending'),
    'pending_contributions_total_cents', COALESCE((SELECT SUM(total_charged_cents) FROM public.contributions WHERE status = 'pending'), 0),
    'refunds_requested_count', (SELECT COUNT(*) FROM public.refunds WHERE status = 'requested'),
    'refunds_pending_count', (SELECT COUNT(*) FROM public.refunds WHERE status = 'pending'),
    'refunds_succeeded_count', (SELECT COUNT(*) FROM public.refunds WHERE status = 'succeeded'),
    'refunds_failed_count', (SELECT COUNT(*) FROM public.refunds WHERE status = 'failed'),
    'outstanding_recovery_cents',
      COALESCE((SELECT SUM(recovery_obligation_cents) FROM public.refunds WHERE status = 'succeeded'), 0)
      + COALESCE((SELECT SUM(recovery_obligation_cents) FROM public.disputes WHERE status = 'lost'), 0),
    'disputes_open_count', (SELECT COUNT(*) FROM public.disputes WHERE status = 'open'),
    'disputes_open_principal_cents', COALESCE((SELECT SUM(principal_cents) FROM public.disputes WHERE status = 'open'), 0),
    'disputes_open_fee_cents', COALESCE((SELECT SUM(fee_cents) FROM public.disputes WHERE status = 'open'), 0)
  );
END;
$$;

-- Cross-checks the ledgers against the contribution snapshots. An empty list means they agree.
CREATE FUNCTION public.finance_reconciliation()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issues JSONB := '[]'::JSONB;
  v_row RECORD;
BEGIN
  FOR v_row IN
    SELECT c.id, c.amount_cents, COALESCE(l.credited, 0) AS credited
    FROM public.contributions c
    LEFT JOIN (
      SELECT contribution_id, SUM(amount_cents) AS credited FROM public.pool_ledger
      WHERE entry_type = 'credit' GROUP BY contribution_id
    ) l ON l.contribution_id = c.id
    WHERE (c.status IN ('completed', 'refunded') AND COALESCE(l.credited, 0) <> c.amount_cents)
       OR (c.status IN ('pending', 'failed') AND COALESCE(l.credited, 0) <> 0)
  LOOP
    v_issues := v_issues || jsonb_build_object('check', 'principal_credit', 'contribution_id', v_row.id,
      'expected_cents', v_row.amount_cents, 'ledger_cents', v_row.credited);
  END LOOP;

  FOR v_row IN
    SELECT c.id, c.operational_fee_cents, COALESCE(l.charged, 0) AS charged
    FROM public.contributions c
    LEFT JOIN (
      SELECT contribution_id, SUM(amount_cents) AS charged FROM public.operations_ledger
      WHERE entry_type = 'fee_charge' GROUP BY contribution_id
    ) l ON l.contribution_id = c.id
    WHERE (c.status IN ('completed', 'refunded') AND COALESCE(l.charged, 0) <> c.operational_fee_cents)
       OR (c.status IN ('pending', 'failed') AND COALESCE(l.charged, 0) <> 0)
  LOOP
    v_issues := v_issues || jsonb_build_object('check', 'fee_charge', 'contribution_id', v_row.id,
      'expected_cents', v_row.operational_fee_cents, 'ledger_cents', v_row.charged);
  END LOOP;

  FOR v_row IN
    SELECT c.id, c.refunded_amount_cents,
           COALESCE(-SUM(l.amount_cents) FILTER (WHERE l.entry_type = 'refund'), 0)
             - COALESCE(SUM(l.amount_cents) FILTER (WHERE l.entry_type = 'refund_reversal'), 0) AS ledger_refunded
    FROM public.contributions c
    LEFT JOIN public.pool_ledger l ON l.contribution_id = c.id
    GROUP BY c.id, c.refunded_amount_cents
    HAVING c.refunded_amount_cents <> COALESCE(-SUM(l.amount_cents) FILTER (WHERE l.entry_type = 'refund'), 0)
             - COALESCE(SUM(l.amount_cents) FILTER (WHERE l.entry_type = 'refund_reversal'), 0)
  LOOP
    v_issues := v_issues || jsonb_build_object('check', 'principal_refunded', 'contribution_id', v_row.id,
      'expected_cents', v_row.refunded_amount_cents, 'ledger_cents', v_row.ledger_refunded);
  END LOOP;

  FOR v_row IN
    SELECT c.id, c.fee_refunded_cents,
           COALESCE(-SUM(l.amount_cents) FILTER (WHERE l.entry_type = 'fee_refund'), 0)
             - COALESCE(SUM(l.amount_cents) FILTER (WHERE l.entry_type = 'fee_refund_reversal'), 0) AS ledger_refunded
    FROM public.contributions c
    LEFT JOIN public.operations_ledger l ON l.contribution_id = c.id
    GROUP BY c.id, c.fee_refunded_cents
    HAVING c.fee_refunded_cents <> COALESCE(-SUM(l.amount_cents) FILTER (WHERE l.entry_type = 'fee_refund'), 0)
             - COALESCE(SUM(l.amount_cents) FILTER (WHERE l.entry_type = 'fee_refund_reversal'), 0)
  LOOP
    v_issues := v_issues || jsonb_build_object('check', 'fee_refunded', 'contribution_id', v_row.id,
      'expected_cents', v_row.fee_refunded_cents, 'ledger_cents', v_row.ledger_refunded);
  END LOOP;

  RETURN jsonb_build_object('ok', jsonb_array_length(v_issues) = 0, 'issues', v_issues);
END;
$$;

-- Completed payments whose Stripe processing fee has not been recorded yet (reconciliation work list).
CREATE FUNCTION public.contributions_missing_processor_fee(p_limit INTEGER DEFAULT 25)
RETURNS TABLE (contribution_id UUID, payment_intent_id TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.stripe_payment_intent_id
  FROM public.contributions c
  WHERE c.status IN ('completed', 'refunded')
    AND c.stripe_payment_intent_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.operations_ledger l
      WHERE l.reference_key = 'stripe-processor-fee:' || c.stripe_payment_intent_id
    )
  ORDER BY c.created_at
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 25), 200))
$$;

-- ---------------------------------------------------------------------------
-- Privileges: everything here is service-role only. RLS is on with no client policies.
-- ---------------------------------------------------------------------------
ALTER TABLE public.fee_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operations_ledger ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.fee_settings, public.refunds, public.disputes, public.operations_ledger
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.fee_settings, public.refunds, public.disputes, public.operations_ledger TO service_role;

-- Fee arithmetic is pure and harmless; the current rate is public information shown at checkout.
GRANT EXECUTE ON FUNCTION public.calculate_operational_fee(BIGINT, INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_fee_rate_bps(TIMESTAMPTZ) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.allocate_refund_components(BIGINT, BIGINT, BIGINT, BIGINT, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.contribution_allocated(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_operational_fee_rate(INTEGER, TIMESTAMPTZ, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_contribution(UUID, INTEGER, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_credit(UUID, TEXT, TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_processor_fee(UUID, TEXT, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_refund(UUID, BIGINT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_refund_submitted(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_refund_failed(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_refund(UUID, TEXT, BIGINT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_refund_reversal(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_dispute_fee(public.disputes, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_dispute_opened(UUID, TEXT, BIGINT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_dispute_closed(TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finance_summary() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finance_reconciliation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.contributions_missing_processor_fee(INTEGER) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.allocate_refund_components(BIGINT, BIGINT, BIGINT, BIGINT, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.contribution_allocated(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_operational_fee_rate(INTEGER, TIMESTAMPTZ, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_contribution(UUID, INTEGER, BOOLEAN, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_credit(UUID, TEXT, TEXT, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_processor_fee(UUID, TEXT, BIGINT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_refund(UUID, BIGINT, TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_refund_submitted(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_refund_failed(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_refund(UUID, TEXT, BIGINT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_refund_reversal(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_dispute_fee(public.disputes, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_dispute_opened(UUID, TEXT, BIGINT, TEXT, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_dispute_closed(TEXT, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.finance_summary() TO service_role;
GRANT EXECUTE ON FUNCTION public.finance_reconciliation() TO service_role;
GRANT EXECUTE ON FUNCTION public.contributions_missing_processor_fee(INTEGER) TO service_role;
