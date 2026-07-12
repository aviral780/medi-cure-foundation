import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, CheckCircle2, ClipboardList, Search, Stethoscope, Video } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How it works — MediCure" },
      {
        name: "description",
        content:
          "Book a doctor on MediCure in five simple steps — find a specialist, choose in-person or video, pick a slot, confirm, and manage in Visits.",
      },
      { property: "og:title", content: "How it works — MediCure" },
      {
        property: "og:description",
        content: "Book verified doctors in minutes with MediCure — in-person or secure video visits.",
      },
    ],
  }),
  component: HowItWorksPage,
});

const steps = [
  {
    icon: Search,
    title: "Open the doctor's profile",
    body: "Review our clinic doctor's background, qualifications, and available consultation options.",
  },
  {
    icon: Stethoscope,
    title: "Choose consultation type",
    body: "Pick an in-person clinic visit or a secure video consultation — whichever fits you best.",
  },
  {
    icon: CalendarClock,
    title: "Pick a date & time",
    body: "See real-time availability and select a slot that works for your schedule.",
  },
  {
    icon: CheckCircle2,
    title: "Review & confirm",
    body: "Double-check the details and confirm your booking — you'll get instant confirmation.",
  },
  {
    icon: ClipboardList,
    title: "Manage in Visits",
    body: "View, reschedule, or cancel any appointment anytime from the Visits tab.",
  },
];

function HowItWorksPage() {
  return (
    <AppShell>
      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
          <Video className="h-3.5 w-3.5" aria-hidden />
          Booking a visit
        </span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          How MediCure works
        </h1>
        <p className="mt-2 max-w-xl text-base text-muted-foreground">
          From finding the right doctor to managing your appointment — here's what to expect.
        </p>

        <ol className="mt-8 space-y-3">
          {steps.map((s, i) => (
            <li
              key={s.title}
              className="flex gap-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
            >
              <div className="flex flex-col items-center">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
                  {i + 1}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-primary">
                  <s.icon className="h-4 w-4" aria-hidden />
                  <h2 className="text-base font-semibold text-foreground">{s.title}</h2>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10 rounded-2xl border border-border bg-card p-6 text-center shadow-[var(--shadow-soft)] sm:p-8">
          <h2 className="text-xl font-semibold text-foreground sm:text-2xl">Ready when you are</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a specialist and book your first appointment in under a minute.
          </p>
          <Button asChild size="lg" className="mt-5 h-12 rounded-xl px-6 text-base">
            <Link to="/doctors">Book an appointment</Link>
          </Button>
        </div>
      </section>
    </AppShell>
  );
}