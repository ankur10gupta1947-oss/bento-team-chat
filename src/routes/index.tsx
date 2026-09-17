import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BENTO — Calm team communication you own" },
      {
        name: "description",
        content:
          "BENTO is a private, hosted team communication tool for small and midsize companies. Announcements and team discussion without the noise.",
      },
      { property: "og:title", content: "BENTO — Calm team communication you own" },
      {
        property: "og:description",
        content: "A private, hosted alternative to Slack and WhatsApp for company announcements.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-8">
        <span className="font-display text-2xl tracking-tight">BENTO</span>
        <Link to="/auth">
          <Button variant="ghost">Sign in</Button>
        </Link>
      </header>

      <section className="mx-auto max-w-3xl px-6 pt-16 pb-24 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Private team communication</p>
        <h1 className="mt-6 text-5xl leading-tight sm:text-6xl">
          A calmer place for your company's announcements.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Your company's conversations, hosted privately and kept strictly separate from everyone
          else's. No noise, no sprawl.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link to="/auth" search={{ mode: "signup" }}>
            <Button size="lg">Create your organization</Button>
          </Link>
          <Link to="/auth">
            <Button size="lg" variant="outline">
              Sign in
            </Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
