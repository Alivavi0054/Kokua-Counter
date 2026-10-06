-- Accounting lifecycle tests. Run after migrations + seed.
-- Wrap in a transaction that rolls back. Raises on any wrong balance.

BEGIN;

DO $$
DECLARE
  v_before BIGINT;
  v_result JSONB;
  v_refund_count INTEGER;
  v_test_now TIMESTAMPTZ := now();
  v_student UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
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

  -- $8 + meal = 0
  INSERT INTO public.contributions (id, amount_cents, currency, status)
  VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 800, 'usd', 'pending');
  PERFORM public.record_credit(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    'cs_test_8_meal',
    'pi_test_8_meal'
  );
  v_before := public.get_pool_balance();
  IF v_before <> 800 THEN
    RAISE EXCEPTION '$8 credit should be +800, got %', v_before;
  END IF;

  v_hash := encode(extensions.digest('token-8-meal', 'sha256'), 'hex');
  v_result := public.create_qr_hold(
    v_student, v_hash, v_test_now + INTERVAL '15 minutes', 1, 3, v_test_now
  );
  IF COALESCE((v_result ->> 'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION '$8 hold failed: %', v_result;
  END IF;
  v_result := public.redeem_qr(v_hash, v_eatery_user, 200, v_test_now);
  IF COALESCE((v_result ->> 'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION '$8 redeem failed: %', v_result;
  END IF;
  IF public.get_pool_balance() <> 0 THEN
    RAISE EXCEPTION '$8 + meal should be 0, got %', public.get_pool_balance();
  END IF;

  -- $8 + expired QR = +800
  v_test_now := v_test_now + INTERVAL '1 day';
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
    v_student, v_hash, v_test_now + INTERVAL '15 minutes', 1, 3, v_test_now
  );
  IF COALESCE((v_result ->> 'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'expire hold failed: %', v_result;
  END IF;
  v_qr := (v_result ->> 'qr_id')::UUID;
  UPDATE public.qr_codes SET expires_at = now() - INTERVAL '1 second' WHERE id = v_qr;
  PERFORM public.expire_stale_qrs();
  IF public.get_pool_balance() - v_before <> 800 THEN
    RAISE EXCEPTION '$8 + expired QR should add +800, got delta %',
      public.get_pool_balance() - v_before;
  END IF;

  -- $24 + one meal = +1600
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
    v_student, v_hash, v_test_now + INTERVAL '15 minutes', 1, 3, v_test_now
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

  -- $24 + full refund unused = 0
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

  -- $24 + meal + full refund = -1600
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
    v_student, v_hash, v_test_now + INTERVAL '15 minutes', 1, 3, v_test_now
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

  -- Duplicate refund webhook = exactly one refund entry
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
END;
$$;

DO $$
DECLARE
  v_daily_student UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2';
  v_pass_student UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3';
  v_eatery_user UUID;
  v_now TIMESTAMPTZ := now() + INTERVAL '10 days';
  v_pass_now TIMESTAMPTZ := now();
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
    v_daily_student, v_hash, v_now + INTERVAL '15 minutes', 1, 3, v_now
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
    v_daily_student, v_hash, v_now + INTERVAL '17 minutes', 1, 3, v_now + INTERVAL '2 minutes'
  );
  IF v_result ->> 'error_code' <> 'daily_limit_reached' THEN
    RAISE EXCEPTION 'second same-day meal should be rejected: %', v_result;
  END IF;

  v_hash := encode(extensions.digest('daily-reset-next-day', 'sha256'), 'hex');
  v_result := public.create_qr_hold(
    v_daily_student, v_hash, v_now + INTERVAL '1 day 15 minutes', 1, 3, v_now + INTERVAL '1 day'
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
      v_pass_now + INTERVAL '15 minutes',
      1,
      3,
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
      v_result := public.cancel_qr(v_qr, v_pass_student);
      IF v_result ->> 'ok' <> 'true' OR public.get_pool_balance() <> v_released_balance THEN
        RAISE EXCEPTION 'double cancellation must be idempotent';
      END IF;

      v_result := public.create_qr_hold(
        v_pass_student,
        encode(extensions.digest('cooldown-pass', 'sha256'), 'hex'),
        v_pass_now + INTERVAL '16 minutes',
        1,
        3,
        v_pass_now + INTERVAL '1 second'
      );
      IF v_result ->> 'error_code' <> 'cooldown' THEN
        RAISE EXCEPTION 'cancel cooldown should reject an immediate new pass: %', v_result;
      END IF;
    END IF;

    v_pass_now := now() + (v_index * 61 * INTERVAL '1 second');
  END LOOP;

  v_result := public.create_qr_hold(
    v_pass_student,
    encode(extensions.digest('fourth-pass', 'sha256'), 'hex'),
    v_pass_now + INTERVAL '15 minutes',
    1,
    3,
    v_pass_now
  );
  IF v_result ->> 'error_code' <> 'too_many_attempts' THEN
    RAISE EXCEPTION 'fourth same-day pass should be rejected: %', v_result;
  END IF;

  v_now := date_trunc('day', now() AT TIME ZONE 'Pacific/Honolulu') AT TIME ZONE 'Pacific/Honolulu'
    + INTERVAL '1 day';
  v_result := public.create_qr_hold(
    v_pass_student,
    encode(extensions.digest('pass-limit-next-day', 'sha256'), 'hex'),
    v_now + INTERVAL '15 minutes',
    1,
    3,
    v_now
  );
  IF v_result ->> 'ok' <> 'true' THEN
    RAISE EXCEPTION 'pass generation limit did not reset on the next Honolulu day: %', v_result;
  END IF;
  PERFORM public.cancel_qr((v_result ->> 'qr_id')::UUID, v_pass_student);
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
    v_cap_student, v_hash, v_now + INTERVAL '15 minutes', 1, 3, v_now
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
    v_second_student, v_hash, v_now + INTERVAL '17 minutes', 1, 3, v_now + INTERVAL '2 minutes'
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
