ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eateries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.pool_ledger FROM anon, authenticated;
REVOKE ALL ON public.pool_balance FROM anon, authenticated;
GRANT SELECT ON public.pool_balance TO service_role;

ALTER VIEW public.public_eateries SET (security_invoker = false);
GRANT SELECT ON public.public_eateries TO anon, authenticated;

CREATE POLICY users_select_own
  ON public.users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY eateries_select_own
  ON public.eateries
  FOR SELECT
  TO authenticated
  USING (owner_user_id = auth.uid());

CREATE POLICY contributions_select_own
  ON public.contributions
  FOR SELECT
  TO authenticated
  USING (donor_user_id = auth.uid());

CREATE POLICY qr_codes_select_own
  ON public.qr_codes
  FOR SELECT
  TO authenticated
  USING (student_user_id = auth.uid());

CREATE POLICY redemptions_select_student_or_eatery
  ON public.redemptions
  FOR SELECT
  TO authenticated
  USING (
    student_user_id = auth.uid()
    OR eatery_id IN (
      SELECT id FROM public.eateries WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY settlements_select_own_eatery
  ON public.settlements
  FOR SELECT
  TO authenticated
  USING (
    eatery_id IN (
      SELECT id FROM public.eateries WHERE owner_user_id = auth.uid()
    )
  );
