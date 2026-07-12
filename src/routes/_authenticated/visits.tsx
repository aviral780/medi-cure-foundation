import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Calendar, CalendarClock, ChevronRight, Clock, MapPin, Video, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatMode, formatTime, formatFullDate } from "@/lib/booking-queries";
import { StatusBadge, PaymentBadge } from "@/components/appointments/StatusBadges";
import { CancelAppointmentDialog } from "@/components/appointments/CancelAppointmentDialog";

export const Route = createFileRoute("/_authenticated/visits")({
  component: VisitsPage,
});

type Visit = {
  id: string;
  appointment_status: string | null;
  payment_status: string | null;
  patient_notes: string | null;
  created_at: string;
  appointment_date: string | null;
  start_time: string | null;
  end_time: string | null;
  doctors: { full_name: string; specialization: string } | null;
  consultation_types: { name: string; mode: string; duration_minutes: number } | null;
  availability_slots: { slot_date: string; start_time: string; end_time: string } | null;
};

function VisitsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["visits", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("appointments")
        .select(
          "id, appointment_status, payment_status, patient_notes, created_at, appointment_date, start_time, end_time, doctors(full_name, specialization), consultation_types(name, mode, duration_minutes), availability_slots(slot_date, start_time, end_time)",
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
          <Tabs value={tab} onValueChange={(v) => setTab(v as "upcoming" | "past")} className="mt-6">
            <TabsList className="grid w-full grid-cols-2 rounded-xl">
              <TabsTrigger value="upcoming" className="rounded-lg">Upcoming ({upcoming.length})</TabsTrigger>
              <TabsTrigger value="past" className="rounded-lg">Past ({past.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="upcoming" className="mt-4">
              <VisitList
                visits={upcoming}
                emptyText="No upcoming visits. Book your next appointment."
                showActions
                onCancel={(id) => setCancelId(id)}
              />
            </TabsContent>
            <TabsContent value="past" className="mt-4">
              <VisitList visits={past} emptyText="No past visits yet." />
            </TabsContent>
          </Tabs>
        )}
      </section>
      {cancelId && (
        <CancelAppointmentDialog
          appointmentId={cancelId}
          open={!!cancelId}
          onOpenChange={(v) => !v && setCancelId(null)}
        />
      )}
    </AppShell>
  );
}

function VisitList({
  visits,
  emptyText,
  showActions,
  onCancel,
}: {
  visits: Visit[];
  emptyText: string;
  showActions?: boolean;
  onCancel?: (id: string) => void;
}) {
  if (visits.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {visits.map((v) => (
        <li key={v.id}>
          <VisitCard visit={v} showActions={showActions} onCancel={onCancel} />
        </li>
      ))}
    </ul>
  );
}

function VisitCard({
  visit,
  showActions,
  onCancel,
}: {
  visit: Visit;
  showActions?: boolean;
  onCancel?: (id: string) => void;
}) {
  const doc = visit.doctors;
  const type = visit.consultation_types;
  const slot = visit.availability_slots;
  const ModeIcon = type?.mode === "online" ? Video : MapPin;
  const date = visit.appointment_date ?? slot?.slot_date ?? null;
  const startTime = visit.start_time ?? slot?.start_time ?? null;
  const endTime = visit.end_time ?? slot?.end_time ?? null;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition-colors hover:border-primary/40">
      <Link
        to="/appointments/$appointmentId"
        params={{ appointmentId: visit.id }}
        className="block"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">{doc?.full_name ?? "Your doctor"}</p>
            <p className="truncate text-xs text-muted-foreground">{doc?.specialization ?? ""}</p>
          </div>
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
          {date && (
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4" aria-hidden />
              {formatFullDate(date)}
            </span>
          )}
          {startTime && endTime && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" aria-hidden />
              {formatTime(startTime)} – {formatTime(endTime)}
            </span>
          )}
          {type && (
            <span className="inline-flex items-center gap-1.5">
              <ModeIcon className="h-4 w-4" aria-hidden />
              {type.name} · {formatMode(type.mode)}
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusBadge status={visit.appointment_status} />
          <PaymentBadge status={visit.payment_status} />
        </div>
      </Link>
      {showActions && (
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/60 pt-3">
          <Button asChild variant="outline" size="sm" className="h-10 rounded-lg">
            <Link
              to="/appointments/$appointmentId/reschedule"
              params={{ appointmentId: visit.id }}
              onClick={(e) => e.stopPropagation()}
            >
              <CalendarClock className="mr-1.5 h-4 w-4" aria-hidden /> Reschedule
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-10 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onCancel?.(visit.id);
            }}
          >
            <X className="mr-1.5 h-4 w-4" aria-hidden /> Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

function splitVisits(visits: Visit[]): { upcoming: Visit[]; past: Visit[] } {
  const now = Date.now();
  const upcoming: Visit[] = [];
  const past: Visit[] = [];
  for (const v of visits) {
    const status = (v.appointment_status ?? "").toLowerCase();
    const isCancelled = status === "cancelled" || status === "canceled";
    const endTs = visitEndTime(v);
    if (!isCancelled && endTs >= now) upcoming.push(v);
    else past.push(v);
  }
  upcoming.sort((a, b) => visitStartTime(a) - visitStartTime(b));
  past.sort((a, b) => visitStartTime(b) - visitStartTime(a));
  return { upcoming, past };
}

function localDateTime(dateStr: string, timeStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm, ss] = timeStr.split(":").map(Number);
  const dt = new Date(
    y ?? 1970,
    (m ?? 1) - 1,
    d ?? 1,
    hh ?? 0,
    mm ?? 0,
    ss ?? 0,
  );
  return dt.getTime();
}

function visitStartTime(v: Visit): number {
  const date = v.appointment_date ?? v.availability_slots?.slot_date;
  const time = v.start_time ?? v.availability_slots?.start_time;
  if (!date || !time) return 0;
  return localDateTime(date, time);
}

function visitEndTime(v: Visit): number {
  const date = v.appointment_date ?? v.availability_slots?.slot_date;
  const time = v.end_time ?? v.availability_slots?.end_time;
  if (!date || !time) return 0;
  return localDateTime(date, time);
}