import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getOrgContext,
  inviteMember,
  removeMember,
  renameOrganization,
  revokeInvite,
} from "@/lib/org.functions";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Account settings — BENTO" },
      { name: "description", content: "Manage your BENTO organization name, members and invites." },
      { property: "og:title", content: "Account settings — BENTO" },
      { property: "og:description", content: "Manage your organization, members and invites." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Settings,
});

function Settings() {
  const fetchContext = useServerFn(getOrgContext);
  const rename = useServerFn(renameOrganization);
  const invite = useServerFn(inviteMember);
  const revoke = useServerFn(revokeInvite);
  const remove = useServerFn(removeMember);

  const { data, refetch } = useQuery({ queryKey: ["org-context"], queryFn: () => fetchContext() });
  const [name, setName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data?.organization) setName(data.organization.name);
  }, [data?.organization]);

  const isAdmin = data?.profile?.role === "admin";

  async function run(fn: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await fn();
      await refetch();
      toast.success(success);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader orgName={data?.organization?.name} />
      <main className="mx-auto max-w-3xl space-y-8 px-6 py-12">
        <h1 className="text-4xl">Account settings</h1>

        <section className="surface p-6">
          <h2 className="text-xl">Organization</h2>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1 space-y-2">
              <Label htmlFor="orgname">Name</Label>
              <Input
                id="orgname"
                value={name}
                disabled={!isAdmin}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            {isAdmin && (
              <Button
                disabled={busy || name.trim().length < 2}
                onClick={() => run(() => rename({ data: { name: name.trim() } }), "Organization renamed.")}
              >
                Save
              </Button>
            )}
          </div>
          {!isAdmin && (
            <p className="mt-3 text-sm text-muted-foreground">Only admins can change this.</p>
          )}
        </section>

        {isAdmin && (
          <section className="surface p-6">
            <h2 className="text-xl">Invite a teammate</h2>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="min-w-56 flex-1 space-y-2">
                <Label htmlFor="inviteEmail">Email address</Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@company.com"
                />
              </div>
              <Button
                disabled={busy || !inviteEmail.includes("@")}
                onClick={() =>
                  run(async () => {
                    const created = await invite({ data: { email: inviteEmail.trim() } });
                    setInviteEmail("");
                    await navigator.clipboard
                      ?.writeText(`${window.location.origin}/invite/${created.token}`)
                      .catch(() => undefined);
                  }, "Invite created — link copied to your clipboard.")
                }
              >
                Create invite link
              </Button>
            </div>

            {data && data.invitations.length > 0 && (
              <ul className="mt-6 divide-y divide-border">
                {data.invitations.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm">{i.email}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {window.location.origin}/invite/{i.token}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          navigator.clipboard
                            ?.writeText(`${window.location.origin}/invite/${i.token}`)
                            .then(() => toast.success("Link copied."))
                            .catch(() => toast.error("Could not copy the link."))
                        }
                      >
                        Copy link
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => run(() => revoke({ data: { id: i.id } }), "Invite revoked.")}
                      >
                        Revoke
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="surface p-6">
          <h2 className="text-xl">Members</h2>
          <ul className="mt-4 divide-y divide-border">
            {data?.members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm">{m.full_name ?? m.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.email} · {m.role}
                  </p>
                </div>
                {isAdmin && m.id !== data?.profile?.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => run(() => remove({ data: { userId: m.id } }), "Member removed.")}
                  >
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
