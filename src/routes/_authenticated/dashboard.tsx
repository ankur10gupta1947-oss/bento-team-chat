import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { bootstrapProfile, getOrgContext } from "@/lib/org.functions";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Your organization — BENTO" },
      { name: "description", content: "Your BENTO organization home." },
      { property: "og:title", content: "Your organization — BENTO" },
      { property: "og:description", content: "Your BENTO organization home." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const fetchContext = useServerFn(getOrgContext);
  const bootstrap = useServerFn(bootstrapProfile);
  const [setupError, setSetupError] = useState<string | null>(null);

  const { data, isPending, refetch } = useQuery({
    queryKey: ["org-context"],
    queryFn: () => fetchContext(),
  });

  useEffect(() => {
    if (data && !data.profile) {
      bootstrap()
        .then(() => refetch())
        .catch((err: unknown) =>
          setSetupError(err instanceof Error ? err.message : "Could not finish setting up your account."),
        );
    }
  }, [data, bootstrap, refetch]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader orgName={data?.organization?.name} />
      <main className="mx-auto max-w-4xl px-6 py-12">
        {isPending && <p className="text-muted-foreground">Loading…</p>}

        {setupError && (
          <div className="surface p-6">
            <h1 className="text-2xl">We couldn't finish setup</h1>
            <p className="mt-2 text-muted-foreground">{setupError}</p>
          </div>
        )}

        {data?.profile && data.organization && (
          <>
            <h1 className="text-4xl">{data.organization.name}</h1>
            <p className="mt-3 text-muted-foreground">
              You're signed in as {data.profile.email} ({data.profile.role}). Your organization has{" "}
              {data.members.length} {data.members.length === 1 ? "person" : "people"}.
            </p>

            <div className="surface mt-10 p-6">
              <h2 className="text-xl">People</h2>
              <ul className="mt-4 divide-y divide-border">
                {data.members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm">{m.full_name ?? m.email}</p>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </div>
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
                      {m.role}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-sm text-muted-foreground">
                Invite teammates and manage your organization in{" "}
                <Link to="/settings" className="underline underline-offset-4">
                  Settings
                </Link>
                .
              </p>
            </div>

            <p className="mt-10 text-sm text-muted-foreground">
              Groups, posts and discussion arrive in the next phase.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
