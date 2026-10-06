CREATE TABLE public.qr_scan_failures (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  eatery_user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX qr_scan_failures_user_time_idx
  ON public.qr_scan_failures (eatery_user_id, attempted_at DESC);

ALTER TABLE public.qr_scan_failures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qr_scan_failures FROM anon, authenticated;
REVOKE ALL ON public.qr_scan_failures FROM PUBLIC;

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
BEGIN
  PERFORM pg_advisory_xact_lock(8242026);

  IF p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'refund_amount_must_be_positive';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pool_ledger
    WHERE reference_key = 'stripe-refund:' || p_stripe_refund_id
  ) THEN
    RETURN;
  END IF;

  SELECT amount_cents, refunded_amount_cents
  INTO v_amount, v_refunded
  FROM public.contributions
  WHERE id = p_contribution_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'contribution_not_found';
  END IF;

  IF p_amount_cents > v_amount - v_refunded THEN
    RAISE EXCEPTION 'refund_exceeds_unrefunded_amount';
  END IF;

  INSERT INTO public.pool_ledger (
    entry_type, amount_cents, contribution_id, reference_key, metadata
  ) VALUES (
    'refund', -p_amount_cents, p_contribution_id,
    'stripe-refund:' || p_stripe_refund_id,
    jsonb_build_object('stripe_refund_id', p_stripe_refund_id)
  )
  ON CONFLICT (reference_key) WHERE reference_key IS NOT NULL DO NOTHING;

  UPDATE public.contributions
  SET
    refunded_amount_cents = refunded_amount_cents + p_amount_cents::INTEGER,
    status = CASE
      WHEN refunded_amount_cents + p_amount_cents >= amount_cents
        THEN 'refunded'::public.contribution_status
      ELSE 'completed'::public.contribution_status
    END
  WHERE id = p_contribution_id;
END;
$$;

DROP FUNCTION public.create_qr_hold(UUID, TEXT, TIMESTAMPTZ);

