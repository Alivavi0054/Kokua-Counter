-- Marks which donations already had an emailed receipt, so duplicate or retried Stripe webhooks never
-- send a second one. The donor's email address is deliberately NOT stored here (or anywhere): it is read
-- from the Stripe session at the moment the receipt is sent.
CREATE TABLE public.receipt_emails (
  contribution_id UUID PRIMARY KEY REFERENCES public.contributions (id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.receipt_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.receipt_emails FROM PUBLIC, anon, authenticated;

-- TRUE only for the first caller; everyone after that gets FALSE.
CREATE FUNCTION public.claim_receipt_email(p_contribution_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claimed UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.contributions WHERE id = p_contribution_id AND status IN ('completed', 'refunded')
  ) THEN
    RETURN FALSE;
  END IF;
  INSERT INTO public.receipt_emails (contribution_id) VALUES (p_contribution_id)
  ON CONFLICT (contribution_id) DO NOTHING
  RETURNING contribution_id INTO v_claimed;
  RETURN v_claimed IS NOT NULL;
END;
$$;

-- Lets a later attempt try again after a failed send.
CREATE FUNCTION public.release_receipt_email(p_contribution_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.receipt_emails WHERE contribution_id = p_contribution_id
$$;

REVOKE ALL ON FUNCTION public.claim_receipt_email(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_receipt_email(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_receipt_email(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_receipt_email(UUID) TO service_role;
