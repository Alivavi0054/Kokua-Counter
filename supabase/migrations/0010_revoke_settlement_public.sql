-- 0009 revoked EXECUTE from anon/authenticated but not from PUBLIC. Postgres
-- grants EXECUTE to PUBLIC by default and anon/authenticated inherit it, so
-- both SECURITY DEFINER settlement functions were reachable through PostgREST.
REVOKE ALL ON FUNCTION public.create_settlement(UUID, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_settlement(UUID, TIMESTAMPTZ) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_settlement_result(UUID, public.settlement_status, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_settlement_result(UUID, public.settlement_status, TEXT, TEXT) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_settlement(UUID, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_settlement_result(UUID, public.settlement_status, TEXT, TEXT) TO service_role;
