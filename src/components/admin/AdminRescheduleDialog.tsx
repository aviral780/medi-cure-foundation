import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, Clock, Loader2, Video } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchAppointmentById,
  fetchAvailableSlots,
  formatFullDate,
  formatTime,
  isSlotStartInPast,
  type AvailabilitySlot,
} from "@/lib/booking-queries";
import { adminRescheduleAppointment } from "@/lib/admin-appointments-api";
import { cn } from "@/lib/utils";

export function AdminRescheduleDialog({
  appointmentId,
  open,
  onOpenChange,
}: {
  appointmentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const enabled = Boolean(appointmentId) && open;

  const apptQ = useQuery({
    queryKey: ["admin-reschedule-appt", appointmentId],
    queryFn: () => fetchAppointmentById(appointmentId as string),
    enabled,
  });
  const appt = apptQ.data ?? null;

  const slotsQ = useQuery({
    queryKey: ["admin-reschedule-slots", appt?.doctor_id, appt?.consultation_type_id],
    queryFn: () =>
      fetchAvailableSlots(appt!.doctor_id as string, appt!.consultation_type_id as string),
    enabled: enabled && Boolean(appt?.doctor_id && appt?.consultation_type_id),
  });

  const grouped = useMemo(() => {
    const slots = (slotsQ.data ?? []).filter(
      (s) =>
        (s.status ?? "").toLowerCase() === "available" &&
        s.id !== appt?.availability_slot_id &&
        !isSlotStartInPast(s),
    );
    const map = new Map<string, AvailabilitySlot[]>();
    for (const s of slots) {
      const list = map.get(s.slot_date) ?? [];
      list.push(s);
      map.set(s.slot_date, list);
    }
    return Array.from(map.entries());
  }, [slotsQ.data, appt?.availability_slot_id]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!appointmentId || !selectedSlot) throw new Error("Pick a new slot first.");
      await adminRescheduleAppointment({ appointmentId, newSlotId: selectedSlot });
    },
    onSuccess: async () => {
      toast.success("Appointment rescheduled");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-appt-detail", appointmentId] }),
        queryClient.invalidateQueries({ queryKey: ["admin-reschedule-slots"] }),
        queryClient.invalidateQueries({ queryKey: ["visits"] }),
        queryClient.invalidateQueries({ queryKey: ["slots"] }),
      ]);
      setSelectedSlot(null);
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message || "Couldn't reschedule appointment"),
  });

  const isOnline = appt?.consultation_types?.mode === "online";

  return (
    <Dialog open={open} onOpenChange={(v) => !mutation.isPending && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border bg-gradient-to-br from-primary/10 via-card to-card px-6 pb-5 pt-6 text-left">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CalendarClock className="h-5 w-5 text-primary" aria-hidden />
            Reschedule appointment
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            {appt?.appointment_date
              ? `Currently ${formatFullDate(appt.appointment_date)}${
                  appt.start_time ? ` · ${formatTime(appt.start_time)}` : ""
                }`
              : "Pick a new available slot."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[52vh]">
          <div className="space-y-5 px-6 py-5">
            {isOnline && (
              <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                <Video className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <p>
                  This is an online consultation — the Google Meet link stays the same and the
                  calendar event is moved automatically.
                </p>
              </div>
            )}

            {(apptQ.isLoading || slotsQ.isLoading) && (
              <div className="space-y-3">
                <Skeleton className="h-6 w-40 rounded-lg" />
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            )}

            {!slotsQ.isLoading && grouped.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
                No available slots for this doctor and consultation type.
              </div>
            )}

            {grouped.map(([date, slots]) => (
              <div key={date}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {formatFullDate(date)}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {slots.map((s) => {
                    const active = selectedSlot === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedSlot(s.id)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition-all",
                          active
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-primary/5",
                        )}
                      >
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                        {formatTime(s.start_time)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            className="rounded-xl"
            disabled={!selectedSlot || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            Confirm new time
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}