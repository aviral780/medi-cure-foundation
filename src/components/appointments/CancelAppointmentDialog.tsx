import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { CANCEL_CUTOFF_MESSAGE, evaluateCancelEligibility, fetchAppointmentById } from "@/lib/booking-queries";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

export function CancelAppointmentDialog({
  appointmentId,
  open,
  onOpenChange,
  onCancelled,
}: {
  appointmentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled?: () => void;
}) {
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      // Re-validate the 6-hour + status rule server-side-of-truth (fresh row).
      const fresh = await fetchAppointmentById(appointmentId);
      if (!fresh) throw new Error("Appointment not found.");
      const eligibility = evaluateCancelEligibility({
        appointmentStatus: fresh.appointment_status,
        startDate: fresh.appointment_date ?? fresh.availability_slots?.slot_date ?? null,
        startTime: fresh.start_time ?? fresh.availability_slots?.start_time ?? null,
      });
      if (!eligibility.canCancel) throw new Error(eligibility.reason);

      const { error } = await (supabase as any).rpc("cancel_appointment", {
        p_appointment_id: appointmentId,
        p_cancellation_reason: reason.trim() || null,
      });
      if (error) throw error;
      return { fresh, reason: reason.trim() || null };
    },
    onSuccess: async ({ fresh, reason: cancelReason }) => {
      toast.success("Appointment cancelled");
      // Best-effort cancellation confirmation email. Silently no-ops if the
      // email endpoint isn't configured yet — never blocks the cancellation.
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess?.session?.access_token;
        await fetch("/api/public/notifications/appointment-cancelled", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ appointment_id: appointmentId, reason: cancelReason }),
          keepalive: true,
        });
      } catch {
        // ignore — user already sees success, RPC has released the slot
      }
      void fresh;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["appointment", appointmentId] }),
        queryClient.invalidateQueries({ queryKey: ["visits"] }),
        queryClient.invalidateQueries({ queryKey: ["slots"] }),
      ]);
      onOpenChange(false);
      setReason("");
      onCancelled?.();
    },
    onError: (err: Error) => {
      const msg = err.message || "Couldn't cancel appointment";
      // Surface the 6-hour rule verbatim if the server rejected it.
      toast.error(/6 hours/i.test(msg) ? CANCEL_CUTOFF_MESSAGE : msg);
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={(v) => !mutation.isPending && onOpenChange(v)}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
          <AlertDialogDescription>
            This will free the time slot for other patients. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <label htmlFor="cancel-reason" className="text-sm font-medium text-foreground">
            Reason (optional)
          </label>
          <Textarea
            id="cancel-reason"
            rows={3}
            placeholder="Let the clinic know why…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={mutation.isPending}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Keep it</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            onClick={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {mutation.isPending ? "Cancelling…" : "Yes, cancel"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}