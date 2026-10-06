CREATE OR REPLACE FUNCTION public.pool_ledger_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'pool_ledger is append-only';
  END IF;

  IF NEW.entry_type = 'credit' AND NEW.amount_cents <= 0 THEN
    RAISE EXCEPTION 'credit entries must be positive';
  ELSIF NEW.entry_type = 'hold' AND NEW.amount_cents >= 0 THEN
    RAISE EXCEPTION 'hold entries must be negative';
  ELSIF NEW.entry_type = 'release' AND NEW.amount_cents <= 0 THEN
    RAISE EXCEPTION 'release entries must be positive';
  ELSIF NEW.entry_type = 'redemption' AND NEW.amount_cents >= 0 THEN
    RAISE EXCEPTION 'redemption entries must be negative';
  ELSIF NEW.entry_type = 'refund' AND NEW.amount_cents >= 0 THEN
    RAISE EXCEPTION 'refund entries must be negative';
  ELSIF NEW.entry_type = 'refund_reversal' AND NEW.amount_cents <= 0 THEN
    RAISE EXCEPTION 'refund_reversal entries must be positive';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER pool_ledger_before_insert
  BEFORE INSERT ON public.pool_ledger
  FOR EACH ROW EXECUTE FUNCTION public.pool_ledger_guard();

CREATE TRIGGER pool_ledger_before_update
  BEFORE UPDATE ON public.pool_ledger
  FOR EACH ROW EXECUTE FUNCTION public.pool_ledger_guard();

CREATE TRIGGER pool_ledger_before_delete
  BEFORE DELETE ON public.pool_ledger
  FOR EACH ROW EXECUTE FUNCTION public.pool_ledger_guard();
