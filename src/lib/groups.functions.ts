import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Group = {
  id: string;
  name: string;
  archived_at: string | null;
  created_at: string;
  member_count?: number;
};

export type GroupDetail = {
  group: Group;
  members: { id: string; email: string; full_name: string | null; role: "admin" | "member" }[];
  isAdmin: boolean;
};

/** Groups the caller can see. RLS: members only see groups they belong to; admins see all in their org. */
export const listGroups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { includeArchived?: boolean }) =>
    z.object({ includeArchived: z.boolean().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<Group[]> => {
    let query = context.supabase
      .from("groups")
      .select("id, name, archived_at, created_at, group_members(count)")
      .order("created_at", { ascending: true });

    if (!data.includeArchived) query = query.is("archived_at", null);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    return (rows ?? []).map((r) => {
      const counts = r.group_members as unknown as { count: number }[] | null;
      return {
        id: r.id,
        name: r.name,
        archived_at: r.archived_at,
        created_at: r.created_at,
        member_count: counts?.[0]?.count ?? 0,
      };
    });
  });

/** A single group. Returns null when RLS hides it (wrong org, or not a member). */
export const getGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<GroupDetail | null> => {
    const { supabase, userId } = context;

    const { data: group } = await supabase
      .from("groups")
      .select("id, name, archived_at, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (!group) return null;

    const { data: me } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();

    const { data: links } = await supabase
      .from("group_members")
      .select("user_id, profiles:user_id (id, email, full_name, role)")
      .eq("group_id", data.id);

    const members = (links ?? [])
      .map((l) => l.profiles as unknown as GroupDetail["members"][number] | null)
      .filter((p): p is GroupDetail["members"][number] => Boolean(p));

    return { group, members, isAdmin: me?.role === "admin" };
  });

export const createGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string }) => z.object({ name: z.string().trim().min(2).max(60) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: me } = await supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", userId)
      .single();
    if (!me || me.role !== "admin") throw new Error("Only admins can create groups.");

    const { data: group, error } = await supabase
      .from("groups")
      .insert({ organization_id: me.organization_id, name: data.name, created_by: userId })
      .select("id, name, archived_at, created_at")
      .single();
    if (error) throw new Error(error.message);

    // The creating admin joins the group so it shows up in their own list too.
    await supabase.from("group_members").insert({ group_id: group.id, user_id: userId });

    return group as Group;
  });

export const renameGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; name: string }) =>
    z.object({ id: z.string().uuid(), name: z.string().trim().min(2).max(60) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: updated, error } = await context.supabase
      .from("groups")
      .update({ name: data.name })
      .eq("id", data.id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!updated?.length) throw new Error("Only admins of this organization can rename a group.");
    return { ok: true };
  });

/** Soft-delete: archived groups stay in the database but drop out of the active list. */
export const setGroupArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; archived: boolean }) =>
    z.object({ id: z.string().uuid(), archived: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: updated, error } = await context.supabase
      .from("groups")
      .update({ archived_at: data.archived ? new Date().toISOString() : null })
      .eq("id", data.id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!updated?.length) throw new Error("Only admins of this organization can archive a group.");
    return { ok: true };
  });

export const addGroupMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string; userId: string }) =>
    z.object({ groupId: z.string().uuid(), userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("group_members")
      .insert({ group_id: data.groupId, user_id: data.userId });
    if (error) {
      if (error.code === "23505") return { ok: true };
      throw new Error("Only admins can add people to this group.");
    }
    return { ok: true };
  });

export const removeGroupMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string; userId: string }) =>
    z.object({ groupId: z.string().uuid(), userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: removed, error } = await context.supabase
      .from("group_members")
      .delete()
      .eq("group_id", data.groupId)
      .eq("user_id", data.userId)
      .select("id");
    if (error) throw new Error(error.message);
    if (!removed?.length) throw new Error("Only admins can remove people from this group.");
    return { ok: true };
  });
