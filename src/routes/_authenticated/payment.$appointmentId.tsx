import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Calendar, CheckCircle2, Clock, CreditCard, Loader2, MapPin, ShieldCheck, User, Video } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  fetchAppointmentById,
  formatFee,
  formatFullDate,
  formatMode,
  formatTime,
} from "@/lib/booking-queries";
import { loadRazorpay } from "@/lib/razorpay-loader";
import {
  createRazorpayOrder,
  markPaymentFailed,
  verifyRazorpayPayment,
} from "@/lib/payments-api";

export const Route = createFileRoute("/_authenticated/payment/$appointmentId")({
  component: PaymentPage,
});

type Phase = "idle" | "creating" | "checkout" | "verifying" | "success" | "failed";

function PaymentPage() {
  const { appointmentId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: appt, isLoading, error } = useQuery({
    queryKey: ["appointment", appointmentId],
    queryFn: () => fetchAppointmentById(appointmentId),
  });

  const type = appt?.consultation_types;
  const doctor = appt?.doctors;
  const slot = appt?.availability_slots;
  const date = appt?.appointment_date ?? slot?.slot_date ?? null;
  const startTime = appt?.start_time ?? slot?.start_time ?? null;
  const endTime = appt?.end_time ?? slot?.end_time ?? null;
  const fee = Number(type?.fee ?? 0);
  const currency = type?.currency ?? "INR";
  const alreadyPaid = appt?.payment_status === "paid";
  const busy = phase === "creating" || phase === "checkout" || phase === "verifying";

  async function handlePay() {
    if (busy || !type || !appt) return;
    setErrorMsg(null);
    setPhase("creating");
    try {
      const order = await createRazorpayOrder(appointmentId);
      await loadRazorpay();
      if (!window.Razorpay) throw new Error("Razorpay Checkout could not initialize");

      setPhase("checkout");
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "MediCure",
        description: `${order.appointment.consultationName} · ${order.appointment.doctorName}`,
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
            await verifyRazorpayPayment({
              appointmentId,
              razorpay_order_id: r.razorpay_order_id,
              razorpay_payment_id: r.razorpay_payment_id,
              razorpay_signature: r.razorpay_signature,
            });
            await queryClient.invalidateQueries({ queryKey: ["appointment", appointmentId] });
            await queryClient.invalidateQueries({ queryKey: ["visits"] });
            setPhase("success");
            toast.success("Payment successful");
          } catch (err) {
            setPhase("failed");
            setErrorMsg(err instanceof Error ? err.message : "Verification failed");
          }
        },
        modal: {
          ondismiss: async () => {
            setPhase("failed");
            setErrorMsg("Payment was cancelled. You can retry any time.");
            await markPaymentFailed({
              appointmentId,
              razorpay_order_id: order.orderId,
              reason: "User dismissed checkout",
            });
          },
        },
      });
      rzp.on("payment.failed", async (resp: unknown) => {
        const reason = (resp as any)?.error?.description ?? "Payment failed";
        setPhase("failed");
        setErrorMsg(reason);
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

  if (phase === "success" || (alreadyPaid && phase === "idle")) {
    return (
      <AppShell>
        <section className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-soft)]">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary-soft text-primary">
              <CheckCircle2 className="h-7 w-7" aria-hidden />
            </span>
            <h1 className="mt-4 text-2xl font-semibold text-foreground">Payment successful</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your appointment is confirmed. A receipt is available.
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <Button variant="outline" className="h-12 rounded-xl" asChild>
                <Link to="/receipts/$appointmentId" params={{ appointmentId }}>View receipt</Link>
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
          to="/appointments/$appointmentId"
          params={{ appointmentId }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Link>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Complete your payment
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Secure payment powered by Razorpay. Your appointment stays pending until payment succeeds.
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
            <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
              <SummaryRow icon={User} label="Doctor" value={doctor?.full_name ?? ""} sub={doctor?.specialization} />
              {type && (
                <SummaryRow
                  icon={type.mode === "online" ? Video : MapPin}
                  label="Consultation"
                  value={type.name}
                  sub={`${formatMode(type.mode)} · ${type.duration_minutes} min`}
                />
              )}
              {date && <SummaryRow icon={Calendar} label="Date" value={formatFullDate(date)} />}
              {startTime && endTime && (
                <SummaryRow icon={Clock} label="Time" value={`${formatTime(startTime)} – ${formatTime(endTime)}`} last />
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Consultation fee</span>
                <span className="font-medium text-foreground">{formatFee(fee, currency)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Taxes</span>
                <span className="font-medium text-foreground">{formatFee(0, currency)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <span className="text-base font-medium text-muted-foreground">Total</span>
                <span className="text-2xl font-semibold text-foreground">{formatFee(fee, currency)}</span>
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
                onClick={() => navigate({ to: "/appointments/$appointmentId", params: { appointmentId } })}
              >
                Cancel payment
              </Button>
              <Button className="h-12 rounded-xl" disabled={busy || fee <= 0} onClick={handlePay}>
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {phase === "verifying" ? "Verifying…" : phase === "creating" ? "Preparing…" : "Awaiting Razorpay…"}
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" /> {phase === "failed" ? "Retry payment" : `Pay ${formatFee(fee, currency)}`}
                  </>
                )}
              </Button>
            </div>
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