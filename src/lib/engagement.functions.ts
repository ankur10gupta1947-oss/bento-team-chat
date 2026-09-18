import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const REACTIONS = [
  { key: "thumbs_up", emoji: "👍" },
  { key: "heart", emoji: "❤️" },
  { key: "party", emoji: "🎉" },
  { key: "eyes", emoji: "👀" },
] as const;

export type ReactionKey = (typeof REACTIONS)[number]["key"];

const reactionEnum = z.enum(["thumbs_up", "heart", "party", "eyes"]);

export type Comment = {
  id: string;
  post_id: string;
  content: string;
  created_at: string;
  author_id: string;
  author: { id: string; email: string; full_name: string | null } | null;
  canDelete: boolean;
};

export type PostEngagement = {
  comments: Comment[];
  /** counts per reaction key */
  counts: Record<string, number>;
  /** the caller's current reaction on each post */
  mine: Record<string, ReactionKey | null>;
};

/**
 * Comments (oldest first) and reaction counts for the posts of one group.
 * RLS only returns rows for groups the caller belongs to (or admins of the same
 * organization), so guessed post/comment ids yield nothing.
 */
export const getGroupEngagement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string }) => z.object({ groupId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<PostEngagement> => {
    const { supabase, userId } = context;

    const { data: me } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
    const isAdmin = me?.role === "admin";

    const { data: commentRows, error: cErr } = await supabase
      .from("comments")
      .select("id, post_id, content, created_at, author_id, profiles:author_id (id, email, full_name)")
      .eq("group_id", data.groupId)
      .order("created_at", { ascending: true });
    if (cErr) throw new Error(cErr.message);

    const { data: reactionRows, error: rErr } = await supabase
      .from("reactions")
      .select("post_id, user_id, reaction")
      .eq("group_id", data.groupId);
    if (rErr) throw new Error(rErr.message);

    const counts: Record<string, number> = {};
    const mine: Record<string, ReactionKey | null> = {};
    for (const r of reactionRows ?? []) {
      counts[`${r.post_id}:${r.reaction}`] = (counts[`${r.post_id}:${r.reaction}`] ?? 0) + 1;
      if (r.user_id === userId) mine[r.post_id] = r.reaction as ReactionKey;
    }

    return {
      comments: (commentRows ?? []).map((c) => ({
        id: c.id,
        post_id: c.post_id,
        content: c.content,
        created_at: c.created_at,
        author_id: c.author_id,
        author: (c.profiles as unknown as Comment["author"]) ?? null,
        canDelete: isAdmin || c.author_id === userId,
      })),
      counts,
      mine,
    };
  });

/** Add a comment. RLS rejects it unless the caller belongs to the post's group. */
export const createComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { postId: string; content: string }) =>
    z.object({ postId: z.string().uuid(), content: z.string().trim().min(1).max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: post } = await supabase
      .from("posts")
      .select("id, group_id, organization_id")
      .eq("id", data.postId)
      .maybeSingle();
    if (!post) throw new Error("You can only comment on posts in groups you belong to.");

    const { error } = await supabase.from("comments").insert({
      post_id: post.id,
      group_id: post.group_id,
      organization_id: post.organization_id,
      author_id: userId,
      content: data.content,
    });
    if (error) throw new Error("You can only comment on posts in groups you belong to.");
    return { ok: true };
  });

/** Delete a comment. RLS allows only the author or an admin of the same organization. */
export const deleteComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: removed, error } = await context.supabase
      .from("comments")
      .delete()
      .eq("id", data.id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!removed?.length) throw new Error("Only the author or an admin can delete this comment.");
    return { ok: true };
  });

/**
 * Set (or toggle off) the caller's single reaction on a post.
 * The unique (post_id, user_id) constraint means a new choice replaces the old one.
 */
export const setReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { postId: string; reaction: ReactionKey | null }) =>
    z.object({ postId: z.string().uuid(), reaction: reactionEnum.nullable() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (data.reaction === null) {
      const { error } = await supabase
        .from("reactions")
        .delete()
        .eq("post_id", data.postId)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    const { data: post } = await supabase
      .from("posts")
      .select("id, group_id, organization_id")
      .eq("id", data.postId)
      .maybeSingle();
    if (!post) throw new Error("You can only react to posts in groups you belong to.");

    const { data: existing } = await supabase
      .from("reactions")
      .select("id")
      .eq("post_id", post.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("reactions")
        .update({ reaction: data.reaction })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    const { error } = await supabase.from("reactions").insert({
      post_id: post.id,
      group_id: post.group_id,
      organization_id: post.organization_id,
      user_id: userId,
      reaction: data.reaction,
    });
    if (error) throw new Error("You can only react to posts in groups you belong to.");
    return { ok: true };
  });
