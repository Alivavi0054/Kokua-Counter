-- paid and failed are final. Previously a settlement already marked paid could be marked failed, which
-- released its redemptions (settlement_id = NULL) so the next settlement would pay them a second time.
-- A failed settlement could likewise be marked paid after its redemptions had been released and re-settled,
-- and an unknown settlement id was silently ignored. Privileges are unchanged (CREATE OR REPLACE keeps them).
CREATE OR REPLACE FUNCTION public.mark_settlement_result(
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
DECLARE
  v_current public.settlement_status;
BEGIN
  -- Same lock create_settlement takes, so marking and creating settlements cannot interleave.
  PERFORM pg_advisory_xact_lock(8242027);

  SELECT status INTO v_current FROM public.settlements WHERE id = p_settlement_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'settlement_not_found';
  END IF;

  IF v_current IN ('paid', 'failed') THEN
    IF v_current <> p_status THEN
      RAISE EXCEPTION 'settlement_already_finalised';
    END IF;
    -- Repeating the same final result: only fill in reference ids, never release anything again.
    UPDATE public.settlements
    SET stripe_transfer_id = COALESCE(stripe_transfer_id, p_stripe_transfer_id),
        stripe_payout_id = COALESCE(stripe_payout_id, p_stripe_payout_id)
    WHERE id = p_settlement_id;
    RETURN;
  END IF;

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
