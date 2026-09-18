import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  addGroupMember,
  getGroup,
  removeGroupMember,
  renameGroup,
  setGroupArchived,
} from "@/lib/groups.functions";
import { getOrgContext } from "@/lib/org.functions";
import { createPost, deletePost, listPosts } from "@/lib/posts.functions";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/groups/$groupId")({
  head: () => ({
    meta: [
      { title: "Group — BENTO" },
      { name: "description", content: "A BENTO group and the people in it." },
      { property: "og:title", content: "Group — BENTO" },
      { property: "og:description", content: "A BENTO group and the people in it." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GroupDetailPage,
});

function GroupDetailPage() {
  const { groupId } = Route.useParams();
  const fetchGroup = useServerFn(getGroup);
  const fetchContext = useServerFn(getOrgContext);
  const rename = useServerFn(renameGroup);
  const archive = useServerFn(setGroupArchived);
  const addMember = useServerFn(addGroupMember);
  const removeMember = useServerFn(removeGroupMember);

  const { data: ctx } = useQuery({ queryKey: ["org-context"], queryFn: () => fetchContext() });
  const { data, isPending, refetch } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => fetchGroup({ data: { id: groupId } }),
  });

  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

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

  const isAdmin = data?.isAdmin ?? false;
  const memberIds = new Set((data?.members ?? []).map((m) => m.id));
  const candidates = (ctx?.members ?? []).filter((m) => !memberIds.has(m.id));

  return (
    <div className="min-h-screen bg-background">
      <AppHeader orgName={ctx?.organization?.name} />
      <main className="mx-auto max-w-3xl space-y-8 px-6 py-12">
        {isPending && <p className="text-muted-foreground">Loading…</p>}

        {!isPending && !data && (
          <div className="surface p-6">
            <h1 className="text-2xl">Group not available</h1>
            <p className="mt-2 text-muted-foreground">
              This group doesn't exist, or you haven't been added to it.
            </p>
            <Link to="/groups" className="mt-4 inline-block underline underline-offset-4">
              Back to your groups
            </Link>
          </div>
        )}

        {data && (
          <>
            <div>
              <h1 className="text-4xl">{data.group.name}</h1>
              <p className="mt-3 text-muted-foreground">
                {data.members.length} {data.members.length === 1 ? "person" : "people"}
                {data.group.archived_at ? " · archived" : ""}
              </p>
            </div>

            {isAdmin && (
              <section className="surface p-6">
                <h2 className="text-xl">Group settings</h2>
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <div className="min-w-56 flex-1 space-y-2">
                    <Label htmlFor="rename">Rename group</Label>
                    <Input
                      id="rename"
                      value={newName}
                      placeholder={data.group.name}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>
                  <Button
                    disabled={busy || newName.trim().length < 2}
                    onClick={() =>
                      run(async () => {
                        await rename({ data: { id: groupId, name: newName.trim() } });
                        setNewName("");
                      }, "Group renamed.")
                    }
                  >
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => archive({ data: { id: groupId, archived: !data.group.archived_at } }),
                        data.group.archived_at ? "Group restored." : "Group archived.",
                      )
                    }
                  >
                    {data.group.archived_at ? "Restore" : "Archive"}
                  </Button>
                </div>
              </section>
            )}

            <section className="surface p-6">
              <h2 className="text-xl">People in this group</h2>
              <ul className="mt-4 divide-y divide-border">
                {data.members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm">{m.full_name ?? m.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.email} · {m.role}
                      </p>
                    </div>
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () => removeMember({ data: { groupId, userId: m.id } }),
                            "Removed from the group.",
                          )
                        }
                      >
                        Remove
                      </Button>
                    )}
                  </li>
                ))}
              </ul>

              {isAdmin && (
                <div className="mt-6">
                  <h3 className="text-sm text-muted-foreground">Add someone from your organization</h3>
                  {candidates.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">Everyone is already in this group.</p>
                  ) : (
                    <ul className="mt-2 divide-y divide-border">
                      {candidates.map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                          <div>
                            <p className="text-sm">{m.full_name ?? m.email}</p>
                            <p className="text-xs text-muted-foreground">{m.email}</p>
                          </div>
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              run(
                                () => addMember({ data: { groupId, userId: m.id } }),
                                "Added to the group.",
                              )
                            }
                          >
                            Add
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
