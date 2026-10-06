DROP FUNCTION IF EXISTS public.create_qr_hold(UUID, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.create_qr_hold(UUID, TEXT, TIMESTAMPTZ, INTEGER, INTEGER, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.redeem_qr(TEXT, UUID);

CREATE FUNCTION public.create_qr_hold(
  p_student_id UUID,
  p_token_hash TEXT,
  p_expires_at TIMESTAMPTZ,
  p_meals_per_day INTEGER,
  p_passes_generated_per_day INTEGER,
  p_qr_ttl_minutes INTEGER,
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
    OR p_passes_generated_per_day NOT BETWEEN 1 AND 20
    OR p_qr_ttl_minutes NOT BETWEEN 1 AND 180 THEN
    RAISE EXCEPTION 'invalid pass limit configuration';
  END IF;

  SELECT * INTO v_student
  FROM public.users
  WHERE id = p_student_id
  FOR UPDATE;

  IF NOT FOUND OR v_student.role <> 'student' OR v_student.is_active IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'not_eligible');
  END IF;

  IF p_expires_at <= p_now
    OR p_expires_at > p_now + make_interval(mins => p_qr_ttl_minutes) THEN
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

  SELECT COUNT(*)::INTEGER INTO v_daily_passes
  FROM public.qr_codes
  WHERE student_user_id = p_student_id
    AND (created_at AT TIME ZONE 'Pacific/Honolulu')::DATE = v_local_day;

  IF v_daily_passes >= p_passes_generated_per_day THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'too_many_attempts');
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

REVOKE ALL ON FUNCTION public.create_qr_hold(
  UUID, TEXT, TIMESTAMPTZ, INTEGER, INTEGER, INTEGER, TIMESTAMPTZ
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_qr_hold(
  UUID, TEXT, TIMESTAMPTZ, INTEGER, INTEGER, INTEGER, TIMESTAMPTZ
) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_qr_hold(
  UUID, TEXT, TIMESTAMPTZ, INTEGER, INTEGER, INTEGER, TIMESTAMPTZ
) TO service_role;

REVOKE ALL ON FUNCTION public.redeem_qr(TEXT, UUID, INTEGER, TIMESTAMPTZ) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.redeem_qr(TEXT, UUID, INTEGER, TIMESTAMPTZ) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_qr(TEXT, UUID, INTEGER, TIMESTAMPTZ) TO service_role;

REVOKE ALL ON FUNCTION public.cancel_qr(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_qr(UUID, UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_qr(UUID, UUID) TO service_role;