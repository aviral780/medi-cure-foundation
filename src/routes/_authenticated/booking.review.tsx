import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { z } from "zod";
import { ArrowLeft, Calendar, Clock, MapPin, User, Video } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  fetchConsultationTypeById,
  fetchDoctorById,
  fetchSlotById,
  formatFee,
  formatMode,
  formatTime,
} from "@/lib/booking-queries";

const searchSchema = z.object({
  doctorId: z.string().min(1),
  consultationTypeId: z.string().min(1),
  slotId: z.string().min(1),
});

export const Route = createFileRoute("/_authenticated/booking/review")({
  validateSearch: (raw): z.infer<typeof searchSchema> => searchSchema.parse(raw),
  component: BookingReviewPage,
});

function BookingReviewPage() {
  const { doctorId, consultationTypeId, slotId } = Route.useSearch();
  const navigate = useNavigate();

  const [doctorQ, typeQ, slotQ] = useQueries({
    queries: [
      { queryKey: ["doctor", doctorId], queryFn: () => fetchDoctorById(doctorId) },
      { queryKey: ["consultation-type", consultationTypeId], queryFn: () => fetchConsultationTypeById(consultationTypeId) },
      { queryKey: ["slot", slotId], queryFn: () => fetchSlotById(slotId) },
    ],
  });

  const loading = doctorQ.isLoading || typeQ.isLoading || slotQ.isLoading;
  const anyError = doctorQ.error || typeQ.error || slotQ.error;
  const doctor = doctorQ.data;
  const type = typeQ.data;
  const slot = slotQ.data;
  const missing = !loading && (!doctor || !type || !slot);
  const unavailable = !!slot && slot.status !== "available";

  function backToPick() {
    navigate({ to: "/doctors/$doctorId/book", params: { doctorId } });
  }

  return (
    <AppShell>
      <section className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
        <Link
          to="/doctors/$doctorId/book"
          params={{ doctorId }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Link>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Review your booking</h1>
        <p className="mt-1 text-sm text-muted-foreground">Confirm the details below before proceeding.</p>

        {loading && <div className="mt-6 h-64 animate-pulse rounded-2xl bg-muted" />}

        {!loading && anyError && (
          <StateCard tone="error" title="Couldn't load booking details" action={<Button variant="outline" onClick={backToPick}>Change selection</Button>}>
            We ran into a problem loading your selection. Please try again.
          </StateCard>
        )}

        {!loading && !anyError && missing && (
          <StateCard tone="error" title="Selection not found" action={<Button onClick={backToPick}>Pick again</Button>}>
            Some of your selection is no longer available.
          </StateCard>
        )}

        {!loading && !anyError && !missing && unavailable && (
          <StateCard tone="warn" title="Slot no longer available" action={<Button onClick={backToPick}>Choose another time</Button>}>
            The time slot you selected has just been taken. Please pick a different time.
          </StateCard>
        )}

        {!loading && !anyError && !missing && !unavailable && doctor && type && slot && (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
              <SummaryRow icon={User} label="Doctor" value={doctor.full_name} sub={doctor.specialization} />
              <SummaryRow
                icon={type.mode === "online" ? Video : MapPin}
                label="Consultation"
                value={type.name}
                sub={`${formatMode(type.mode)} · ${type.duration_minutes} min`}
              />
              <SummaryRow icon={Calendar} label="Date" value={formatFullDate(slot.slot_date)} />
              <SummaryRow icon={Clock} label="Time" value={`${formatTime(slot.start_time)} – ${formatTime(slot.end_time)}`} last />
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-5">
              <span className="text-sm font-medium text-muted-foreground">Total</span>
              <span className="text-2xl font-semibold text-foreground">{formatFee(type.fee, type.currency)}</span>
            </div>

            <div className="grid gap-2 pt-2 sm:grid-cols-2">
              <Button variant="outline" className="h-12 rounded-xl" onClick={backToPick}>
                Change selection
              </Button>
              <Button
                disabled
                className="h-12 rounded-xl"
                title="Booking confirmation will be enabled in the next stage."
              >
                Confirm booking
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Booking confirmation will be enabled in the next stage.
            </p>
          </div>
        )}
      </section>
    </AppShell>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
  sub,
  last,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  last?: boolean;
}) {
  return (
    <div className={`flex items-start gap-3 py-3 ${last ? "" : "border-b border-border/60"}`}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm font-semibold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function StateCard({
  tone,
  title,
  action,
  children,
}: {
  tone: "error" | "warn";
  title: string;
  action: React.ReactNode;
  children: React.ReactNode;
}) {
  const cls =
    tone === "error"
      ? "border-destructive/30 bg-destructive/5 text-destructive"
      : "border-amber-400/40 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200";
  return (
    <div className={`mt-6 rounded-2xl border p-6 ${cls}`}>
      <p className="text-base font-semibold">{title}</p>
      <p className="mt-1 text-sm opacity-90">{children}</p>
      <div className="mt-4">{action}</div>
    </div>
  );
}

function formatFullDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}