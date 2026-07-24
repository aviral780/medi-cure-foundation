import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  fetchAllSlots,
  fetchAppointmentById,
  formatFullDate,
  formatTime,
  isSlotExpired,
  isSlotStartInPast,
  localDateTimeMs,
  evaluateRescheduleEligibility,
  RESCHEDULE_FEE_INR,
  type AvailabilitySlot,
} from "@/lib/booking-queries";
import { SlotButton } from "@/components/booking/SlotButton";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated/appointments/$appointmentId/reschedule")({
  component: ReschedulePage,
});

function ReschedulePage() {
  const { appointmentId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  void queryClient;

  const apptQ = useQuery({
    queryKey: ["appointment", appointmentId],
    queryFn: () => fetchAppointmentById(appointmentId),
  });

  const doctorId = apptQ.data?.doctor_id;
  const consultationTypeId = apptQ.data?.consultation_type_id;
  const currentSlotId = apptQ.data?.availability_slot_id;
  const currentSlot = apptQ.data?.availability_slots;
  const currentDate = apptQ.data?.appointment_date ?? currentSlot?.slot_date ?? null;
  const currentStartTime = apptQ.data?.start_time ?? currentSlot?.start_time ?? null;
  const currentEndTime = apptQ.data?.end_time ?? currentSlot?.end_time ?? null;
  const appointmentStatus = (apptQ.data?.appointment_status ?? "").toLowerCase();
  const isCancelled = appointmentStatus === "cancelled" || appointmentStatus === "canceled";
  const isPastAppointment = currentDate && currentEndTime ? localDateTimeMs(currentDate, currentEndTime) < Date.now() : false;
  const eligibility = apptQ.data
    ? evaluateRescheduleEligibility({
        appointmentStatus: apptQ.data.appointment_status,
        startDate: currentDate,
        startTime: currentStartTime,
      })
    : { canReschedule: false as const, reason: "" };
  const canReschedule = eligibility.canReschedule;

  const slotsQ = useQuery({
    queryKey: ["slots", doctorId, consultationTypeId],
    enabled: !!doctorId && !!consultationTypeId && canReschedule,
    queryFn: () => fetchAllSlots(doctorId!, consultationTypeId!),
  });

  // Realtime: keep the picker in sync with admin schedule edits and other
  // patients' bookings.
  useEffect(() => {
    if (!doctorId || !consultationTypeId) return;
    const channel = (supabase as any)
      .channel(`reschedule-slots:${doctorId}:${consultationTypeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "availability_slots" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["slots", doctorId, consultationTypeId] });
        },
      )
      .subscribe();
    return () => {
      (supabase as any).removeChannel(channel);
    };
  }, [queryClient, doctorId, consultationTypeId]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [newSlotId, setNewSlotId] = useState<string | null>(null);

  const dates = useMemo(() => {
    const map = new Map<string, AvailabilitySlot[]>();
    (slotsQ.data ?? [])
      .filter((s) => !isSlotExpired(s))
      .forEach((s) => {
        const arr = map.get(s.slot_date) ?? [];
        arr.push(s);
        map.set(s.slot_date, arr);
      });
    return Array.from(map.entries()).map(([date, slots]) => ({
      date,
      slots,
      availableCount: slots.filter(
        (s) => (s.status === "available" && !isSlotStartInPast(s)) || s.id === currentSlotId,
      ).length,
    }));
  }, [slotsQ.data, currentSlotId]);

  useEffect(() => {
    if (selectedDate || dates.length === 0) return;
    const currentDateWithSlots = currentSlot?.slot_date && dates.some((d) => d.date === currentSlot.slot_date);
    setSelectedDate(currentDateWithSlots ? currentSlot.slot_date : dates[0]!.date);
  }, [currentSlot?.slot_date, dates, selectedDate]);

  const timesForDate = useMemo(() => {
    if (!selectedDate) return [];
    return dates.find((d) => d.date === selectedDate)?.slots ?? [];
  }, [dates, selectedDate]);

  const proceedMutation = useMutation({
    mutationFn: async () => {
      if (!newSlotId || !currentSlotId) throw new Error("Please pick a new time.");
      if (newSlotId === currentSlotId) throw new Error("Pick a different time slot.");
      if (!canReschedule) {
        throw new Error(
          "reason" in eligibility && eligibility.reason
            ? eligibility.reason
            : "This appointment can't be rescheduled.",
        );
      }
    },
    onSuccess: () => {
      navigate({
        to: "/reschedule-payment/$appointmentId",
        params: { appointmentId },
        search: { newSlotId: newSlotId! },
      });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return (
    <AppShell>
      <section className="mx-auto max-w-2xl px-4 py-6 pb-40 sm:px-6 sm:py-10">
        <Link
          to="/appointments/$appointmentId"
          params={{ appointmentId }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Link>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Reschedule appointment
        </h1>
        {currentSlot && (
          <p className="mt-1 text-sm text-muted-foreground">
            Currently: <span className="font-medium text-foreground">{formatFullDate(currentSlot.slot_date)}</span> at{" "}
            <span className="font-medium text-foreground">{formatTime(currentSlot.start_time)}</span>
          </p>
        )}

        {(apptQ.isLoading || slotsQ.isLoading) && (
          <div className="mt-6 h-40 animate-pulse rounded-2xl bg-muted" />
        )}

        {apptQ.error && (
          <StateBox title="Couldn't load appointment">
            We couldn't open this appointment for rescheduling. Please go back to Visits and try again.
          </StateBox>
        )}

        {!apptQ.isLoading && !apptQ.error && !apptQ.data && (
          <StateBox title="Appointment not found">
            This appointment could not be found.
          </StateBox>
        )}

        {apptQ.data && !canReschedule && (
          <StateBox title="Rescheduling unavailable">
            {"reason" in eligibility && eligibility.reason
              ? eligibility.reason
              : isCancelled
              ? "Cancelled appointments can't be rescheduled."
              : "Past appointments can't be rescheduled."}
          </StateBox>
        )}

        {slotsQ.error && (
          <StateBox title="Couldn't load availability">
            We couldn't load future time slots. Please try again shortly.
          </StateBox>
        )}

        {canReschedule && slotsQ.data && dates.length > 0 && (
          <>
            <div className="mt-6">
              <div className="mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" aria-hidden />
                <h2 className="text-base font-semibold text-foreground">Choose a new date</h2>
              </div>
              <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
                {dates.map(({ date, availableCount }) => (
                  <DateChip
                    key={date}
                    date={date}
                    count={availableCount}
                    selected={selectedDate === date}
                    onClick={() => {
                      setSelectedDate(date);
                      setNewSlotId(null);
                    }}
                  />
                ))}
              </div>
            </div>

            {selectedDate && (
              <div className="mt-6">
                <div className="mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" aria-hidden />
                  <h2 className="text-base font-semibold text-foreground">Pick a time</h2>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {timesForDate.map((s) => {
                    const isCurrent = s.id === currentSlotId;
                    const expired = isSlotStartInPast(s);
                    const state = isCurrent
                      ? "current"
                      : expired
                      ? "expired"
                      : s.status === "available"
                      ? "available"
                      : "booked";
                    return (
                      <SlotButton
                        key={s.id}
                        startTime={s.start_time}
                        state={state}
                        selected={newSlotId === s.id}
                        onSelect={() => setNewSlotId(s.id)}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {canReschedule && slotsQ.data && dates.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No other availability right now. Try again later or cancel this appointment.
          </div>
        )}
      </section>

      <div
        className="fixed inset-x-0 bottom-14 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:bottom-0 sm:px-6"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <div className="mx-auto max-w-2xl">
          <p className="mb-2 text-center text-[11px] text-muted-foreground">
            A ₹{RESCHEDULE_FEE_INR} reschedule fee applies. Your original time is held until payment succeeds.
          </p>
          <Button
            className="h-12 w-full rounded-xl text-base"
            disabled={!canReschedule || !newSlotId || proceedMutation.isPending}
            onClick={() => proceedMutation.mutate()}
          >
            {proceedMutation.isPending ? "Continuing…" : `Continue to pay ₹${RESCHEDULE_FEE_INR}`}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function StateBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
      <p className="text-base font-semibold text-foreground">{title}</p>
      <p className="mt-1">{children}</p>
    </div>
  );
}

function DateChip({
  date,
  count,
  selected,
  onClick,
}: {
  date: string;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  const weekday = dt.toLocaleDateString(undefined, { weekday: "short" });
  const month = dt.toLocaleDateString(undefined, { month: "short" });
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-[76px] snap-start flex-col items-center rounded-xl border px-3 py-3 transition-colors ${
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:border-primary/50"
      }`}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide opacity-80">{weekday}</span>
      <span className="mt-0.5 text-lg font-semibold leading-none">{dt.getDate()}</span>
      <span className="mt-0.5 text-[11px] uppercase tracking-wide opacity-80">{month}</span>
      <span className={`mt-1.5 text-[10px] ${selected ? "opacity-80" : "text-muted-foreground"}`}>
        {count} slot{count === 1 ? "" : "s"}
      </span>
    </button>
  );
}