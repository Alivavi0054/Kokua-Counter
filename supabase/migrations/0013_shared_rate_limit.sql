-- Rate limiting shared across all serverless instances (the in-memory limiter only sees one
-- instance, so it is only a best-effort speed bump). One atomic upsert per hit, service role only.
CREATE TABLE public.rate_limits (
  key TEXT PRIMARY KEY,
  hits INTEGER NOT NULL CHECK (hits > 0),
  reset_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX rate_limits_reset_at_idx ON public.rate_limits (reset_at);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limits FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.rate_limit_hit(
  p_key TEXT,
  p_limit INTEGER,
  p_window_ms INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT := left(p_key, 128);
  v_hits INTEGER;
  v_reset TIMESTAMPTZ;
BEGIN
  IF p_key IS NULL OR p_limit IS NULL OR p_limit <= 0 OR p_window_ms IS NULL
     OR p_window_ms < 1000 OR p_window_ms > 3600000 THEN
    RAISE EXCEPTION 'rate_limit_invalid_arguments';
  END IF;

  -- The conflict path takes a row lock, so concurrent hits on one key are counted exactly once each.
  INSERT INTO public.rate_limits AS r (key, hits, reset_at)
  VALUES (v_key, 1, now() + make_interval(secs => p_window_ms / 1000.0))
  ON CONFLICT (key) DO UPDATE
    SET hits = CASE WHEN r.reset_at <= now() THEN 1 ELSE LEAST(r.hits + 1, p_limit + 1) END,
        reset_at = CASE WHEN r.reset_at <= now()
                        THEN now() + make_interval(secs => p_window_ms / 1000.0)
                        ELSE r.reset_at END
  RETURNING hits, reset_at INTO v_hits, v_reset;

  -- Housekeeping: drop a few long-expired rows so the table stays small.
  DELETE FROM public.rate_limits
  WHERE key IN (
    SELECT key FROM public.rate_limits WHERE reset_at < now() - interval '1 hour' LIMIT 20
  );

  RETURN jsonb_build_object(
    'ok', v_hits <= p_limit,
    'retry_after_ms', GREATEST(0, (extract(epoch FROM (v_reset - now())) * 1000)::INTEGER)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rate_limit_hit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(TEXT, INTEGER, INTEGER) TO service_role;
