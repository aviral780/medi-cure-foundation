import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { CalendarCheck, ShieldCheck, Video } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";

// No head() here: the home route inherits title/description/og/twitter from
// __root.tsx, and ships no og:image so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  component: Index,
});

// IMPORTANT: Replace this placeholder. See ./README.md for routing conventions.
function Index() {
  return (
    <AppShell>
      <section
        className="relative overflow-hidden"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pt-20">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1 text-xs font-medium text-primary ring-1 ring-primary/20 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
              Care, when you need it
            </span>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl">
              Book trusted doctors,{" "}
              <span className="text-primary">in-person or online.</span>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              MediCure connects you with verified specialists for consultations
              that fit your schedule — from your neighborhood clinic to a
              secure video visit.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 rounded-xl px-6 text-base">
                <Link to="/doctors">Find a doctor</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 rounded-xl border-border bg-background/70 px-6 text-base backdrop-blur"
              >
                <Link to="/">How it works</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="grid gap-4 sm:grid-cols-3">
          {features.map((f) => (
            <article
              key={f.title}
              className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-elevated)]"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
                <f.icon className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-4 text-base font-semibold text-foreground">
                {f.title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {f.body}
              </p>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

const features = [
  {
    icon: CalendarCheck,
    title: "Real-time availability",
    body: "See open slots from real doctor calendars and book in under a minute.",
  },
  {
    icon: Video,
    title: "Secure teleconsultations",
    body: "Meet your doctor over encrypted video from anywhere, on any device.",
  },
  {
    icon: ShieldCheck,
    title: "Verified specialists",
    body: "Every practitioner on MediCure is credential-checked and reviewed.",
  },
];
