import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, MapPin, Video } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatMode, formatTime } from "@/lib/booking-queries";

export const Route = createFileRoute("/_authenticated/visits")({
  component: VisitsPage,
});

type Visit = {
  id: string;
  status: string | null;
  patient_notes: string | null;
  created_at: string;
  doctors: { full_name: string; specialization: string } | null;
  consultation_types: { name: string; mode: string; duration_minutes: number } | null;
  availability_slots: { slot_date: string; start_time: string; end_time: string } | null;
};

function VisitsPage() {
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["visits", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("appointments")
        .select(
          "id, status, patient_notes, created_at, doctors(full_name, specialization), consultation_types(name, mode, duration_minutes), availability_slots(slot_date, start_time, end_time)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Visit[];
    },
  });

  const { upcoming, past } = splitVisits(data ?? []);

  return (
    <AppShell>
      <section className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Your visits</h1>
        <p className="mt-1 text-sm text-muted-foreground">All your MediCure appointments in one place.</p>

        {isLoading && <div className="mt-6 h-40 animate-pulse rounded-2xl bg-muted" />}
        {error && (
          <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-destructive">
            <p className="font-semibold">Couldn't load visits</p>
            <p className="mt-1 text-sm opacity-90">{(error as Error).message}</p>
          </div>
        )}

        {!isLoading && !error && (data ?? []).length === 0 && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center">
            <Calendar className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="mt-3 text-base font-semibold text-foreground">No visits yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Book your first appointment to get started.</p>
            <Button asChild className="mt-4 h-11 rounded-xl">
              <Link to="/doctors">Find a doctor</Link>
            </Button>
          </div>
        )}

        {!isLoading && !error && (data ?? []).length > 0 && (
          <div className="mt-6 space-y-8">
            <VisitGroup title="Upcoming" visits={upcoming} emptyText="No upcoming visits." />
            <VisitGroup title="Past" visits={past} emptyText="No past visits yet." />
          </div>
        )}
      </section>
    </AppShell>
  );
}

function VisitGroup({ title, visits, emptyText }: { title: string; visits: Visit[]; emptyText: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {visits.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {visits.map((v) => (
            <li key={v.id}>
              <VisitCard visit={v} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VisitCard({ visit }: { visit: Visit }) {
  const doc = visit.doctors;
  const type = visit.consultation_types;
  const slot = visit.availability_slots;
  const ModeIcon = type?.mode === "online" ? Video : MapPin;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-foreground">{doc?.full_name ?? "Doctor"}</p>
          <p className="truncate text-xs text-muted-foreground">{doc?.specialization ?? ""}</p>
        </div>
        {visit.status && (
          <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium capitalize text-primary">
            {visit.status}
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
        {slot && (
          <>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4" aria-hidden />
              {formatFullDate(slot.slot_date)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" aria-hidden />
              {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
            </span>
          </>
        )}
        {type && (
          <span className="inline-flex items-center gap-1.5">
            <ModeIcon className="h-4 w-4" aria-hidden />
            {type.name} · {formatMode(type.mode)}
          </span>
        )}
      </div>
    </div>
  );
}

function splitVisits(visits: Visit[]): { upcoming: Visit[]; past: Visit[] } {
  const now = Date.now();
  const upcoming: Visit[] = [];
  const past: Visit[] = [];
  for (const v of visits) {
    const slot = v.availability_slots;
    const ts = slot ? new Date(`${slot.slot_date}T${slot.end_time}`).getTime() : 0;
    if (ts >= now) upcoming.push(v);
    else past.push(v);
  }
  upcoming.sort((a, b) => slotTime(a) - slotTime(b));
  past.sort((a, b) => slotTime(b) - slotTime(a));
  return { upcoming, past };
}

function slotTime(v: Visit): number {
  const s = v.availability_slots;
  return s ? new Date(`${s.slot_date}T${s.start_time}`).getTime() : 0;
}

function formatFullDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}