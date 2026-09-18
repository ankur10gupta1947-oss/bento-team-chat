CREATE OR REPLACE FUNCTION public.post_group_id(_post_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT group_id FROM public.posts WHERE id = _post_id
$$;

CREATE OR REPLACE FUNCTION public.post_org_id(_post_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.posts WHERE id = _post_id
$$;

REVOKE ALL ON FUNCTION public.post_group_id(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.post_org_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_group_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.post_org_id(uuid) TO authenticated, service_role;

CREATE TYPE public.reaction_type AS ENUM ('thumbs_up', 'heart', 'party', 'eyes');

CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comments_post_created_idx ON public.comments(post_id, created_at);

GRANT SELECT, INSERT, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read comments in groups you can see" ON public.comments
FOR SELECT TO authenticated
USING (
  organization_id = public.current_org_id()
  AND public.group_org_id(group_id) = public.current_org_id()
  AND (public.is_org_admin() OR public.is_group_member(group_id))
);

CREATE POLICY "Group members create their own comments" ON public.comments
FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND organization_id = public.current_org_id()
  AND group_id = public.post_group_id(post_id)
  AND organization_id = public.post_org_id(post_id)
  AND public.group_org_id(group_id) = public.current_org_id()
  AND public.is_group_member(group_id)
);

CREATE POLICY "Authors or admins delete comments" ON public.comments
FOR DELETE TO authenticated
USING (
  organization_id = public.current_org_id()
  AND (author_id = auth.uid() OR public.is_org_admin())
);

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction public.reaction_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
CREATE INDEX reactions_post_idx ON public.reactions(post_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reactions TO authenticated;
GRANT ALL ON public.reactions TO service_role;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read reactions in groups you can see" ON public.reactions
FOR SELECT TO authenticated
USING (
  organization_id = public.current_org_id()
  AND public.group_org_id(group_id) = public.current_org_id()
  AND (public.is_org_admin() OR public.is_group_member(group_id))
);

CREATE POLICY "Group members create their own reactions" ON public.reactions
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND organization_id = public.current_org_id()
  AND group_id = public.post_group_id(post_id)
  AND organization_id = public.post_org_id(post_id)
  AND public.is_group_member(group_id)
);

CREATE POLICY "Change your own reaction" ON public.reactions
FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND organization_id = public.current_org_id())
WITH CHECK (user_id = auth.uid() AND organization_id = public.current_org_id() AND public.is_group_member(group_id));

CREATE POLICY "Remove your own reaction" ON public.reactions
FOR DELETE TO authenticated
USING (user_id = auth.uid() AND organization_id = public.current_org_id());

CREATE TRIGGER update_reactions_updated_at BEFORE UPDATE ON public.reactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();