import { useQueries } from "@tanstack/react-query";
import {
  AlertTriangle,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock,
  CreditCard,
  Mail,
  MapPin,
  Phone,
  Receipt,
  StickyNote,
  User,
  Video,
  XCircle,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge, PaymentBadge } from "@/components/appointments/StatusBadges";
import {
  fetchAppointmentById,
  formatFee,
  formatFullDate,
  formatMode,
  formatTime,
  initialsOf,
} from "@/lib/booking-queries";
import { fetchLatestPaymentForAppointment } from "@/lib/payments-api";
import { supabase } from "@/lib/supabase";

type PatientRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
};

type AppointmentExtras = {
  cancellation_reason: string | null;
  updated_at: string | null;
};

async function fetchPatientProfile(patientId: string): Promise<PatientRow | null> {
  const { data, error } = await (supabase as any)
    .from("profiles")
    .select("id, full_name, phone, email")
    .eq("id", patientId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as PatientRow | null;
}

async function fetchAppointmentExtras(id: string): Promise<AppointmentExtras | null> {
  const { data, error } = await (supabase as any)
    .from("appointments")
    .select("cancellation_reason, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return null;
  return (data ?? null) as AppointmentExtras | null;
}

function formatDateTimeStamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type TimelineStep = {
  key: string;
  label: string;
  timestamp: string | null;
  state: "done" | "current" | "pending" | "cancelled";
};

export function AppointmentDetailsDrawer({
  appointmentId,
  open,
  onOpenChange,
}: {
  appointmentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const enabled = Boolean(appointmentId) && open;

  const [apptQ, payQ, extrasQ] = useQueries({
    queries: [
      {
        queryKey: ["admin-appt-detail", appointmentId],
        queryFn: () => fetchAppointmentById(appointmentId as string),
        enabled,
      },
      {
        queryKey: ["admin-appt-payment", appointmentId],
        queryFn: () => fetchLatestPaymentForAppointment(appointmentId as string),
        enabled,
      },
      {
        queryKey: ["admin-appt-extras", appointmentId],
        queryFn: () => fetchAppointmentExtras(appointmentId as string),
        enabled,
      },
    ],
  });

  const appt = apptQ.data;
  const payment = payQ.data;
  const extras = extrasQ.data;

  const patientId = appt ? (appt as any).patient_id ?? null : null;

  const patientQ = useQueries({
    queries: [
      {
        queryKey: ["admin-appt-patient", patientId],
        queryFn: () => fetchPatientProfile(patientId as string),
        enabled: enabled && Boolean(patientId),
      },
    ],
  })[0];
  const patient = patientQ.data;

  const status = (appt?.appointment_status ?? "").toLowerCase();
  const isCancelled = status === "cancelled" || status === "canceled";
  const isRescheduled = status === "rescheduled";

  const timeline: TimelineStep[] = appt
    ? buildTimeline({
        createdAt: appt.created_at,
        status,
        paidAt: payment?.paid_at ?? null,
        updatedAt: extras?.updated_at ?? null,
        isRescheduled,
      })
    : [];

  const isLoading = apptQ.isLoading;
  const error = apptQ.error;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-hidden p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b border-border bg-card px-6 pb-4 pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="text-lg font-semibold">
                Appointment details
              </SheetTitle>
              <SheetDescription className="mt-1 font-mono text-xs">
                {appointmentId ?? ""}
              </SheetDescription>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              {appt && <StatusBadge status={appt.appointment_status} />}
              {appt && <PaymentBadge status={appt.payment_status} />}
              {isRescheduled && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium capitalize text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  <CalendarClock className="h-3 w-3" aria-hidden /> Rescheduled
                </span>
              )}
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-88px)]">
          <div className="space-y-5 px-6 py-6">
            {isLoading && (
              <div className="h-64 animate-pulse rounded-2xl bg-muted" />
            )}
            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {(error as Error).message}
              </div>
            )}

            {appt && (
              <>
                {isCancelled && (
                  <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle
                        className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-destructive">
                          Appointment cancelled
                        </p>
                        <p className="mt-1 text-xs text-destructive/80">
                          {extras?.cancellation_reason
                            ? extras.cancellation_reason
                            : "No reason provided."}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {isRescheduled && (
                  <div className="rounded-2xl border border-amber-400/40 bg-amber-50 p-4 dark:bg-amber-950/30">
                    <div className="flex items-start gap-3">
                      <CalendarClock
                        className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300"
                        aria-hidden
                      />
                      <div className="min-w-0 text-sm">
                        <p className="font-semibold text-amber-900 dark:text-amber-200">
                          This appointment was rescheduled
                        </p>
                        <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">
                          Current schedule shown below.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Appointment info */}
                <Section title="Appointment">
                  <InfoRow
                    icon={Calendar}
                    label="Date"
                    value={
                      appt.appointment_date
                        ? formatFullDate(appt.appointment_date)
                        : "—"
                    }
                  />
                  <InfoRow
                    icon={Clock}
                    label="Time"
                    value={
                      appt.start_time && appt.end_time
                        ? `${formatTime(appt.start_time)} – ${formatTime(appt.end_time)}`
                        : "—"
                    }
                  />
                  <InfoRow
                    icon={User}
                    label="Doctor"
                    value={
                      appt.doctors
                        ? `${appt.doctors.full_name}${appt.doctors.specialization ? ` · ${appt.doctors.specialization}` : ""}`
                        : "—"
                    }
                  />
                  {appt.consultation_types && (
                    <>
                      <InfoRow
                        icon={
                          appt.consultation_types.mode === "online"
                            ? Video
                            : MapPin
                        }
                        label="Type"
                        value={`${appt.consultation_types.name} · ${formatMode(appt.consultation_types.mode)} · ${appt.consultation_types.duration_minutes} min`}
                      />
                      <InfoRow
                        icon={CreditCard}
                        label="Fee"
                        value={formatFee(
                          appt.consultation_types.fee,
                          appt.consultation_types.currency,
                        )}
                      />
                    </>
                  )}
                  <InfoRow
                    icon={CalendarClock}
                    label="Booked"
                    value={formatDateTimeStamp(appt.created_at)}
                  />
                </Section>

                {/* Patient */}
                <Section title="Patient">
                  <div className="flex items-center gap-3 pb-2">
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                      {initialsOf(patient?.full_name ?? "?")}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {patient?.full_name ?? "—"}
                      </p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {patientId ?? "—"}
                      </p>
                    </div>
                  </div>
                  <InfoRow
                    icon={Phone}
                    label="Phone"
                    value={patient?.phone ?? "—"}
                  />
                  <InfoRow
                    icon={Mail}
                    label="Email"
                    value={patient?.email ?? "—"}
                  />
                </Section>

                {/* Payment */}
                <Section title="Payment">
                  {payment ? (
                    <>
                      <InfoRow
                        icon={CreditCard}
                        label="Amount"
                        value={formatFee(
                          Number(payment.amount ?? 0),
                          payment.currency ?? "INR",
                        )}
                      />
                      <InfoRow
                        icon={Receipt}
                        label="Gateway"
                        value={
                          payment.payment_gateway
                            ? payment.payment_gateway.charAt(0).toUpperCase() +
                              payment.payment_gateway.slice(1)
                            : "—"
                        }
                      />
                      <InfoRow
                        icon={Circle}
                        label="Status"
                        value={payment.status ?? "—"}
                      />
                      <div className="flex items-start gap-2.5 py-1.5 text-sm">
                        <Receipt
                          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">
                            Transaction ID
                          </p>
                          <p className="mt-0.5 break-all font-mono text-xs text-foreground">
                            {payment.gateway_payment_id ?? "—"}
                          </p>
                        </div>
                      </div>
                      {payment.paid_at && (
                        <InfoRow
                          icon={CheckCircle2}
                          label="Paid on"
                          value={formatDateTimeStamp(payment.paid_at)}
                        />
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No payment record for this appointment.
                    </p>
                  )}
                </Section>

                {/* Notes */}
                {appt.patient_notes && (
                  <Section title="Patient notes">
                    <div className="flex items-start gap-2.5 text-sm text-foreground">
                      <StickyNote
                        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <p className="whitespace-pre-line">{appt.patient_notes}</p>
                    </div>
                  </Section>
                )}

                {/* Timeline */}
                <Section title="Timeline">
                  <ol className="space-y-4">
                    {timeline.map((step, idx) => (
                      <TimelineItem
                        key={step.key}
                        step={step}
                        isLast={idx === timeline.length - 1}
                      />
                    ))}
                  </ol>
                </Section>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <Separator className="my-3" />
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5 py-1.5 text-sm">
      <Icon
        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 break-words text-foreground">{value}</p>
      </div>
    </div>
  );
}

function buildTimeline(input: {
  createdAt: string;
  status: string;
  paidAt: string | null;
  updatedAt: string | null;
  isRescheduled: boolean;
}): TimelineStep[] {
  const { createdAt, status, paidAt, updatedAt, isRescheduled } = input;
  const isCancelled = status === "cancelled" || status === "canceled";
  const isCompleted = status === "completed";
  const isConfirmed =
    status === "confirmed" || isCompleted || isRescheduled;

  const steps: TimelineStep[] = [
    {
      key: "booked",
      label: "Booked",
      timestamp: createdAt,
      state: "done",
    },
    {
      key: "confirmed",
      label: "Confirmed",
      timestamp: isConfirmed ? paidAt ?? null : null,
      state: isConfirmed ? "done" : isCancelled ? "cancelled" : "pending",
    },
  ];

  if (isRescheduled) {
    steps.push({
      key: "rescheduled",
      label: "Rescheduled",
      timestamp: updatedAt,
      state: "done",
    });
  }

  if (isCancelled) {
    steps.push({
      key: "cancelled",
      label: "Cancelled",
      timestamp: updatedAt,
      state: "cancelled",
    });
  } else {
    steps.push({
      key: "completed",
      label: "Completed",
      timestamp: isCompleted ? updatedAt : null,
      state: isCompleted ? "done" : "pending",
    });
  }

  return steps;
}

function TimelineItem({
  step,
  isLast,
}: {
  step: TimelineStep;
  isLast: boolean;
}) {
  const Icon =
    step.state === "cancelled"
      ? XCircle
      : step.state === "done"
        ? CheckCircle2
        : Circle;
  const color =
    step.state === "cancelled"
      ? "text-destructive"
      : step.state === "done"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-muted-foreground";
  return (
    <li className="relative flex gap-3">
      <div className="flex flex-col items-center">
        <Icon className={`h-5 w-5 ${color}`} aria-hidden />
        {!isLast && <span className="mt-1 w-px flex-1 bg-border" />}
      </div>
      <div className="min-w-0 flex-1 pb-1">
        <p
          className={`text-sm font-medium ${
            step.state === "pending" ? "text-muted-foreground" : "text-foreground"
          }`}
        >
          {step.label}
        </p>
        <p className="text-xs text-muted-foreground">
          {step.timestamp ? formatDateTimeStamp(step.timestamp) : "—"}
        </p>
      </div>
    </li>
  );
}