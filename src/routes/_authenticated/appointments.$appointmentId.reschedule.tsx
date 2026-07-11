import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import {
  fetchAllSlots,
  fetchAppointmentById,
  formatFullDate,
  formatTime,
  type AvailabilitySlot,
} from "@/lib/booking-queries";

export const Route = createFileRoute("/_authenticated/appointments/$appointmentId/reschedule")({
  component: ReschedulePage,
});

function ReschedulePage() {
  const { appointmentId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const apptQ = useQuery({
    queryKey: ["appointment", appointmentId],
    queryFn: () => fetchAppointmentById(appointmentId),
  });

  const doctorId = apptQ.data?.doctor_id;
  const consultationTypeId = apptQ.data?.consultation_type_id;
  const currentSlotId = apptQ.data?.availability_slot_id;

  const slotsQ = useQuery({
    queryKey: ["slots", doctorId, consultationTypeId],
    enabled: !!doctorId && !!consultationTypeId,
    queryFn: () => fetchAllSlots(doctorId!, consultationTypeId!),
  });

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [newSlotId, setNewSlotId] = useState<string | null>(null);

  const dates = useMemo(() => {
    const map = new Map<string, AvailabilitySlot[]>();
    (slotsQ.data ?? []).forEach((s) => {
      const arr = map.get(s.slot_date) ?? [];
      arr.push(s);
      map.set(s.slot_date, arr);
    });
    return Array.from(map.entries()).map(([date, slots]) => ({
      date,
      slots,
      availableCount: slots.filter((s) => s.status === "available" || s.id === currentSlotId).length,
    }));
  }, [slotsQ.data, currentSlotId]);

  const timesForDate = useMemo(() => {
    if (!selectedDate) return [];
    return dates.find((d) => d.date === selectedDate)?.slots ?? [];
  }, [dates, selectedDate]);

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      if (!newSlotId || !currentSlotId) throw new Error("Please pick a new time.");
      if (newSlotId === currentSlotId) throw new Error("Pick a different time slot.");
      const { error: rpcErr } = await (supabase as any).rpc("reschedule_appointment", {
        p_appointment_id: appointmentId,
        p_new_slot_id: newSlotId,
      });
      if (rpcErr) throw rpcErr;
    },
    onSuccess: async () => {
      toast.success("Appointment rescheduled");
      await queryClient.invalidateQueries({ queryKey: ["appointment", appointmentId] });
      await queryClient.invalidateQueries({ queryKey: ["visits"] });
      await queryClient.invalidateQueries({ queryKey: ["slots", doctorId, consultationTypeId] });
      navigate({ to: "/appointments/$appointmentId", params: { appointmentId } });
    },
    onError: (err: Error) => toast.error(err.message || "Couldn't reschedule"),
  });

  const currentSlot = apptQ.data?.availability_slots;

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

        {slotsQ.data && dates.length > 0 && (
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
                    const isAvailable = s.status === "available" && !isCurrent;
                    const isSelected = newSlotId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={!isAvailable}
                        onClick={() => isAvailable && setNewSlotId(s.id)}
                        className={`min-h-11 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                          isCurrent
                            ? "cursor-not-allowed border-primary/40 bg-primary-soft text-primary"
                            : !isAvailable
                            ? "cursor-not-allowed border-dashed border-border bg-muted text-muted-foreground line-through opacity-70"
                            : isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-foreground hover:border-primary/50"
                        }`}
                      >
                        {formatTime(s.start_time)}
                        {isCurrent && <span className="ml-1 text-[10px]">(now)</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {slotsQ.data && dates.length === 0 && (
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
          <Button
            className="h-12 w-full rounded-xl text-base"
            disabled={!newSlotId || rescheduleMutation.isPending}
            onClick={() => rescheduleMutation.mutate()}
          >
            {rescheduleMutation.isPending ? "Rescheduling…" : "Confirm new time"}
          </Button>
        </div>
      </div>
    </AppShell>
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