CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read posts in groups you can see"
ON public.posts FOR SELECT TO authenticated
USING (
  organization_id = public.current_org_id()
  AND public.group_org_id(group_id) = public.current_org_id()
  AND (public.is_org_admin() OR public.is_group_member(group_id))
);

CREATE POLICY "Group members create their own posts"
ON public.posts FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND organization_id = public.current_org_id()
  AND public.group_org_id(group_id) = public.current_org_id()
  AND public.is_group_member(group_id)
);

CREATE POLICY "Authors or admins delete posts"
ON public.posts FOR DELETE TO authenticated
USING (
  organization_id = public.current_org_id()
  AND (author_id = auth.uid() OR public.is_org_admin())
);

CREATE INDEX posts_group_created_idx ON public.posts (group_id, created_at DESC);

CREATE TRIGGER update_posts_updated_at
BEFORE UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();