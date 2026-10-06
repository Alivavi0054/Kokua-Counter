CREATE OR REPLACE FUNCTION public.health_check()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_failures TEXT[] := ARRAY[]::TEXT[];
  v_table TEXT;
  v_function TEXT;
  v_pool_balance BIGINT;
BEGIN
  PERFORM 1;

  FOREACH v_table IN ARRAY ARRAY[
    'users',
    'eateries',
    'contributions',
    'pool_ledger',
    'qr_codes',
    'redemptions',
    'settlements'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = v_table
    ) THEN
      v_failures := array_append(v_failures, 'missing table: ' || v_table);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename = v_table AND rowsecurity = TRUE
    ) THEN
      v_failures := array_append(v_failures, 'rls disabled: ' || v_table);
    END IF;
  END LOOP;

  FOREACH v_function IN ARRAY ARRAY[
    'get_pool_balance',
    'record_credit',
    'record_refund',
    'record_refund_reversal',
    'create_qr_hold',
    'redeem_qr',
    'expire_stale_qrs',
    'cancel_qr',
    'release_expired_qr',
    'health_check'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = v_function
    ) THEN
      v_failures := array_append(v_failures, 'missing function: ' || v_function);
    END IF;
  END LOOP;

  BEGIN
    SELECT public.get_pool_balance() INTO v_pool_balance;
  EXCEPTION WHEN OTHERS THEN
    v_failures := array_append(v_failures, 'pool balance unavailable');
  END;

  RETURN jsonb_build_object(
    'ok', cardinality(v_failures) = 0,
    'failures', to_jsonb(v_failures),
    'database_reachable', TRUE,
    'pool_balance_readable', v_pool_balance IS NOT NULL OR cardinality(v_failures) = 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.health_check() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.health_check() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.health_check() TO service_role;
