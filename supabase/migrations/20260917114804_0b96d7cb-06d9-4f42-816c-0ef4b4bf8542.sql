CREATE TYPE public.app_role AS ENUM ('admin', 'member');

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role public.app_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX profiles_org_idx ON public.profiles(organization_id);

CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invitations_org_idx ON public.invitations(organization_id);

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own organization"
ON public.organizations FOR SELECT TO authenticated
USING (id = public.current_org_id());

CREATE POLICY "Admins update own organization"
ON public.organizations FOR UPDATE TO authenticated
USING (id = public.current_org_id() AND public.is_org_admin())
WITH CHECK (id = public.current_org_id() AND public.is_org_admin());

CREATE POLICY "Members read profiles in own organization"
ON public.profiles FOR SELECT TO authenticated
USING (organization_id = public.current_org_id());

CREATE POLICY "Users update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid() AND organization_id = public.current_org_id());

CREATE POLICY "Admins remove members in own organization"
ON public.profiles FOR DELETE TO authenticated
USING (organization_id = public.current_org_id() AND public.is_org_admin() AND id <> auth.uid());

CREATE POLICY "Admins read invitations in own organization"
ON public.invitations FOR SELECT TO authenticated
USING (organization_id = public.current_org_id() AND public.is_org_admin());

CREATE POLICY "Admins create invitations in own organization"
ON public.invitations FOR INSERT TO authenticated
WITH CHECK (organization_id = public.current_org_id() AND public.is_org_admin());

CREATE POLICY "Admins delete invitations in own organization"
ON public.invitations FOR DELETE TO authenticated
USING (organization_id = public.current_org_id() AND public.is_org_admin());