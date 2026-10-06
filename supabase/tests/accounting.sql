-- Accounting lifecycle tests. Run after migrations + seed.
-- Wrap in a transaction that rolls back. Raises on any wrong balance.

BEGIN;

DO $$
DECLARE
  v_before BIGINT;
  v_result JSONB;
  v_refund_count INTEGER;
  v_test_now TIMESTAMPTZ := now();
  v_qr_ttl_minutes CONSTANT INTEGER := 30;
  v_refund_rejected BOOLEAN := FALSE;
  v_ledger_ids_before UUID[] := ARRAY[]::UUID[];
  v_scenario_b_rows TEXT;
  v_scenario_b_delta BIGINT;
  v_release_count INTEGER;
  v_student UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
  v_pool_student UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa8';
  v_student_role public.user_role;
  v_student_active BOOLEAN;
  v_qr_rows TEXT;
  v_not_eligible_branch TEXT;
  v_cooldown_now TIMESTAMPTZ;
  v_cooldown_expires TIMESTAMPTZ;
  v_eatery_user UUID;
  v_hash TEXT;
  v_qr UUID;
BEGIN
  SELECT id INTO v_eatery_user FROM auth.users WHERE email = 'eatery@example.com';
  IF v_eatery_user IS NULL THEN
    RAISE EXCEPTION 'run npm run db:seed before accounting verification';
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_student,
    'authenticated',
    'authenticated',
    'acctest@hawaii.edu',
    extensions.crypt('test', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(), now(), '', '', '', ''
  );

  INSERT INTO public.users (id, role, display_name, is_active)
  VALUES (v_student, 'student', 'Acctest', TRUE);

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_pool_student,
    'authenticated',
    'authenticated',
    'pooltest@hawaii.edu',
    extensions.crypt('test', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(), now(), '', '', '', ''
  );
  INSERT INTO public.users (id, role, display_name, is_active)
  VALUES (v_pool_student, 'student', 'Pool test', TRUE);

  IF public.get_pool_balance() < 800 THEN
    v_hash := encode(extensions.digest('token-pool-unavailable', 'sha256'), 'hex');
    v_result := public.create_qr_hold(
      v_pool_student,
      v_hash,
      v_test_now + make_interval(mins => v_qr_ttl_minutes),
      1,
      3,
      v_qr_ttl_minutes,
      v_test_now
    );
    IF v_result ->> 'error_code' <> 'pool_unavailable' THEN
      RAISE EXCEPTION 'pool below 800 cents should return pool_unavailable, got %', v_result;
    END IF;
  END IF;

  -- Scenario A: $8 credit plus one meal has a net pool delta of 0.
  INSERT INTO public.contributions (id, amount_cents, currency, status)
  VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 800, 'usd', 'pending');
  v_before := public.get_pool_balance();
  PERFORM public.record_credit(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    'cs_test_8_meal',
    'pi_test_8_meal'
  );
  IF public.get_pool_balance() - v_before <> 800 THEN
    RAISE EXCEPTION '$8 credit should be +800, got %', v_before;
  END IF;

  v_hash := encode(extensions.digest('token-8-meal', 'sha256'), 'hex');
  v_result := public.create_qr_hold(
    v_student,
    v_hash,
    v_test_now + make_interval(mins => v_qr_ttl_minutes),
    1,
    3,
    v_qr_ttl_minutes,
    v_test_now
  );
  IF COALESCE((v_result ->> 'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION '$8 hold failed: %', v_result;
  END IF;
  v_result := public.redeem_qr(v_hash, v_eatery_user, 200, v_test_now);
  IF COALESCE((v_result ->> 'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION '$8 redeem failed: %', v_result;
  END IF;
  IF public.get_pool_balance() <> v_before THEN
    RAISE EXCEPTION '$8 + meal should be 0, got %', public.get_pool_balance();
  END IF;

  -- Scenario B: $8 credit plus an expired hold has a net pool delta of +800.
  v_test_now := v_test_now + INTERVAL '1 day';
  SELECT COALESCE(array_agg(id), ARRAY[]::UUID[])
  INTO v_ledger_ids_before
  FROM public.pool_ledger;
  v_before := public.get_pool_balance();
  INSERT INTO public.contributions (id, amount_cents, currency, status)
  VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 800, 'usd', 'pending');
  PERFORM public.record_credit(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
    'cs_test_8_expire',
    'pi_test_8_expire'
  );
  v_hash := encode(extensions.digest('token-8-expire', 'sha256'), 'hex');
  v_result := public.create_qr_hold(
    v_student,
    v_hash,
    v_test_now + make_interval(mins => v_qr_ttl_minutes),
    1,
    3,
    v_qr_ttl_minutes,
    v_test_now
  );
  IF COALESCE((v_result ->> 'ok')::BOOLEAN, FALSE) IS TRUE THEN
    v_qr := (v_result ->> 'qr_id')::UUID;
    UPDATE public.qr_codes SET expires_at = now() - INTERVAL '1 second' WHERE id = v_qr;
    PERFORM public.release_expired_qr(v_qr);
  ELSE
    v_qr := NULL;
  END IF;
  SELECT string_agg(
    format('entry_type=%s, amount_cents=%s, reference_key=%s, qr_code_id=%s',
      entry_type, amount_cents, reference_key, qr_code_id),
    E'\n' ORDER BY created_at, id
  ) INTO v_scenario_b_rows
  FROM public.pool_ledger
  WHERE NOT (id = ANY(v_ledger_ids_before));
  v_scenario_b_delta := public.get_pool_balance() - v_before;

  IF COALESCE((v_result ->> 'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'Scenario B create_qr_hold failed: result=%, ledger rows=%',
      v_result, COALESCE(v_scenario_b_rows, '(none)');
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_release_count
  FROM public.pool_ledger
  WHERE entry_type = 'release'
    AND qr_code_id = v_qr
    AND reference_key = 'release:' || v_qr::TEXT;
  IF v_release_count <> 1 THEN
    RAISE EXCEPTION 'Scenario B release assertion failed: qr_id=%, release_count=%, hold_result=%, ledger rows=%',
      v_qr, v_release_count, v_result, COALESCE(v_scenario_b_rows, '(none)');
  END IF;

  IF v_scenario_b_delta <> 800 THEN
    RAISE EXCEPTION '$8 + expired QR should add +800: delta=%, hold_result=%, release_count=%, ledger rows=%',
      v_scenario_b_delta, v_result, v_release_count, COALESCE(v_scenario_b_rows, '(none)');
  END IF;

  -- Scenario C: $24 credit plus one meal has a net pool delta of +1600.
  v_test_now := v_test_now + INTERVAL '1 day';
  v_before := public.get_pool_balance();
  INSERT INTO public.contributions (id, amount_cents, currency, status)
  VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 2400, 'usd', 'pending');
  PERFORM public.record_credit(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3',
    'cs_test_24_meal',
    'pi_test_24_meal'
  );
  v_hash := encode(extensions.digest('token-24-meal', 'sha256'), 'hex');
  v_result := public.create_qr_hold(
    v_student,
    v_hash,
    v_test_now + make_interval(mins => v_qr_ttl_minutes),
    1,
    3,
    v_qr_ttl_minutes,
    v_test_now
  );
  IF COALESCE((v_result ->> 'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION '$24 hold failed: %', v_result;
  END IF;
  v_result := public.redeem_qr(v_hash, v_eatery_user, 200, v_test_now);
  IF COALESCE((v_result ->> 'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION '$24 redeem failed: %', v_result;
  END IF;
  IF public.get_pool_balance() - v_before <> 1600 THEN
    RAISE EXCEPTION '$24 + one meal should add +1600, got delta %',
      public.get_pool_balance() - v_before;
  END IF;

  -- Scenario D: $24 credit plus an unused full refund has a net pool delta of 0.
  v_before := public.get_pool_balance();
  INSERT INTO public.contributions (id, amount_cents, currency, status)
  VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 2400, 'usd', 'pending');
  PERFORM public.record_credit(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4',
    'cs_test_24_refund_unused',
    'pi_test_24_refund_unused'
  );
  PERFORM public.record_refund(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4',
    're_test_unused',
    2400
  );
  IF public.get_pool_balance() - v_before <> 0 THEN
    RAISE EXCEPTION '$24 + full refund unused should add 0, got delta %',
      public.get_pool_balance() - v_before;
  END IF;

  -- Scenario E: $24 credit, one meal, then full refund has a net pool delta of -800.
  v_test_now := v_test_now + INTERVAL '1 day';
  v_before := public.get_pool_balance();
  INSERT INTO public.contributions (id, amount_cents, currency, status)
  VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5', 2400, 'usd', 'pending');
  PERFORM public.record_credit(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5',
    'cs_test_24_meal_refund',
    'pi_test_24_meal_refund'
  );
  v_hash := encode(extensions.digest('token-24-meal-refund', 'sha256'), 'hex');
  v_result := public.create_qr_hold(
    v_student,
    v_hash,
    v_test_now + make_interval(mins => v_qr_ttl_minutes),
    1,
    3,
    v_qr_ttl_minutes,
    v_test_now
  );
  IF COALESCE((v_result ->> 'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'meal+refund hold failed: %', v_result;
  END IF;
  v_result := public.redeem_qr(v_hash, v_eatery_user, 200, v_test_now);
  IF COALESCE((v_result ->> 'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'meal+refund redeem failed: %', v_result;
  END IF;
  PERFORM public.record_refund(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5',
    're_test_meal_refund',
    2400
  );
  IF public.get_pool_balance() - v_before <> -800 THEN
    RAISE EXCEPTION '$24 + meal + full refund should add -800, got delta %',
      public.get_pool_balance() - v_before;
  END IF;

  -- Scenario F: replaying the same refund creates no additional ledger delta.
  PERFORM public.record_refund(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5',
    're_test_meal_refund',
    2400
  );
  SELECT COUNT(*)::INTEGER INTO v_refund_count
  FROM public.pool_ledger
  WHERE reference_key = 'stripe-refund:re_test_meal_refund';
  IF v_refund_count <> 1 THEN
    RAISE EXCEPTION 'duplicate refund webhook must insert exactly one refund entry, got %',
      v_refund_count;
  END IF;

  -- Scenario G: partial then remaining refund nets the $24 credit back to 0.
  INSERT INTO public.contributions (id, amount_cents, currency, status)
  VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb8', 2400, 'usd', 'pending');
  PERFORM public.record_credit(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb8', 'cs_test_partial_refund', 'pi_test_partial_refund'
  );
  v_before := public.get_pool_balance();
  PERFORM public.record_refund(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb8', 're_test_partial', 800
  );
  PERFORM public.record_refund(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb8', 're_test_partial', 800
  );
  IF (SELECT refunded_amount_cents FROM public.contributions
      WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb8') <> 800
    OR public.get_pool_balance() - v_before <> -800 THEN
    RAISE EXCEPTION 'partial refund and replay should debit exactly 800 cents';
  END IF;

  -- This second refund is the remaining $16; the two refunds together return $24.
  v_before := public.get_pool_balance();
  PERFORM public.record_refund(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb8', 're_test_partial_remainder', 1600
  );
  IF (SELECT status FROM public.contributions
      WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb8') <> 'refunded'
    OR public.get_pool_balance() - v_before <> -1600 THEN
    RAISE EXCEPTION 'remaining refund should complete the full refund';
  END IF;

  BEGIN
    PERFORM public.record_refund(
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb8', 're_test_over_refund', 1
    );
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    v_refund_rejected := TRUE;
  END;
  IF NOT v_refund_rejected THEN
    RAISE EXCEPTION 'over-refund should be rejected';
  END IF;
END;
$$;

DO $$
DECLARE
  v_daily_student UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2';
  v_pass_student UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3';
  v_eatery_user UUID;
  v_now TIMESTAMPTZ := now() + INTERVAL '10 days';
  v_pass_now TIMESTAMPTZ := now();
  v_qr_ttl_minutes CONSTANT INTEGER := 30;
  v_hash TEXT;
  v_result JSONB;
  v_qr UUID;
  v_held_balance BIGINT;
  v_released_balance BIGINT;
  v_index INTEGER;
BEGIN
  SELECT id INTO v_eatery_user FROM auth.users WHERE email = 'eatery@example.com';
  IF v_eatery_user IS NULL THEN
    RAISE EXCEPTION 'run npm run db:seed before accounting verification';
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES
    (
      '00000000-0000-0000-0000-000000000000', v_daily_student, 'authenticated', 'authenticated',
      'dailytest@hawaii.edu', extensions.crypt('test', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now(), '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000', v_pass_student, 'authenticated', 'authenticated',
      'passtest@hawaii.edu', extensions.crypt('test', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now(), '', '', '', ''
    );

  INSERT INTO public.users (id, role, display_name, is_active)
  VALUES
    (v_daily_student, 'student', 'Daily test', TRUE),
    (v_pass_student, 'student', 'Pass test', TRUE);

  INSERT INTO public.contributions (id, amount_cents, currency, status)
  VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb6', 4000, 'usd', 'pending');
  PERFORM public.record_credit(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb6', 'cs_test_daily_limits', 'pi_test_daily_limits'
  );

  v_hash := encode(extensions.digest('daily-first-meal', 'sha256'), 'hex');
  v_result := public.create_qr_hold(
    v_daily_student,
    v_hash,
    v_now + make_interval(mins => v_qr_ttl_minutes),
    1,
    3,
    v_qr_ttl_minutes,
    v_now
  );
  IF v_result ->> 'ok' <> 'true' THEN
    RAISE EXCEPTION 'first daily pass failed: %', v_result;
  END IF;
  v_result := public.redeem_qr(v_hash, v_eatery_user, 200, v_now);
  IF v_result ->> 'ok' <> 'true' THEN
    RAISE EXCEPTION 'first daily redemption failed: %', v_result;
  END IF;

  v_hash := encode(extensions.digest('daily-second-meal', 'sha256'), 'hex');
  v_result := public.create_qr_hold(
    v_daily_student,
    v_hash,
    v_now + make_interval(mins => v_qr_ttl_minutes + 2),
    1,
    3,
    v_qr_ttl_minutes,
    v_now + INTERVAL '2 minutes'
  );
  IF v_result ->> 'error_code' <> 'daily_limit_reached' THEN
    RAISE EXCEPTION 'second same-day meal should be rejected: %', v_result;
  END IF;

  v_hash := encode(extensions.digest('daily-reset-next-day', 'sha256'), 'hex');
  v_result := public.create_qr_hold(
    v_daily_student,
    v_hash,
    v_now + INTERVAL '1 day' + make_interval(mins => v_qr_ttl_minutes),
    1,
    3,
    v_qr_ttl_minutes,
    v_now + INTERVAL '1 day'
  );
  IF v_result ->> 'ok' <> 'true' THEN
    RAISE EXCEPTION 'daily meal limit did not reset on the next Honolulu day: %', v_result;
  END IF;
  PERFORM public.cancel_qr((v_result ->> 'qr_id')::UUID, v_daily_student);

  FOR v_index IN 1..3 LOOP
    v_hash := encode(extensions.digest('generated-pass-' || v_index::TEXT, 'sha256'), 'hex');
    v_result := public.create_qr_hold(
      v_pass_student,
      v_hash,
      v_pass_now + make_interval(mins => v_qr_ttl_minutes),
      1,
      3,
      v_qr_ttl_minutes,
      v_pass_now
    );
    IF v_result ->> 'ok' <> 'true' THEN
      RAISE EXCEPTION 'pass generation % failed: %', v_index, v_result;
    END IF;

    v_qr := (v_result ->> 'qr_id')::UUID;
    v_held_balance := public.get_pool_balance();
    v_result := public.cancel_qr(v_qr, v_pass_student);
    IF v_result ->> 'ok' <> 'true' THEN
      RAISE EXCEPTION 'pass cancellation % failed: %', v_index, v_result;
    END IF;
    v_released_balance := public.get_pool_balance();
    IF v_released_balance <> v_held_balance + 800 THEN
      RAISE EXCEPTION 'cancellation must release exactly 800 cents';
    END IF;

    IF v_index = 1 THEN
      v_hash := encode(extensions.digest('active-pass-duplicate', 'sha256'), 'hex');
      v_result := public.create_qr_hold(
        v_pass_student,
        v_hash,
        v_pass_now + make_interval(mins => v_qr_ttl_minutes),
        1,
        3,
        v_qr_ttl_minutes,
        v_pass_now
      );
      IF v_result ->> 'error_code' <> 'active_pass_exists' THEN
        RAISE EXCEPTION 'a second active pass should return active_pass_exists, got %', v_result;
      END IF;

      v_result := public.cancel_qr(v_qr, v_pass_student);
      IF v_result ->> 'ok' <> 'true' OR public.get_pool_balance() <> v_released_balance THEN
        RAISE EXCEPTION 'double cancellation must be idempotent';
      END IF;

      v_cooldown_now := v_pass_now + INTERVAL '1 second';
      v_cooldown_expires := v_cooldown_now + make_interval(mins => v_qr_ttl_minutes);
      v_result := public.create_qr_hold(
        v_pass_student,
        encode(extensions.digest('cooldown-pass', 'sha256'), 'hex'),
        v_cooldown_expires,
        1,
        3,
        v_qr_ttl_minutes,
        v_cooldown_now
      );
      SELECT role, is_active INTO v_student_role, v_student_active
      FROM public.users
      WHERE id = v_pass_student;

      SELECT COALESCE(string_agg(
        format('id=%s, status=%s, created_at=%s, expires_at=%s, cancelled_at=%s, redeemed_at=%s',
          id, status, created_at, expires_at, cancelled_at, redeemed_at),
        E'\n' ORDER BY created_at, id
      ), '(none)') INTO v_qr_rows
      FROM public.qr_codes
      WHERE student_user_id = v_pass_student
        AND (created_at AT TIME ZONE 'Pacific/Honolulu')::DATE =
          (v_cooldown_now AT TIME ZONE 'Pacific/Honolulu')::DATE;

      v_not_eligible_branch := CASE
        WHEN v_result ->> 'error_code' <> 'not_eligible'
          THEN 'not_eligible was not returned; actual code=' || COALESCE(v_result ->> 'error_code', '(null)')
        WHEN v_student_role IS NULL THEN 'student missing'
        WHEN v_student_role <> 'student' OR v_student_active IS NOT TRUE
          THEN 'student role or active check'
        WHEN v_cooldown_expires <= v_cooldown_now THEN 'expiry is not after p_now'
        WHEN v_cooldown_expires > v_cooldown_now + make_interval(mins => v_qr_ttl_minutes)
          THEN 'expiry exceeds QR_TTL_MINUTES'
        ELSE 'no not_eligible predicate matches; inspect deployed create_qr_hold definition'
      END;
      IF v_result ->> 'error_code' <> 'cooldown' THEN
        RAISE EXCEPTION 'cancel cooldown should return cooldown: result=%, student=(role %, is_active %), today QRs=%, not_eligible branch=%, p_now=%, p_expires_at=%',
          v_result,
          v_student_role,
          v_student_active,
          v_qr_rows,
          v_not_eligible_branch,
          v_cooldown_now,
          v_cooldown_expires;
      END IF;
    END IF;

    v_pass_now := now() + (v_index * 61 * INTERVAL '1 second');
  END LOOP;

  v_result := public.create_qr_hold(
    v_pass_student,
    encode(extensions.digest('fourth-pass', 'sha256'), 'hex'),
    v_pass_now + make_interval(mins => v_qr_ttl_minutes),
    1,
    3,
    v_qr_ttl_minutes,
    v_pass_now
  );
  IF v_result ->> 'error_code' <> 'too_many_attempts' THEN
    RAISE EXCEPTION 'fourth same-day pass should be rejected: %', v_result;
  END IF;

  v_now := (date_trunc('day', now() AT TIME ZONE 'Pacific/Honolulu') AT TIME ZONE 'Pacific/Honolulu')
    + INTERVAL '1 day';
  v_result := public.create_qr_hold(
    v_pass_student,
    encode(extensions.digest('pass-limit-next-day', 'sha256'), 'hex'),
    v_now + make_interval(mins => v_qr_ttl_minutes),
    1,
    3,
    v_qr_ttl_minutes,
    v_now
  );
  IF v_result ->> 'ok' <> 'true' THEN
    RAISE EXCEPTION 'pass generation limit did not reset on the next Honolulu day: %', v_result;
  END IF;
  PERFORM public.cancel_qr((v_result ->> 'qr_id')::UUID, v_pass_student);

  v_pass_now := now() + INTERVAL '2 days';
  v_result := public.create_qr_hold(
    v_pass_student,
    encode(extensions.digest('expired-cooldown-pass', 'sha256'), 'hex'),
    v_pass_now + make_interval(mins => v_qr_ttl_minutes),
    1,
    3,
    v_qr_ttl_minutes,
    v_pass_now
  );
  IF v_result ->> 'ok' <> 'true' THEN
    RAISE EXCEPTION 'expired cooldown test hold failed: %', v_result;
  END IF;
  v_qr := (v_result ->> 'qr_id')::UUID;
  UPDATE public.qr_codes
  SET status = 'expired', expires_at = now() + INTERVAL '30 seconds'
  WHERE id = v_qr;
  PERFORM public.release_expired_qr(v_qr);

  v_result := public.create_qr_hold(
    v_pass_student,
    encode(extensions.digest('expired-cooldown-retry', 'sha256'), 'hex'),
    now() + make_interval(mins => v_qr_ttl_minutes) + INTERVAL '45 seconds',
    1,
    3,
    v_qr_ttl_minutes,
    now() + INTERVAL '45 seconds'
  );
  IF v_result ->> 'error_code' <> 'cooldown' THEN
    RAISE EXCEPTION 'expired pass cooldown should reject a new pass within 60 seconds: %', v_result;
  END IF;
END;
$$;

DO $$
DECLARE
  v_cap_student UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4';
  v_second_student UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5';
  v_alias_user UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6';
  v_unconfirmed_user UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa7';
  v_eatery_user UUID;
  v_now TIMESTAMPTZ := now() + INTERVAL '20 days';
  v_qr_ttl_minutes CONSTANT INTEGER := 30;
  v_hash TEXT;
  v_result JSONB;
  v_alias_result JSONB;
  v_unconfirmed_result JSONB;
  v_attempt INTEGER;
BEGIN
  SELECT id INTO v_eatery_user FROM auth.users WHERE email = 'eatery@example.com';
  IF v_eatery_user IS NULL THEN
    RAISE EXCEPTION 'run npm run db:seed before accounting verification';
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES
    (
      '00000000-0000-0000-0000-000000000000', v_cap_student, 'authenticated', 'authenticated',
      'cap-one@hawaii.edu', extensions.crypt('test', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now(), '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000', v_second_student, 'authenticated', 'authenticated',
      'cap-two@hawaii.edu', extensions.crypt('test', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now(), '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000', v_alias_user, 'authenticated', 'authenticated',
      'acctest+alias@hawaii.edu', extensions.crypt('test', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now(), '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000', v_unconfirmed_user, 'authenticated', 'authenticated',
      'unconfirmed@hawaii.edu', extensions.crypt('test', extensions.gen_salt('bf')), NULL,
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now(), '', '', '', ''
    );

  INSERT INTO public.users (id, role, display_name, is_active)
  VALUES
    (v_cap_student, 'student', 'Cap one', TRUE),
    (v_second_student, 'student', 'Cap two', TRUE);

  v_alias_result := public.create_student_profile(v_alias_user, 'Alias');
  IF v_alias_result ->> 'error_code' <> 'student_email_already_used' THEN
    RAISE EXCEPTION 'plus-tag alias should not create a second student profile: %', v_alias_result;
  END IF;

  v_unconfirmed_result := public.create_student_profile(v_unconfirmed_user, 'Unconfirmed');
  IF v_unconfirmed_result ->> 'error_code' <> 'email_unverified_or_invalid' THEN
    RAISE EXCEPTION 'unconfirmed email must not create an active profile: %', v_unconfirmed_result;
  END IF;

  INSERT INTO public.contributions (id, amount_cents, currency, status)
  VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb7', 4000, 'usd', 'pending');
  PERFORM public.record_credit(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb7', 'cs_test_eatery_limit', 'pi_test_eatery_limit'
  );

  v_hash := encode(extensions.digest('eatery-cap-first', 'sha256'), 'hex');
  v_result := public.create_qr_hold(
    v_cap_student,
    v_hash,
    v_now + make_interval(mins => v_qr_ttl_minutes),
    1,
    3,
    v_qr_ttl_minutes,
    v_now
  );
  IF v_result ->> 'ok' <> 'true' THEN
    RAISE EXCEPTION 'eatery cap first hold failed: %', v_result;
  END IF;
  v_result := public.redeem_qr(v_hash, v_eatery_user, 1, v_now);
  IF v_result ->> 'ok' <> 'true' THEN
    RAISE EXCEPTION 'eatery cap first redemption failed: %', v_result;
  END IF;

  v_hash := encode(extensions.digest('eatery-cap-second', 'sha256'), 'hex');
  v_result := public.create_qr_hold(
    v_second_student,
    v_hash,
    v_now + make_interval(mins => v_qr_ttl_minutes + 2),
    1,
    3,
    v_qr_ttl_minutes,
    v_now + INTERVAL '2 minutes'
  );
  IF v_result ->> 'ok' <> 'true' THEN
    RAISE EXCEPTION 'eatery cap second hold failed: %', v_result;
  END IF;
  v_hash := encode(extensions.digest('eatery-cap-second', 'sha256'), 'hex');
  v_result := public.redeem_qr(v_hash, v_eatery_user, 1, v_now + INTERVAL '2 minutes');
  IF v_result ->> 'error_code' <> 'eatery_limit' THEN
    RAISE EXCEPTION 'eatery daily cap should reject the next redemption: %', v_result;
  END IF;
  PERFORM public.cancel_qr((
    SELECT id FROM public.qr_codes WHERE token_hash = v_hash
  ), v_second_student);

  v_now := v_now + INTERVAL '1 day';
  FOR v_attempt IN 1..20 LOOP
    v_result := public.redeem_qr(
      encode(extensions.digest(('invalid-scan-' || v_attempt::TEXT), 'sha256'), 'hex'),
      v_eatery_user,
      200,
      v_now
    );
    IF v_result ->> 'error_code' <> 'invalid' THEN
      RAISE EXCEPTION 'failed scan % should be recorded: %', v_attempt, v_result;
    END IF;
  END LOOP;

  v_result := public.redeem_qr(
    encode(extensions.digest('throttled-scan', 'sha256'), 'hex'),
    v_eatery_user,
    200,
    v_now
  );
  IF v_result ->> 'error_code' <> 'try_later' THEN
    RAISE EXCEPTION 'database scan throttle should reject after 20 failures: %', v_result;
  END IF;
END;
$$;

ROLLBACK;
