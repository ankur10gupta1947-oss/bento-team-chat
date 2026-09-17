import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function AppHeader({ orgName }: { orgName?: string | undefined }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="border-b border-border bg-card/60">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
        <div className="flex items-baseline gap-3">
          <Link to="/dashboard" className="font-display text-xl tracking-tight">
            BENTO
          </Link>
          {orgName && <span className="text-sm text-muted-foreground">{orgName}</span>}
        </div>
        <nav className="flex items-center gap-1">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm">
              Home
            </Button>
          </Link>
          <Link to="/settings">
            <Button variant="ghost" size="sm">
              Settings
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </nav>
      </div>
    </header>
  );
}
