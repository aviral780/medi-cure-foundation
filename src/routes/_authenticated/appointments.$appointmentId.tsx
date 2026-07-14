import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { useState, type ComponentType } from "react";
import { ArrowLeft, Calendar, CalendarClock, Clock, CreditCard, MapPin, Receipt, StickyNote, Video, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  fetchAppointmentById,
  evaluateCancelEligibility,
  formatFee,
  formatFullDate,
  formatMode,
  formatTime,
  initialsOf,
  localDateTimeMs,
} from "@/lib/booking-queries";
import { StatusBadge, PaymentBadge } from "@/components/appointments/StatusBadges";
import { CancelAppointmentDialog } from "@/components/appointments/CancelAppointmentDialog";
import { fetchLatestPaymentForAppointment } from "@/lib/payments-api";

export const Route = createFileRoute("/_authenticated/appointments/$appointmentId")({
  component: AppointmentDetailsPage,
});

function AppointmentDetailsPage() {
  const { appointmentId } = Route.useParams();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [apptQ, payQ] = useQueries({
    queries: [
      { queryKey: ["appointment", appointmentId], queryFn: () => fetchAppointmentById(appointmentId) },
      { queryKey: ["payment-for-appointment", appointmentId], queryFn: () => fetchLatestPaymentForAppointment(appointmentId) },
    ],
  });
  const data = apptQ.data;
  const isLoading = apptQ.isLoading;
  const error = apptQ.error;
  const payment = payQ.data;

  const slot = data?.availability_slots;
  const scheduleDate = data?.appointment_date ?? slot?.slot_date ?? null;
  const scheduleStartTime = data?.start_time ?? slot?.start_time ?? null;
  const scheduleEndTime = data?.end_time ?? slot?.end_time ?? null;
  const isPast = scheduleDate && scheduleEndTime ? localDateTimeMs(scheduleDate, scheduleEndTime) < Date.now() : false;
  const status = (data?.appointment_status ?? "").toLowerCase();
  const isCancelled = status === "cancelled" || status === "canceled";
  const paymentPending = (data?.payment_status ?? "").toLowerCase() === "pending" && !isCancelled && !isPast;
  const isPaid = (data?.payment_status ?? "").toLowerCase() === "paid";
  const canModify = !!data && !isPast && !isCancelled;
  const cancelEligibility = data
    ? evaluateCancelEligibility({
        appointmentStatus: data.appointment_status,
        startDate: scheduleDate,
        startTime: scheduleStartTime,
      })
    : { canCancel: false, reason: "" };

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
              {canModify && (
                <div className="flex flex-col items-end gap-1.5">
                  <StatusBadge status={data.appointment_status} />
                  <PaymentBadge status={data.payment_status} />
                </div>
              )}
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
                {scheduleDate && scheduleStartTime && scheduleEndTime && (
                  <>
                    <DetailRow icon={Calendar} label={formatFullDate(scheduleDate)} />
                    <DetailRow
                      icon={Clock}
                      label={`${formatTime(scheduleStartTime)} – ${formatTime(scheduleEndTime)}`}
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

            {paymentPending && (
              <div className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-50 p-5 dark:bg-amber-950/30">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Payment pending</p>
                <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">
                  Complete payment to confirm this appointment.
                </p>
                <Button asChild className="mt-3 h-11 rounded-xl">
                  <Link to="/payment/$appointmentId" params={{ appointmentId }}>
                    <CreditCard className="mr-2 h-4 w-4" /> Complete payment
                  </Link>
                </Button>
              </div>
            )}

            {isPaid && payment?.gateway_payment_id && (
              <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  <CreditCard className="h-4 w-4" aria-hidden /> Payment
                </div>
                <dl className="mt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between"><dt className="text-muted-foreground">Gateway</dt><dd className="font-medium capitalize">{payment.payment_gateway ?? "—"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Payment ID</dt><dd className="font-mono text-xs break-all">{payment.gateway_payment_id}</dd></div>
                </dl>
                <Button asChild variant="outline" size="sm" className="mt-3 h-10 rounded-lg">
                  <Link to="/receipts/$appointmentId" params={{ appointmentId }}>
                    <Receipt className="mr-1.5 h-4 w-4" /> View receipt
                  </Link>
                </Button>
              </div>
            )}

            {/* Actions */}
            {canModify ? (
              <div className="mt-6 space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
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
                    disabled={!cancelEligibility.canCancel}
                  >
                    <X className="mr-2 h-4 w-4" aria-hidden /> Cancel appointment
                  </Button>
                </div>
                {!cancelEligibility.canCancel && "reason" in cancelEligibility && cancelEligibility.reason && (
                  <p className="rounded-xl border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    {cancelEligibility.reason}
                  </p>
                )}
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

      <CancelAppointmentDialog
        appointmentId={appointmentId}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
      />
    </AppShell>
  );
}

function DetailRow({ icon: Icon, label }: { icon: ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-2.5 text-foreground">
      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      <span>{label}</span>
    </div>
  );
}