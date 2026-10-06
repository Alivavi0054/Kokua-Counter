CREATE OR REPLACE FUNCTION public.get_pool_balance()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(8242026);
  RETURN COALESCE((SELECT SUM(amount_cents) FROM public.pool_ledger), 0)::BIGINT;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_credit(
  p_contribution_id UUID,
  p_checkout_session_id TEXT,
  p_payment_intent_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount BIGINT;
BEGIN
  PERFORM pg_advisory_xact_lock(8242026);

  SELECT amount_cents INTO v_amount
  FROM public.contributions
  WHERE id = p_contribution_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'contribution_not_found';
  END IF;

  UPDATE public.contributions
  SET
    status = 'completed',
    stripe_checkout_session_id = COALESCE(p_checkout_session_id, stripe_checkout_session_id),
    stripe_payment_intent_id = COALESCE(p_payment_intent_id, stripe_payment_intent_id)
  WHERE id = p_contribution_id
    AND status IN ('pending', 'failed');

  INSERT INTO public.pool_ledger (
    entry_type,
    amount_cents,
    contribution_id,
    reference_key,
    metadata
  ) VALUES (
    'credit',
    v_amount,
    p_contribution_id,
    'stripe-credit:' || p_checkout_session_id,
    jsonb_build_object(
      'checkout_session_id', p_checkout_session_id,
      'payment_intent_id', p_payment_intent_id
    )
  )
  ON CONFLICT (reference_key) WHERE reference_key IS NOT NULL DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_refund(
  p_contribution_id UUID,
  p_stripe_refund_id TEXT,
  p_amount_cents BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount INTEGER;
  v_refunded INTEGER;
  v_inserted UUID;
  v_applied INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(8242026);

  IF p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'refund_amount_must_be_positive';
  END IF;

  SELECT amount_cents, refunded_amount_cents
  INTO v_amount, v_refunded
  FROM public.contributions
  WHERE id = p_contribution_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'contribution_not_found';
  END IF;

  INSERT INTO public.pool_ledger (
    entry_type,
    amount_cents,
    contribution_id,
    reference_key,
    metadata
  ) VALUES (
    'refund',
    -p_amount_cents,
    p_contribution_id,
    'stripe-refund:' || p_stripe_refund_id,
    jsonb_build_object('stripe_refund_id', p_stripe_refund_id)
  )
  ON CONFLICT (reference_key) WHERE reference_key IS NOT NULL DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NULL THEN
    RETURN;
  END IF;

  v_applied := LEAST(p_amount_cents::INTEGER, v_amount - v_refunded);

  UPDATE public.contributions
  SET
    refunded_amount_cents = refunded_amount_cents + v_applied,
    status = CASE
      WHEN refunded_amount_cents + v_applied >= amount_cents THEN 'refunded'::public.contribution_status
      ELSE 'completed'::public.contribution_status
    END
  WHERE id = p_contribution_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_refund_reversal(
  p_stripe_refund_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry public.pool_ledger%ROWTYPE;
  v_inserted UUID;
  v_contribution_id UUID;
  v_new_refunded INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(8242026);

  SELECT * INTO v_entry
  FROM public.pool_ledger
  WHERE reference_key = 'stripe-refund:' || p_stripe_refund_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  INSERT INTO public.pool_ledger (
    entry_type,
    amount_cents,
    contribution_id,
    reference_key,
    metadata
  ) VALUES (
    'refund_reversal',
    ABS(v_entry.amount_cents),
    v_entry.contribution_id,
    'stripe-refund-reversal:' || p_stripe_refund_id,
    jsonb_build_object('stripe_refund_id', p_stripe_refund_id)
  )
  ON CONFLICT (reference_key) WHERE reference_key IS NOT NULL DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NULL THEN
    RETURN;
  END IF;

  v_contribution_id := v_entry.contribution_id;

  UPDATE public.contributions
  SET
    refunded_amount_cents = GREATEST(0, refunded_amount_cents - ABS(v_entry.amount_cents)::INTEGER),
    status = 'completed'
  WHERE id = v_contribution_id
  RETURNING refunded_amount_cents INTO v_new_refunded;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_qr(
  p_qr_id UUID,
  p_student_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qr public.qr_codes%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(8242026);

  SELECT * INTO v_qr
  FROM public.qr_codes
  WHERE id = p_qr_id
    AND student_user_id = p_student_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'not_found');
  END IF;

  IF v_qr.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', TRUE, 'status', 'cancelled');
  END IF;

  IF v_qr.status IN ('redeemed', 'expired') THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'unavailable');
  END IF;

  UPDATE public.qr_codes
  SET status = 'cancelled', cancelled_at = now()
  WHERE id = p_qr_id;

  INSERT INTO public.pool_ledger (
    entry_type,
    amount_cents,
    qr_code_id,
    reference_key,
    metadata
  ) VALUES (
    'release',
    800,
    p_qr_id,
    'release:' || p_qr_id::TEXT,
    jsonb_build_object('reason', 'cancelled')
  )
  ON CONFLICT (reference_key) WHERE reference_key IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object('ok', TRUE, 'status', 'cancelled');
END;
$$;

CREATE OR REPLACE FUNCTION public.release_expired_qr(p_qr_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qr public.qr_codes%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(8242026);

  SELECT * INTO v_qr
  FROM public.qr_codes
  WHERE id = p_qr_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_qr.status = 'active' AND v_qr.expires_at <= now() THEN
    UPDATE public.qr_codes
    SET status = 'expired'
    WHERE id = p_qr_id;
  ELSIF v_qr.status <> 'expired' THEN
    RETURN;
  END IF;

  INSERT INTO public.pool_ledger (
    entry_type,
    amount_cents,
    qr_code_id,
    reference_key,
    metadata
  ) VALUES (
    'release',
    800,
    p_qr_id,
    'release:' || p_qr_id::TEXT,
    jsonb_build_object('reason', 'expired')
  )
  ON CONFLICT (reference_key) WHERE reference_key IS NOT NULL DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_stale_qrs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qr RECORD;
  v_count INTEGER := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(8242026);

  FOR v_qr IN
    SELECT id
    FROM public.qr_codes
    WHERE status = 'active'
      AND expires_at <= now()
  LOOP
    PERFORM public.release_expired_qr(v_qr.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_qr_hold(
  p_student_id UUID,
  p_token_hash TEXT,
  p_expires_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student public.users%ROWTYPE;
  v_stale RECORD;
  v_qr_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(8242026);

  SELECT * INTO v_student
  FROM public.users
  WHERE id = p_student_id
  FOR UPDATE;

  IF NOT FOUND OR v_student.role <> 'student' OR v_student.is_active IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'not_eligible');
  END IF;

  IF p_expires_at <= now() OR p_expires_at > now() + INTERVAL '15 minutes' THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'not_eligible');
  END IF;

  FOR v_stale IN
    SELECT id
    FROM public.qr_codes
    WHERE student_user_id = p_student_id
      AND status = 'active'
      AND expires_at <= now()
  LOOP
    PERFORM public.release_expired_qr(v_stale.id);
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM public.qr_codes
    WHERE student_user_id = p_student_id
      AND status = 'active'
      AND expires_at > now()
  ) THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'already_active');
  END IF;

  IF public.get_pool_balance() < 800 THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'insufficient_pool');
  END IF;

  INSERT INTO public.qr_codes (
    student_user_id,
    token_hash,
    meal_value_cents,
    status,
    expires_at
  ) VALUES (
    p_student_id,
    p_token_hash,
    800,
    'active',
    p_expires_at
  )
  RETURNING id INTO v_qr_id;

  INSERT INTO public.pool_ledger (
    entry_type,
    amount_cents,
    qr_code_id,
    reference_key,
    metadata
  ) VALUES (
    'hold',
    -800,
    v_qr_id,
    'hold:' || v_qr_id::TEXT,
    jsonb_build_object('student_user_id', p_student_id)
  )
  ON CONFLICT (reference_key) WHERE reference_key IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'qr_id', v_qr_id,
    'expires_at', p_expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_qr(
  p_token_hash TEXT,
  p_eatery_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eatery public.eateries%ROWTYPE;
  v_qr public.qr_codes%ROWTYPE;
  v_redemption_id UUID;
  v_redeemed_at TIMESTAMPTZ;
BEGIN
  PERFORM pg_advisory_xact_lock(8242026);

  SELECT * INTO v_eatery
  FROM public.eateries
  WHERE owner_user_id = p_eatery_user_id
    AND is_active = TRUE
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'unavailable');
  END IF;

  SELECT * INTO v_qr
  FROM public.qr_codes
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'invalid');
  END IF;

  IF v_qr.status = 'redeemed' THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'already_used');
  END IF;

  IF v_qr.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'invalid');
  END IF;

  IF v_qr.status = 'expired' OR v_qr.expires_at <= now() THEN
    PERFORM public.release_expired_qr(v_qr.id);
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'expired');
  END IF;

  IF v_qr.status <> 'active' THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'invalid');
  END IF;

  v_redeemed_at := now();

  INSERT INTO public.redemptions (
    qr_code_id,
    student_user_id,
    eatery_id,
    amount_cents,
    status,
    redeemed_at,
    metadata
  ) VALUES (
    v_qr.id,
    v_qr.student_user_id,
    v_eatery.id,
    800,
    'completed',
    v_redeemed_at,
    jsonb_build_object('eatery_name', v_eatery.name)
  )
  RETURNING id INTO v_redemption_id;

  UPDATE public.qr_codes
  SET status = 'redeemed', redeemed_at = v_redeemed_at
  WHERE id = v_qr.id;

  INSERT INTO public.pool_ledger (
    entry_type,
    amount_cents,
    qr_code_id,
    redemption_id,
    reference_key,
    metadata
  ) VALUES (
    'release',
    800,
    v_qr.id,
    v_redemption_id,
    'release:' || v_qr.id::TEXT,
    jsonb_build_object('reason', 'redeemed')
  )
  ON CONFLICT (reference_key) WHERE reference_key IS NOT NULL DO NOTHING;

  INSERT INTO public.pool_ledger (
    entry_type,
    amount_cents,
    qr_code_id,
    redemption_id,
    reference_key,
    metadata
  ) VALUES (
    'redemption',
    -800,
    v_qr.id,
    v_redemption_id,
    'redemption:' || v_redemption_id::TEXT,
    jsonb_build_object('eatery_id', v_eatery.id)
  )
  ON CONFLICT (reference_key) WHERE reference_key IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'redemption_id', v_redemption_id,
    'eatery_name', v_eatery.name,
    'redeemed_at', v_redeemed_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_pool_balance() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_credit(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_refund(UUID, TEXT, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_refund_reversal(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_qr(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_expired_qr(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_stale_qrs() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_qr_hold(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_qr(TEXT, UUID) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.get_pool_balance() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_credit(UUID, TEXT, TEXT) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_refund(UUID, TEXT, BIGINT) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_refund_reversal(TEXT) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_qr(UUID, UUID) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_expired_qr(UUID) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_stale_qrs() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_qr_hold(UUID, TEXT, TIMESTAMPTZ) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.redeem_qr(TEXT, UUID) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_pool_balance() TO service_role;
GRANT EXECUTE ON FUNCTION public.record_credit(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_refund(UUID, TEXT, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_refund_reversal(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_qr(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_expired_qr(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_stale_qrs() TO service_role;
GRANT EXECUTE ON FUNCTION public.create_qr_hold(UUID, TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_qr(TEXT, UUID) TO service_role;
