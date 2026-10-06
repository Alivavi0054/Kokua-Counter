-- Accounting lifecycle tests. Run after migrations + seed.
-- Wrap in a transaction that rolls back. Raises on any wrong balance.

BEGIN;

DO $$
DECLARE
  v_before BIGINT;
  v_result JSONB;
  v_refund_count INTEGER;
  v_student UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
  v_eatery_user UUID := '00000000-0000-0000-0000-000000000003';
  v_hash TEXT;
  v_qr UUID;
BEGIN
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
  v_result := public.create_qr_hold(v_student, v_hash, now() + INTERVAL '15 minutes');
  IF COALESCE((v_result ->> 'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION '$8 hold failed: %', v_result;
  END IF;
  v_result := public.redeem_qr(v_hash, v_eatery_user);
  IF COALESCE((v_result ->> 'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION '$8 redeem failed: %', v_result;
  END IF;
  IF public.get_pool_balance() <> 0 THEN
    RAISE EXCEPTION '$8 + meal should be 0, got %', public.get_pool_balance();
  END IF;

  -- $8 + expired QR = +800
  v_before := public.get_pool_balance();
  INSERT INTO public.contributions (id, amount_cents, currency, status)
  VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 800, 'usd', 'pending');
  PERFORM public.record_credit(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
    'cs_test_8_expire',
    'pi_test_8_expire'
  );
  v_hash := encode(extensions.digest('token-8-expire', 'sha256'), 'hex');
  v_result := public.create_qr_hold(v_student, v_hash, now() + INTERVAL '15 minutes');
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
  v_before := public.get_pool_balance();
  INSERT INTO public.contributions (id, amount_cents, currency, status)
  VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 2400, 'usd', 'pending');
  PERFORM public.record_credit(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3',
    'cs_test_24_meal',
    'pi_test_24_meal'
  );
  v_hash := encode(extensions.digest('token-24-meal', 'sha256'), 'hex');
  v_result := public.create_qr_hold(v_student, v_hash, now() + INTERVAL '15 minutes');
  IF COALESCE((v_result ->> 'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION '$24 hold failed: %', v_result;
  END IF;
  v_result := public.redeem_qr(v_hash, v_eatery_user);
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
  v_before := public.get_pool_balance();
  INSERT INTO public.contributions (id, amount_cents, currency, status)
  VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5', 2400, 'usd', 'pending');
  PERFORM public.record_credit(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5',
    'cs_test_24_meal_refund',
    'pi_test_24_meal_refund'
  );
  v_hash := encode(extensions.digest('token-24-meal-refund', 'sha256'), 'hex');
  v_result := public.create_qr_hold(v_student, v_hash, now() + INTERVAL '15 minutes');
  IF COALESCE((v_result ->> 'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'meal+refund hold failed: %', v_result;
  END IF;
  v_result := public.redeem_qr(v_hash, v_eatery_user);
  IF COALESCE((v_result ->> 'ok')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'meal+refund redeem failed: %', v_result;
  END IF;
  PERFORM public.record_refund(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5',
    're_test_meal_refund',
    2400
  );
  IF public.get_pool_balance() - v_before <> -1600 THEN
    RAISE EXCEPTION '$24 + meal + full refund should add -1600, got delta %',
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

ROLLBACK;
