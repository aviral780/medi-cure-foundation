import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Calendar, CalendarClock, Clock, MapPin, StickyNote, Video, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { supabase } from "@/lib/supabase";
import {
  fetchAppointmentById,
  formatFee,
  formatFullDate,
  formatMode,
  formatTime,
  initialsOf,
} from "@/lib/booking-queries";
import { StatusBadge, PaymentBadge } from "@/components/appointments/StatusBadges";

export const Route = createFileRoute("/_authenticated/appointments/$appointmentId")({
  component: AppointmentDetailsPage,
});

function AppointmentDetailsPage() {
  const { appointmentId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["appointment", appointmentId],
    queryFn: () => fetchAppointmentById(appointmentId),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { error: rpcErr } = await (supabase as any).rpc("cancel_appointment", {
        p_appointment_id: appointmentId,
        p_cancellation_reason: reason.trim() || null,
      });
      if (rpcErr) throw rpcErr;
    },
    onSuccess: async () => {
      toast.success("Appointment cancelled");
      setConfirmOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["appointment", appointmentId] });
      await queryClient.invalidateQueries({ queryKey: ["visits"] });
      await queryClient.invalidateQueries({ queryKey: ["slots"] });
      navigate({ to: "/visits" });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Couldn't cancel appointment");
    },
  });

  const slot = data?.availability_slots;
  const isPast = slot ? new Date(`${slot.slot_date}T${slot.end_time}`).getTime() < Date.now() : false;
  const status = (data?.appointment_status ?? "").toLowerCase();
  const isCancelled = status === "cancelled" || status === "canceled";
  const canModify = !!data && !isPast && !isCancelled;

  return (
    <AppShell>
      <section className="mx-auto max-w-2xl px-4 py-6 pb-32 sm:px-6 sm:py-10">
        <Link
          to="/visits"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to visits
        </Link>

        {isLoading && <div className="mt-6 h-64 animate-pulse rounded-2xl bg-muted" />}
        {error && (
          <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-destructive">
            <p className="font-semibold">Couldn't load appointment</p>
            <p className="mt-1 text-sm opacity-90">{(error as Error).message}</p>
          </div>
        )}
        {!isLoading && !error && !data && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Appointment not found.
          </div>
        )}

        {data && (
          <>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  Appointment
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Booked {new Date(data.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <StatusBadge status={data.appointment_status} />
                <PaymentBadge status={data.payment_status} />
              </div>
            </div>

            {/* Doctor card */}
            {data.doctors && (
              <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
                <div className="flex items-center gap-4">
                  {data.doctors.profile_image_url ? (
                    <img
                      src={data.doctors.profile_image_url}
                      alt=""
                      className="h-14 w-14 rounded-full object-cover"
                    />
                  ) : (
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-primary-soft text-base font-semibold text-primary">
                      {initialsOf(data.doctors.full_name)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-foreground">{data.doctors.full_name}</p>
                    <p className="truncate text-sm text-muted-foreground">{data.doctors.specialization}</p>
                    {data.doctors.experience_years != null && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {data.doctors.experience_years} yrs experience
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Schedule card */}
            <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Schedule
              </h2>
              <dl className="mt-3 space-y-2.5 text-sm">
                {slot && (
                  <>
                    <DetailRow icon={Calendar} label={formatFullDate(slot.slot_date)} />
                    <DetailRow
                      icon={Clock}
                      label={`${formatTime(slot.start_time)} – ${formatTime(slot.end_time)}`}
                    />
                  </>
                )}
                {data.consultation_types && (
                  <>
                    <DetailRow
                      icon={data.consultation_types.mode === "online" ? Video : MapPin}
                      label={`${data.consultation_types.name} · ${formatMode(data.consultation_types.mode)} · ${data.consultation_types.duration_minutes} min`}
                    />
                    <DetailRow
                      icon={CalendarClock}
                      label={`Fee: ${formatFee(data.consultation_types.fee, data.consultation_types.currency)}`}
                    />
                  </>
                )}
              </dl>
            </div>

            {/* Notes */}
            {data.patient_notes && (
              <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  <StickyNote className="h-4 w-4" aria-hidden /> Notes
                </div>
                <p className="mt-2 whitespace-pre-line text-sm text-foreground">{data.patient_notes}</p>
              </div>
            )}

            {/* Actions */}
            {canModify ? (
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                <Button asChild variant="outline" className="h-12 rounded-xl">
                  <Link
                    to="/appointments/$appointmentId/reschedule"
                    params={{ appointmentId }}
                  >
                    <CalendarClock className="mr-2 h-4 w-4" aria-hidden /> Reschedule
                  </Link>
                </Button>
                <Button
                  variant="destructive"
                  className="h-12 rounded-xl"
                  onClick={() => setConfirmOpen(true)}
                >
                  <X className="mr-2 h-4 w-4" aria-hidden /> Cancel appointment
                </Button>
              </div>
            ) : (
              <p className="mt-6 rounded-2xl border border-dashed border-border bg-card p-4 text-center text-xs text-muted-foreground">
                {isCancelled
                  ? "This appointment has been cancelled."
                  : "This appointment has already taken place."}
              </p>
            )}
          </>
        )}
      </section>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will free up the time slot for other patients. This action cannot be undone.
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
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                cancelMutation.mutate();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelMutation.isPending ? "Cancelling…" : "Yes, cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function DetailRow({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-2.5 text-foreground">
      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      <span>{label}</span>
    </div>
  );
}