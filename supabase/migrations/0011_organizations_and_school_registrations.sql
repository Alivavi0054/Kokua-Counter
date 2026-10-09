-- Replaces the /tmp JSON files used by lib/organization-store.ts. Only the
-- service role reads and writes these tables (admin pages and API routes use
-- createAdminClient), so RLS is enabled with no client policies.

CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  mission TEXT,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  city TEXT,
  state TEXT,
  website TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX organizations_created_at_idx ON public.organizations (created_at DESC);

CREATE TABLE public.school_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  school_type TEXT,
  students TEXT,
  city TEXT,
  state TEXT,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX school_registrations_created_at_idx ON public.school_registrations (created_at DESC);

CREATE TRIGGER organizations_set_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER school_registrations_set_updated_at
  BEFORE UPDATE ON public.school_registrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_registrations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.organizations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.school_registrations FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT ON public.organizations TO service_role;
GRANT SELECT, INSERT ON public.school_registrations TO service_role;