CREATE FUNCTION public.create_qr_hold(
  p_student_id UUID,
  p_token_hash TEXT,
  p_expires_at TIMESTAMPTZ,
  p_meals_per_day INTEGER,
  p_passes_generated_per_day INTEGER,
  p_now TIMESTAMPTZ DEFAULT now()
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
  v_local_day DATE;
  v_daily_meals INTEGER;
  v_daily_passes INTEGER;
  v_last_cooldown TIMESTAMPTZ;
BEGIN
  PERFORM pg_advisory_xact_lock(8242026);

  IF p_meals_per_day NOT BETWEEN 1 AND 10
    OR p_passes_generated_per_day NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'invalid daily pass limits';
  END IF;

  SELECT * INTO v_student
  FROM public.users
  WHERE id = p_student_id
  FOR UPDATE;

  IF NOT FOUND OR v_student.role <> 'student' OR v_student.is_active IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'not_eligible');
  END IF;

  IF p_expires_at <= p_now OR p_expires_at > p_now + INTERVAL '15 minutes' THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'not_eligible');
  END IF;

  FOR v_stale IN
    SELECT id
    FROM public.qr_codes
    WHERE student_user_id = p_student_id
      AND status = 'active'
      AND expires_at <= p_now
  LOOP
    PERFORM public.release_expired_qr(v_stale.id);
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM public.qr_codes
    WHERE student_user_id = p_student_id
      AND status = 'active'
      AND expires_at > p_now
  ) THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'active_pass_exists');
  END IF;

  v_local_day := (p_now AT TIME ZONE 'Pacific/Honolulu')::DATE;

  SELECT COUNT(*)::INTEGER INTO v_daily_meals
  FROM public.redemptions
  WHERE student_user_id = p_student_id
    AND status = 'completed'
    AND (redeemed_at AT TIME ZONE 'Pacific/Honolulu')::DATE = v_local_day;

  SELECT v_daily_meals + COUNT(*)::INTEGER INTO v_daily_meals
  FROM public.qr_codes
  WHERE student_user_id = p_student_id
    AND status = 'active'
    AND expires_at > p_now;

  IF v_daily_meals >= p_meals_per_day THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'daily_limit_reached');
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_daily_passes
  FROM public.qr_codes
  WHERE student_user_id = p_student_id
    AND (created_at AT TIME ZONE 'Pacific/Honolulu')::DATE = v_local_day;

  IF v_daily_passes >= p_passes_generated_per_day THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'too_many_attempts');
  END IF;

  SELECT MAX(CASE
    WHEN status = 'cancelled' THEN cancelled_at
    WHEN status = 'expired' THEN expires_at
    ELSE NULL
  END) INTO v_last_cooldown
  FROM public.qr_codes
  WHERE student_user_id = p_student_id
    AND status IN ('cancelled', 'expired');

  IF v_last_cooldown IS NOT NULL AND p_now < v_last_cooldown + INTERVAL '60 seconds' THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'cooldown');
  END IF;

  IF public.get_pool_balance() < 800 THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'pool_unavailable');
  END IF;

  INSERT INTO public.qr_codes (
    student_user_id,
    token_hash,
    meal_value_cents,
    status,
    expires_at,
    created_at
  ) VALUES (
    p_student_id,
    p_token_hash,
    800,
    'active',
    p_expires_at,
    p_now
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

  RETURN jsonb_build_object('ok', TRUE, 'qr_id', v_qr_id, 'expires_at', p_expires_at);
END;
$$;

DROP FUNCTION public.redeem_qr(TEXT, UUID);

CREATE FUNCTION public.redeem_qr(
  p_token_hash TEXT,
  p_eatery_user_id UUID,
  p_eatery_daily_limit INTEGER,
  p_now TIMESTAMPTZ DEFAULT now()
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
  v_redeemed_at TIMESTAMPTZ := p_now;
  v_local_day DATE := (p_now AT TIME ZONE 'Pacific/Honolulu')::DATE;
  v_failures INTEGER;
  v_daily_redemptions INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(8242026);

  IF p_eatery_daily_limit NOT BETWEEN 1 AND 10000 THEN
    RAISE EXCEPTION 'invalid eatery daily limit';
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_failures
  FROM public.qr_scan_failures
  WHERE eatery_user_id = p_eatery_user_id
    AND attempted_at > p_now - INTERVAL '10 minutes';

  IF v_failures >= 20 THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'try_later');
  END IF;

  DELETE FROM public.qr_scan_failures
  WHERE attempted_at < p_now - INTERVAL '10 minutes';

  SELECT * INTO v_eatery
  FROM public.eateries
  WHERE owner_user_id = p_eatery_user_id
    AND is_active = TRUE
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.qr_scan_failures (eatery_user_id, attempted_at)
    VALUES (p_eatery_user_id, p_now);
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'unavailable');
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_daily_redemptions
  FROM public.redemptions
  WHERE eatery_id = v_eatery.id
    AND status = 'completed'
    AND (redeemed_at AT TIME ZONE 'Pacific/Honolulu')::DATE = v_local_day;

  IF v_daily_redemptions >= p_eatery_daily_limit THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'eatery_limit');
  END IF;

  SELECT * INTO v_qr
  FROM public.qr_codes
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.qr_scan_failures (eatery_user_id, attempted_at)
    VALUES (p_eatery_user_id, p_now);
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'invalid');
  END IF;

  IF v_qr.status = 'redeemed' THEN
    INSERT INTO public.qr_scan_failures (eatery_user_id, attempted_at)
    VALUES (p_eatery_user_id, p_now);
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'already_used');
  END IF;

  IF v_qr.status = 'cancelled' THEN
    INSERT INTO public.qr_scan_failures (eatery_user_id, attempted_at)
    VALUES (p_eatery_user_id, p_now);
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'invalid');
  END IF;

  IF v_qr.status = 'expired' OR v_qr.expires_at <= p_now THEN
    PERFORM public.release_expired_qr(v_qr.id);
    INSERT INTO public.qr_scan_failures (eatery_user_id, attempted_at)
    VALUES (p_eatery_user_id, p_now);
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'expired');
  END IF;

  IF v_qr.status <> 'active' THEN
    INSERT INTO public.qr_scan_failures (eatery_user_id, attempted_at)
    VALUES (p_eatery_user_id, p_now);
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'invalid');
  END IF;

  v_redeemed_at := p_now;

  INSERT INTO public.redemptions (
    qr_code_id, student_user_id, eatery_id, amount_cents, status, redeemed_at, metadata
  ) VALUES (
    v_qr.id, v_qr.student_user_id, v_eatery.id, 800, 'completed', v_redeemed_at,
    jsonb_build_object('eatery_name', v_eatery.name)
  )
  RETURNING id INTO v_redemption_id;

  UPDATE public.qr_codes
  SET status = 'redeemed', redeemed_at = v_redeemed_at
  WHERE id = v_qr.id;

  INSERT INTO public.pool_ledger (
    entry_type, amount_cents, qr_code_id, redemption_id, reference_key, metadata
  ) VALUES (
    'release', 800, v_qr.id, v_redemption_id, 'release:' || v_qr.id::TEXT,
    jsonb_build_object('reason', 'redeemed')
  )
  ON CONFLICT (reference_key) WHERE reference_key IS NOT NULL DO NOTHING;

  INSERT INTO public.pool_ledger (
    entry_type, amount_cents, qr_code_id, redemption_id, reference_key, metadata
  ) VALUES (
    'redemption', -800, v_qr.id, v_redemption_id, 'redemption:' || v_redemption_id::TEXT,
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
  WHERE id = p_qr_id AND student_user_id = p_student_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'not_found');
  END IF;

  IF v_qr.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', TRUE, 'status', 'cancelled');
  END IF;

  IF v_qr.status <> 'active' OR v_qr.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'unavailable');
  END IF;

  UPDATE public.qr_codes SET status = 'cancelled', cancelled_at = now() WHERE id = p_qr_id;

  INSERT INTO public.pool_ledger (
    entry_type, amount_cents, qr_code_id, reference_key, metadata
  ) VALUES (
    'release', 800, p_qr_id, 'release:' || p_qr_id::TEXT,
    jsonb_build_object('reason', 'cancelled')
  )
  ON CONFLICT (reference_key) WHERE reference_key IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object('ok', TRUE, 'status', 'cancelled');
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
  DELETE FROM public.qr_scan_failures WHERE attempted_at < now() - INTERVAL '10 minutes';

  FOR v_qr IN
    SELECT id
    FROM public.qr_codes
    WHERE status = 'active' AND expires_at <= now()
  LOOP
    PERFORM public.release_expired_qr(v_qr.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_student_profile(
  p_user_id UUID,
  p_display_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email TEXT;
  v_confirmed_at TIMESTAMPTZ;
  v_mailbox TEXT;
  v_identity TEXT;
BEGIN
  SELECT email, email_confirmed_at INTO v_email, v_confirmed_at
  FROM auth.users WHERE id = p_user_id;

  IF v_email IS NULL OR v_confirmed_at IS NULL
    OR lower(substring(v_email from '@([^@]+)$')) <> 'hawaii.edu' THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'email_unverified_or_invalid');
  END IF;

  v_mailbox := split_part(split_part(lower(v_email), '@', 1), '+', 1);
  v_identity := v_mailbox || '@hawaii.edu';
  PERFORM pg_advisory_xact_lock(8242027, hashtext(v_identity));

  IF EXISTS (
    SELECT 1
    FROM public.users existing_profile
    JOIN auth.users existing_auth ON existing_auth.id = existing_profile.id
    WHERE existing_profile.role = 'student'
      AND existing_profile.id <> p_user_id
      AND split_part(split_part(lower(existing_auth.email), '@', 1), '+', 1) || '@hawaii.edu' = v_identity
  ) THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'student_email_already_used');
  END IF;

  INSERT INTO public.users (
    id, role, display_name, public_alias, verified_school_domain, is_active
  ) VALUES (
    p_user_id, 'student', COALESCE(NULLIF(p_display_name, ''), 'Student'),
    COALESCE(NULLIF(p_display_name, ''), 'Student'), 'hawaii.edu', TRUE
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.create_qr_hold(UUID, TEXT, TIMESTAMPTZ, INTEGER, INTEGER, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_qr(TEXT, UUID, INTEGER, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_qr(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_student_profile(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_refund(UUID, TEXT, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_stale_qrs() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.create_qr_hold(UUID, TEXT, TIMESTAMPTZ, INTEGER, INTEGER, TIMESTAMPTZ) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.redeem_qr(TEXT, UUID, INTEGER, TIMESTAMPTZ) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_qr(UUID, UUID) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_student_profile(UUID, TEXT) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_refund(UUID, TEXT, BIGINT) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_stale_qrs() FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_qr_hold(UUID, TEXT, TIMESTAMPTZ, INTEGER, INTEGER, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_qr(TEXT, UUID, INTEGER, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_qr(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_student_profile(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_refund(UUID, TEXT, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_stale_qrs() TO service_role;

DROP POLICY IF EXISTS redemptions_select_student_or_eatery ON public.redemptions;
CREATE POLICY redemptions_select_student_only
  ON public.redemptions
  FOR SELECT
  TO authenticated
  USING (student_user_id = auth.uid());

REVOKE ALL ON public.redemptions FROM anon, authenticated;
GRANT SELECT ON public.redemptions TO authenticated;