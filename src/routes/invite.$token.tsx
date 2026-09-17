import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getInvitePreview } from "@/lib/org.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({
    meta: [
      { title: "Join your team on BENTO" },
      { name: "description", content: "Accept your invitation and join your company's BENTO workspace." },
      { property: "og:title", content: "Join your team on BENTO" },
      { property: "og:description", content: "Accept your BENTO invitation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const preview = useServerFn(getInvitePreview);
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: ["invite", token],
    queryFn: () => preview({ data: { token } }),
  });

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!data || data.status !== "valid") return;
    setBusy(true);
    try {
      const { data: signed, error } = await supabase.auth.signUp({
        email: data.email,
        password,
        options: {
          emailRedirectTo: window.location.origin + "/dashboard",
          data: { invite_token: token, full_name: fullName.trim() },
        },
      });
      if (error) throw error;
      if (!signed.session) {
        setCheckEmail(true);
        return;
      }
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not accept the invite.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-md">
        <Link to="/" className="font-display text-xl tracking-tight">
          BENTO
        </Link>
        <div className="surface mt-6 p-8">
          {isPending && <p className="text-muted-foreground">Checking your invite…</p>}

          {data && data.status !== "valid" && (
            <>
              <h1 className="text-2xl">This invite can't be used</h1>
              <p className="mt-3 text-muted-foreground">
                {data.status === "used"
                  ? "It has already been accepted."
                  : data.status === "expired"
                    ? "It has expired. Ask your admin to send a new one."
                    : "The link isn't valid. Ask your admin to send a new one."}
              </p>
            </>
          )}

          {data && data.status === "valid" && checkEmail && (
            <>
              <h1 className="text-2xl">Check your email</h1>
              <p className="mt-3 text-muted-foreground">
                We sent a confirmation link to {data.email}. Click it to join {data.organizationName}.
              </p>
            </>
          )}

          {data && data.status === "valid" && !checkEmail && (
            <>
              <h1 className="text-2xl">Join {data.organizationName}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Invitation for <span className="text-foreground">{data.email}</span>
              </p>
              <form onSubmit={handleJoin} className="mt-8 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Your name</Label>
                  <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Choose a password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Please wait…" : "Join the team"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
