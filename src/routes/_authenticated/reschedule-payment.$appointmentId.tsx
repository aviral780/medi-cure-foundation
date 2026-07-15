import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  MapPin,
  ShieldCheck,
  User,
  Video,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  fetchAppointmentById,
  formatFullDate,
  formatMode,
  formatTime,
  RESCHEDULE_FEE_INR,
  evaluateRescheduleEligibility,
} from "@/lib/booking-queries";
import { loadRazorpay } from "@/lib/razorpay-loader";
import {
  createRescheduleOrder,
  markPaymentFailed,
  verifyReschedulePayment,
  type CreateRescheduleOrderResponse,
} from "@/lib/payments-api";

type Search = { newSlotId: string };

export const Route = createFileRoute("/_authenticated/reschedule-payment/$appointmentId")({
  validateSearch: (raw: Record<string, unknown>): Search => ({
    newSlotId: typeof raw.newSlotId === "string" ? raw.newSlotId : "",
  }),
  component: ReschedulePaymentPage,
});

type Phase = "idle" | "creating" | "checkout" | "verifying" | "success" | "failed";

function ReschedulePaymentPage() {
  const { appointmentId } = Route.useParams();
  const { newSlotId } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [orderInfo, setOrderInfo] = useState<CreateRescheduleOrderResponse | null>(null);

  const { data: appt, isLoading, error } = useQuery({
    queryKey: ["appointment", appointmentId],
    queryFn: () => fetchAppointmentById(appointmentId),
  });

  const type = appt?.consultation_types;
  const doctor = appt?.doctors;
  const slot = appt?.availability_slots;
  const currentDate = appt?.appointment_date ?? slot?.slot_date ?? null;
  const currentStart = appt?.start_time ?? slot?.start_time ?? null;
  const currentEnd = appt?.end_time ?? slot?.end_time ?? null;
  const eligibility = appt
    ? evaluateRescheduleEligibility({
        appointmentStatus: appt.appointment_status,
        startDate: currentDate,
        startTime: currentStart,
      })
    : { canReschedule: false as const, reason: "" };
  const busy = phase === "creating" || phase === "checkout" || phase === "verifying";
  const missingSlot = !newSlotId;

  async function handlePay() {
    if (busy || !appt || !newSlotId) return;
    setErrorMsg(null);
    setPhase("creating");
    try {
      const order = await createRescheduleOrder({ appointmentId, newSlotId });
      setOrderInfo(order);
      await loadRazorpay();
      if (!window.Razorpay) throw new Error("Razorpay Checkout could not initialize");

      setPhase("checkout");
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "MediCure",
        description: `Reschedule fee · ${order.appointment.doctorName}`,
        order_id: order.orderId,
        prefill: {},
        theme: { color: "#0aa5a1" },
        handler: async (response: unknown) => {
          const r = response as {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          };
          setPhase("verifying");
          try {
            await verifyReschedulePayment({
              appointmentId,
              newSlotId,
              razorpay_order_id: r.razorpay_order_id,
              razorpay_payment_id: r.razorpay_payment_id,
              razorpay_signature: r.razorpay_signature,
            });
            // Best-effort confirmation email with previous vs new times + fee.
            void (async () => {
              try {
                const { supabase } = await import("@/lib/supabase");
                const { data: sess } = await supabase.auth.getSession();
                const bearer = sess?.session?.access_token;
                await fetch("/api/public/notifications/appointment-rescheduled", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
                  },
                  body: JSON.stringify({
                    appointment_id: appointmentId,
                    previous: {
                      date: order.previous.date,
                      start_time: order.previous.startTime,
                      end_time: order.previous.endTime,
                    },
                    fee_inr: RESCHEDULE_FEE_INR,
                  }),
                  keepalive: true,
                });
              } catch {
                /* ignore */
              }
            })();
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ["appointment", appointmentId] }),
              queryClient.invalidateQueries({ queryKey: ["visits"] }),
              queryClient.invalidateQueries({ queryKey: ["slots"] }),
              queryClient.invalidateQueries({ queryKey: ["payment-for-appointment", appointmentId] }),
            ]);
            setPhase("success");
            toast.success("Appointment rescheduled");
          } catch (err) {
            setPhase("failed");
            setErrorMsg(err instanceof Error ? err.message : "Verification failed");
          }
        },
        modal: {
          ondismiss: async () => {
            setPhase("failed");
            setErrorMsg("Payment cancelled. Your original appointment is unchanged.");
            await markPaymentFailed({
              appointmentId,
              razorpay_order_id: order.orderId,
              reason: "User dismissed reschedule payment",
            });
          },
        },
      });
      rzp.on("payment.failed", async (resp: unknown) => {
        const reason = (resp as any)?.error?.description ?? "Payment failed";
        setPhase("failed");
        setErrorMsg(`${reason}. Your original appointment is unchanged.`);
        await markPaymentFailed({
          appointmentId,
          razorpay_order_id: order.orderId,
          reason,
        });
      });
      rzp.open();
    } catch (err) {
      setPhase("failed");
      setErrorMsg(err instanceof Error ? err.message : "Could not start payment");
    }
  }

  if (phase === "success") {
    return (
      <AppShell>
        <section className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-soft)]">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary-soft text-primary">
              <CheckCircle2 className="h-7 w-7" aria-hidden />
            </span>
            <h1 className="mt-4 text-2xl font-semibold text-foreground">Appointment rescheduled</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your new time is confirmed. A confirmation email is on the way.
            </p>
            {orderInfo && (
              <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4 text-left text-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">New time</p>
                <p className="mt-1 font-medium text-foreground">
                  {formatFullDate(orderInfo.newSlot.date)} · {formatTime(orderInfo.newSlot.startTime)} –{" "}
                  {formatTime(orderInfo.newSlot.endTime)}
                </p>
              </div>
            )}
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                className="h-12 rounded-xl"
                onClick={() =>
                  navigate({ to: "/appointments/$appointmentId", params: { appointmentId } })
                }
              >
                View appointment
              </Button>
              <Button className="h-12 rounded-xl" onClick={() => navigate({ to: "/visits" })}>
                Go to Visits
              </Button>
            </div>
          </div>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="mx-auto max-w-2xl px-4 py-6 pb-32 sm:px-6 sm:py-10">
        <Link
          to="/appointments/$appointmentId/reschedule"
          params={{ appointmentId }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Link>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Confirm reschedule
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A ₹{RESCHEDULE_FEE_INR} reschedule fee applies. Your original time is held until payment
          succeeds — if payment fails or is cancelled, nothing changes.
        </p>

        {isLoading && <div className="mt-6 h-64 animate-pulse rounded-2xl bg-muted" />}
        {error && (
          <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-destructive">
            <p className="font-semibold">Couldn't load appointment</p>
            <p className="mt-1 text-sm opacity-90">{(error as Error).message}</p>
          </div>
        )}

        {!isLoading && !error && appt && (
          <>
            {missingSlot && (
              <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
                No new time was selected. Please pick a slot to reschedule.
                <div className="mt-3">
                  <Button asChild variant="outline" size="sm" className="h-10 rounded-lg">
                    <Link
                      to="/appointments/$appointmentId/reschedule"
                      params={{ appointmentId }}
                    >
                      Pick a time
                    </Link>
                  </Button>
                </div>
              </div>
            )}

            {!missingSlot && !eligibility.canReschedule && (
              <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">Rescheduling unavailable</p>
                <p className="mt-1">{"reason" in eligibility ? eligibility.reason : ""}</p>
              </div>
            )}

            {!missingSlot && eligibility.canReschedule && (
              <>
                <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
                  <SummaryRow
                    icon={User}
                    label="Doctor"
                    value={doctor?.full_name ?? ""}
                    sub={doctor?.specialization}
                  />
                  {type && (
                    <SummaryRow
                      icon={type.mode === "online" ? Video : MapPin}
                      label="Consultation"
                      value={type.name}
                      sub={`${formatMode(type.mode)} · ${type.duration_minutes} min`}
                    />
                  )}
                  {currentDate && currentStart && currentEnd && (
                    <SummaryRow
                      icon={Clock}
                      label="Current time"
                      value={formatFullDate(currentDate)}
                      sub={`${formatTime(currentStart)} – ${formatTime(currentEnd)}`}
                      last
                    />
                  )}
                </div>

                <div className="mt-4 rounded-2xl border border-primary/30 bg-primary-soft/40 p-5">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                    <CalendarClock className="h-4 w-4" aria-hidden /> New time (pending payment)
                  </div>
                  {orderInfo ? (
                    <p className="mt-2 text-base font-semibold text-foreground">
                      {formatFullDate(orderInfo.newSlot.date)} ·{" "}
                      {formatTime(orderInfo.newSlot.startTime)} –{" "}
                      {formatTime(orderInfo.newSlot.endTime)}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-foreground">
                      Slot selected. Details will be shown after you start the payment.
                    </p>
                  )}
                </div>

                <div className="mt-4 rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Reschedule fee</span>
                    <span className="font-medium text-foreground">₹{RESCHEDULE_FEE_INR}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-base font-medium text-muted-foreground">Total</span>
                    <span className="text-2xl font-semibold text-foreground">
                      ₹{RESCHEDULE_FEE_INR}
                    </span>
                  </div>
                </div>

                <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                  UPI · Cards · Netbanking · Wallets
                </p>

                {errorMsg && (
                  <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                    {errorMsg}
                  </div>
                )}

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    className="h-12 rounded-xl"
                    disabled={busy}
                    onClick={() =>
                      navigate({
                        to: "/appointments/$appointmentId",
                        params: { appointmentId },
                      })
                    }
                  >
                    Keep original
                  </Button>
                  <Button className="h-12 rounded-xl" disabled={busy} onClick={handlePay}>
                    {busy ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {phase === "verifying"
                          ? "Rescheduling…"
                          : phase === "creating"
                          ? "Preparing…"
                          : "Awaiting Razorpay…"}
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        {phase === "failed" ? "Retry payment" : `Pay ₹${RESCHEDULE_FEE_INR}`}
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </>
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
  sub?: string | null;
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