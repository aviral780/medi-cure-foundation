import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
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

/** Admin-side cancellation — reuses the existing cancel_appointment RPC. */
export function AdminCancelDialog({
  appointmentId,
  open,
  onOpenChange,
}: {
  appointmentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!appointmentId) throw new Error("No appointment selected.");
      const { error } = await (supabase as any).rpc("cancel_appointment", {
        p_appointment_id: appointmentId,
        p_cancellation_reason: reason.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Appointment cancelled");
      // Best-effort cancellation email + Meet cleanup via the existing endpoint.
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess?.session?.access_token;
        await fetch("/api/public/notifications/appointment-cancelled", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ appointment_id: appointmentId, reason: reason.trim() || null }),
          keepalive: true,
        });
      } catch {
        // ignore
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-appt-detail", appointmentId] }),
        queryClient.invalidateQueries({ queryKey: ["visits"] }),
        queryClient.invalidateQueries({ queryKey: ["slots"] }),
      ]);
      setReason("");
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message || "Couldn't cancel appointment"),
  });

  return (
    <AlertDialog open={open} onOpenChange={(v) => !mutation.isPending && onOpenChange(v)}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
          <AlertDialogDescription>
            The patient will be notified and the time slot is released. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <label htmlFor="admin-cancel-reason" className="text-sm font-medium text-foreground">
            Reason (optional)
          </label>
          <Textarea
            id="admin-cancel-reason"
            rows={3}
            placeholder="Add a short note for the patient…"
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