import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Member = {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "member";
  created_at: string;
};

export type Invitation = {
  id: string;
  email: string;
  token: string;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
};

export type OrgContext = {
  profile: { id: string; email: string; full_name: string | null; role: "admin" | "member" } | null;
  organization: { id: string; name: string } | null;
  members: Member[];
  invitations: Invitation[];
};

/**
 * Creates the caller's profile on first sign-in.
 * Either creates a brand-new organization (admin) or joins one via invite token.
 * Both paths come from the metadata captured at signup.
 */
export const bootstrapProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (existing) return { created: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userErr || !userRes.user) throw new Error("Could not load your account.");

    const user = userRes.user;
    const email = user.email ?? "";
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const fullName = typeof meta["full_name"] === "string" ? (meta["full_name"] as string) : null;
    const inviteToken = typeof meta["invite_token"] === "string" ? (meta["invite_token"] as string) : null;
    const orgName = typeof meta["organization_name"] === "string" ? (meta["organization_name"] as string).trim() : "";

    if (inviteToken) {
      const { data: invite } = await supabaseAdmin
        .from("invitations")
        .select("id, organization_id, email, accepted_at, expires_at")
        .eq("token", inviteToken)
        .maybeSingle();

      if (!invite) throw new Error("That invite link is not valid.");
      if (invite.accepted_at) throw new Error("That invite has already been used.");
      if (new Date(invite.expires_at) < new Date()) throw new Error("That invite has expired.");
      if (invite.email.toLowerCase() !== email.toLowerCase())
        throw new Error("This invite was sent to a different email address.");

      const { error: insertErr } = await supabaseAdmin.from("profiles").insert({
        id: userId,
        organization_id: invite.organization_id,
        email,
        full_name: fullName,
        role: "member",
      });
      if (insertErr) throw new Error(insertErr.message);

      await supabaseAdmin
        .from("invitations")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", invite.id);

      return { created: true as const, role: "member" as const };
    }

    if (!orgName) throw new Error("No organization or invite found for this account.");

    const { data: org, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .insert({ name: orgName })
      .select("id")
      .single();
    if (orgErr || !org) throw new Error(orgErr?.message ?? "Could not create the organization.");

    const { error: profileErr } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      organization_id: org.id,
      email,
      full_name: fullName,
      role: "admin",
    });
    if (profileErr) throw new Error(profileErr.message);

    return { created: true as const, role: "admin" as const };
  });

/** All org data the signed-in user is allowed to see. RLS scopes every row to their org. */
export const getOrgContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OrgContext> => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) return { profile: null, organization: null, members: [], invitations: [] };

    const [{ data: organization }, { data: members }, { data: invitations }] = await Promise.all([
      supabase.from("organizations").select("id, name").maybeSingle(),
      supabase
        .from("profiles")
        .select("id, email, full_name, role, created_at")
        .order("created_at", { ascending: true }),
      supabase
        .from("invitations")
        .select("id, email, token, accepted_at, expires_at, created_at")
        .is("accepted_at", null)
        .order("created_at", { ascending: false }),
    ]);

    return {
      profile: profile as OrgContext["profile"],
      organization: organization ?? null,
      members: (members ?? []) as Member[],
      invitations: (invitations ?? []) as Invitation[],
    };
  });

export const renameOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string }) => z.object({ name: z.string().trim().min(2).max(80) }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("organizations")
      .update({ name: data.name })
      .eq("id", (await context.supabase.from("profiles").select("organization_id").eq("id", context.userId).single()).data!.organization_id);
    if (error) throw new Error("Only an admin can rename the organization.");
    return { ok: true };
  });

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string }) => z.object({ email: z.string().trim().email() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const email = data.email.toLowerCase();

    const { data: me } = await supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", userId)
      .single();
    if (!me || me.role !== "admin") throw new Error("Only admins can invite people.");

    const { data: already } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (already) throw new Error("That person is already in your organization.");

    const { data: invite, error } = await supabase
      .from("invitations")
      .insert({ organization_id: me.organization_id, email, invited_by: userId })
      .select("id, email, token, accepted_at, expires_at, created_at")
      .single();
    if (error) throw new Error(error.message);

    return invite as Invitation;
  });

export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("invitations").delete().eq("id", data.id);
    if (error) throw new Error("Only admins can revoke invites.");
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.userId === userId) throw new Error("You cannot remove yourself.");

    const { data: me } = await supabase.from("profiles").select("role").eq("id", userId).single();
    if (!me || me.role !== "admin") throw new Error("Only admins can remove members.");

    // RLS guarantees this only deletes a profile inside the caller's own organization.
    const { data: deleted, error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", data.userId)
      .select("id");
    if (error) throw new Error(error.message);
    if (!deleted || deleted.length === 0) throw new Error("That member is not in your organization.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.auth.admin.deleteUser(data.userId);

    return { ok: true };
  });

/** Public: shows who an invite link is for, so the invited person can sign up. */
export const getInvitePreview = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => z.object({ token: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite } = await supabaseAdmin
      .from("invitations")
      .select("email, accepted_at, expires_at, organization_id")
      .eq("token", data.token)
      .maybeSingle();

    if (!invite) return { status: "invalid" as const };
    if (invite.accepted_at) return { status: "used" as const };
    if (new Date(invite.expires_at) < new Date()) return { status: "expired" as const };

    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("name")
      .eq("id", invite.organization_id)
      .single();

    return { status: "valid" as const, email: invite.email, organizationName: org?.name ?? "" };
  });
