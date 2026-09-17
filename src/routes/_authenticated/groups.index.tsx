import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createGroup, listGroups } from "@/lib/groups.functions";
import { getOrgContext } from "@/lib/org.functions";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/groups/")({
  head: () => ({
    meta: [
      { title: "Your groups — BENTO" },
      { name: "description", content: "The BENTO groups you belong to inside your organization." },
      { property: "og:title", content: "Your groups — BENTO" },
      { property: "og:description", content: "The groups you belong to inside your organization." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GroupsPage,
});

function GroupsPage() {
  const fetchGroups = useServerFn(listGroups);
  const fetchContext = useServerFn(getOrgContext);
  const create = useServerFn(createGroup);

  const [showArchived, setShowArchived] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: ctx } = useQuery({ queryKey: ["org-context"], queryFn: () => fetchContext() });
  const { data: groups, isPending, refetch } = useQuery({
    queryKey: ["groups", showArchived],
    queryFn: () => fetchGroups({ data: { includeArchived: showArchived } }),
  });

  const isAdmin = ctx?.profile?.role === "admin";

  async function onCreate() {
    setBusy(true);
    try {
      await create({ data: { name: name.trim() } });
      setName("");
      await refetch();
      toast.success("Group created.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the group.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader orgName={ctx?.organization?.name} />
      <main className="mx-auto max-w-3xl space-y-8 px-6 py-12">
        <div>
          <h1 className="text-4xl">Groups</h1>
          <p className="mt-3 text-muted-foreground">
            {isAdmin
              ? "Every group in your organization. Members only ever see the groups they've been added to."
              : "The groups you've been added to."}
          </p>
        </div>

        {isAdmin && (
          <section className="surface p-6">
            <h2 className="text-xl">Create a group</h2>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="min-w-56 flex-1 space-y-2">
                <Label htmlFor="groupName">Group name</Label>
                <Input
                  id="groupName"
                  value={name}
                  placeholder="Engineering"
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <Button disabled={busy || name.trim().length < 2} onClick={onCreate}>
                Create group
              </Button>
            </div>
          </section>
        )}

        <section className="surface p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl">{showArchived ? "All groups" : "Active groups"}</h2>
            <Button variant="ghost" size="sm" onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? "Hide archived" : "Show archived"}
            </Button>
          </div>

          {isPending && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}

          {groups && groups.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              {isAdmin ? "No groups yet — create your first one above." : "You haven't been added to any groups yet."}
            </p>
          )}

          <ul className="mt-4 divide-y divide-border">
            {groups?.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <Link
                    to="/groups/$groupId"
                    params={{ groupId: g.id }}
                    className="underline-offset-4 hover:underline"
                  >
                    {g.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {g.member_count} {g.member_count === 1 ? "person" : "people"}
                    {g.archived_at ? " · archived" : ""}
                  </p>
                </div>
                <Link to="/groups/$groupId" params={{ groupId: g.id }}>
                  <Button variant="ghost" size="sm">
                    Open
                  </Button>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
