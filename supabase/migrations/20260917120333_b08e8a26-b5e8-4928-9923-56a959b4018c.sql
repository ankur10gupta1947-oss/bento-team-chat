CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  archived_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE INDEX idx_groups_org ON public.groups(organization_id);
CREATE INDEX idx_group_members_group ON public.group_members(group_id);
CREATE INDEX idx_group_members_user ON public.group_members(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;

CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = _group_id AND gm.user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.group_org_id(_group_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.groups WHERE id = _group_id
$$;

REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.group_org_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.group_org_id(uuid) TO authenticated, service_role;

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read groups you belong to in your organization"
ON public.groups FOR SELECT TO authenticated
USING (organization_id = public.current_org_id() AND (public.is_org_admin() OR public.is_group_member(id)));

CREATE POLICY "Admins create groups in own organization"
ON public.groups FOR INSERT TO authenticated
WITH CHECK (organization_id = public.current_org_id() AND public.is_org_admin());

CREATE POLICY "Admins update groups in own organization"
ON public.groups FOR UPDATE TO authenticated
USING (organization_id = public.current_org_id() AND public.is_org_admin())
WITH CHECK (organization_id = public.current_org_id() AND public.is_org_admin());

CREATE POLICY "Read membership of groups you can see"
ON public.group_members FOR SELECT TO authenticated
USING (
  public.group_org_id(group_id) = public.current_org_id()
  AND (public.is_org_admin() OR public.is_group_member(group_id))
);

CREATE POLICY "Admins add people to groups in own organization"
ON public.group_members FOR INSERT TO authenticated
WITH CHECK (
  public.group_org_id(group_id) = public.current_org_id()
  AND public.is_org_admin()
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.organization_id = public.current_org_id())
);

CREATE POLICY "Admins remove people from groups in own organization"
ON public.group_members FOR DELETE TO authenticated
USING (public.group_org_id(group_id) = public.current_org_id() AND public.is_org_admin());

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();