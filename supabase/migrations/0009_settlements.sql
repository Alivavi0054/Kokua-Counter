ALTER TABLE public.redemptions
  ADD COLUMN settlement_id UUID REFERENCES public.settlements (id);

CREATE INDEX redemptions_settlement_id_idx ON public.redemptions (settlement_id);

CREATE FUNCTION public.create_settlement(
  p_eatery_id UUID,
  p_now TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eatery public.eateries%ROWTYPE;
  v_amount INTEGER;
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
  v_settlement_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(8242027);

  SELECT * INTO v_eatery FROM public.eateries WHERE id = p_eatery_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'eatery_not_found');
  END IF;

  IF v_eatery.stripe_connect_account_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'payouts_not_connected');
  END IF;

  SELECT COALESCE(SUM(amount_cents), 0)::INTEGER, MIN(redeemed_at), MAX(redeemed_at)
  INTO v_amount, v_period_start, v_period_end
  FROM public.redemptions
  WHERE eatery_id = p_eatery_id
    AND status = 'completed'
    AND settlement_id IS NULL
    AND redeemed_at <= p_now;

  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', FALSE, 'error_code', 'nothing_to_settle');
  END IF;

  INSERT INTO public.settlements (eatery_id, amount_cents, period_start, period_end, status)
  VALUES (p_eatery_id, v_amount, v_period_start, v_period_end, 'processing')
  RETURNING id INTO v_settlement_id;

  UPDATE public.redemptions
  SET settlement_id = v_settlement_id
  WHERE eatery_id = p_eatery_id
    AND status = 'completed'
    AND settlement_id IS NULL
    AND redeemed_at <= p_now;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'settlement_id', v_settlement_id,
    'amount_cents', v_amount,
    'stripe_connect_account_id', v_eatery.stripe_connect_account_id
  );
END;
$$;

CREATE FUNCTION public.mark_settlement_result(
  p_settlement_id UUID,
  p_status public.settlement_status,
  p_stripe_transfer_id TEXT DEFAULT NULL,
  p_stripe_payout_id TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.settlements
  SET
    status = p_status,
    stripe_transfer_id = COALESCE(p_stripe_transfer_id, stripe_transfer_id),
    stripe_payout_id = COALESCE(p_stripe_payout_id, stripe_payout_id)
  WHERE id = p_settlement_id;

  IF p_status = 'failed' THEN
    UPDATE public.redemptions
    SET settlement_id = NULL
    WHERE settlement_id = p_settlement_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_settlement(UUID, TIMESTAMPTZ) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_settlement_result(UUID, public.settlement_status, TEXT, TEXT) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_settlement(UUID, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_settlement_result(UUID, public.settlement_status, TEXT, TEXT) TO service_role;
