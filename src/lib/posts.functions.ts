import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Post = {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  author: { id: string; email: string; full_name: string | null } | null;
  canDelete: boolean;
};

/**
 * Posts in one group, newest first.
 * RLS only returns rows when the caller is a member of that group (or an org admin),
 * so a guessed group id simply yields an empty list.
 */
export const listPosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string }) => z.object({ groupId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<Post[]> => {
    const { supabase, userId } = context;

    const { data: me } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
    const isAdmin = me?.role === "admin";

    const { data: rows, error } = await supabase
      .from("posts")
      .select("id, content, created_at, author_id, profiles:author_id (id, email, full_name)")
      .eq("group_id", data.groupId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    return (rows ?? []).map((r) => ({
      id: r.id,
      content: r.content,
      created_at: r.created_at,
      author_id: r.author_id,
      author: (r.profiles as unknown as Post["author"]) ?? null,
      canDelete: isAdmin || r.author_id === userId,
    }));
  });

/** Create a post. RLS rejects the insert unless the caller belongs to the group. */
export const createPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string; content: string }) =>
    z.object({ groupId: z.string().uuid(), content: z.string().trim().min(1).max(5000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: me } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();
    if (!me) throw new Error("Your profile is not set up yet.");

    const { error } = await supabase.from("posts").insert({
      group_id: data.groupId,
      organization_id: me.organization_id,
      author_id: userId,
      content: data.content,
    });
    if (error) throw new Error("You can only post in groups you belong to.");
    return { ok: true };
  });

/** Delete a post. RLS allows only the author or an admin of the same organization. */
export const deletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: removed, error } = await context.supabase
      .from("posts")
      .delete()
      .eq("id", data.id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!removed?.length) throw new Error("Only the author or an admin can delete this post.");
    return { ok: true };
  });
