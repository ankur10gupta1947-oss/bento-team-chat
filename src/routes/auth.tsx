import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const searchSchema = z.object({
  mode: z.enum(["signup", "login"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in to BENTO" },
      { name: "description", content: "Sign in to BENTO or create your company's organization." },
      { property: "og:title", content: "Sign in to BENTO" },
      { property: "og:description", content: "Private team communication for small and midsize companies." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(mode === "signup");
  const [orgName, setOrgName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin + "/dashboard",
            data: { organization_name: orgName.trim(), full_name: fullName.trim() },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setCheckEmail(true);
          return;
        }
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (checkEmail) {
    return (
      <Shell>
        <h1 className="text-3xl">Check your email</h1>
        <p className="mt-3 text-muted-foreground">
          We sent a confirmation link to <span className="text-foreground">{email}</span>. Click it to
          finish setting up {orgName || "your organization"}.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-3xl">{isSignup ? "Create your organization" : "Welcome back"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {isSignup
          ? "You'll become the admin of this organization."
          : "Sign in to your company's workspace."}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {isSignup && (
          <>
            <div className="space-y-2">
              <Label htmlFor="org">Organization name</Label>
              <Input
                id="org"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Acme Inc."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Your name</Label>
              <Input
                id="name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
          </>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete={isSignup ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Please wait…" : isSignup ? "Create organization" : "Sign in"}
        </Button>
      </form>

      <button
        type="button"
        className="mt-6 text-sm text-muted-foreground underline underline-offset-4"
        onClick={() => setIsSignup((v) => !v)}
      >
        {isSignup ? "Already have an account? Sign in" : "Need an organization? Create one"}
      </button>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-md">
        <Link to="/" className="font-display text-xl tracking-tight">
          BENTO
        </Link>
        <div className="surface mt-6 p-8">{children}</div>
      </div>
    </main>
  );
}
