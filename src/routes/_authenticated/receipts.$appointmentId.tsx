import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchAppointmentById,
  formatFee,
  formatFullDate,
  formatMode,
  formatTime,
} from "@/lib/booking-queries";
import { fetchLatestPaymentForAppointment } from "@/lib/payments-api";

export const Route = createFileRoute("/_authenticated/receipts/$appointmentId")({
  component: ReceiptPage,
});

function ReceiptPage() {
  const { appointmentId } = Route.useParams();
  const { user } = useAuth();
  const [apptQ, payQ] = useQueries({
    queries: [
      { queryKey: ["appointment", appointmentId], queryFn: () => fetchAppointmentById(appointmentId) },
      { queryKey: ["payment-for-appointment", appointmentId], queryFn: () => fetchLatestPaymentForAppointment(appointmentId) },
    ],
  });

  const appt = apptQ.data;
  const pay = payQ.data;
  const doctor = appt?.doctors;
  const type = appt?.consultation_types;
  const slot = appt?.availability_slots;
  const date = appt?.appointment_date ?? slot?.slot_date ?? null;
  const startTime = appt?.start_time ?? slot?.start_time ?? null;
  const endTime = appt?.end_time ?? slot?.end_time ?? null;
  const loading = apptQ.isLoading || payQ.isLoading;
  const amount = Number(pay?.amount ?? type?.fee ?? 0);
  const currency = pay?.currency ?? type?.currency ?? "INR";

  return (
    <AppShell>
      <section className="mx-auto max-w-2xl px-4 py-6 pb-32 sm:px-6 sm:py-10">
        <div className="flex items-center justify-between print:hidden">
          <Link
            to="/appointments/$appointmentId"
            params={{ appointmentId }}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back
          </Link>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-1.5 h-4 w-4" /> Print
            </Button>
            <Button size="sm" onClick={() => window.print()}>
              <Download className="mr-1.5 h-4 w-4" /> Save as PDF
            </Button>
          </div>
        </div>

        {loading && <div className="mt-6 h-64 animate-pulse rounded-2xl bg-muted" />}

        {!loading && appt && (
          <div id="receipt" className="mt-6 rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-soft)] print:border-0 print:shadow-none">
            <div className="flex items-start justify-between border-b border-border pb-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Clinic</p>
                <h1 className="mt-1 text-2xl font-semibold text-foreground">MediCure</h1>
                <p className="mt-1 text-xs text-muted-foreground">Payment receipt</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                <p className={`mt-1 text-sm font-semibold capitalize ${pay?.status === "paid" ? "text-emerald-600" : "text-amber-600"}`}>
                  {pay?.status ?? "pending"}
                </p>
              </div>
            </div>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Patient" value={user?.email ?? "—"} />
              <Field label="Doctor" value={doctor?.full_name ?? "—"} sub={doctor?.specialization ?? undefined} />
              <Field label="Consultation" value={type?.name ?? "—"} sub={type ? `${formatMode(type.mode)} · ${type.duration_minutes} min` : undefined} />
              <Field label="Date" value={date ? formatFullDate(date) : "—"} />
              <Field label="Time" value={startTime && endTime ? `${formatTime(startTime)} – ${formatTime(endTime)}` : "—"} />
              <Field label="Amount" value={formatFee(amount, currency)} />
              <Field label="Payment method" value={pay?.payment_method ? pay.payment_method.toUpperCase() : "—"} />
              <Field label="Payment ID" value={pay?.razorpay_payment_id ?? "—"} mono />
              <Field label="Order ID" value={pay?.razorpay_order_id ?? "—"} mono />
              <Field label="Appointment ID" value={appt.id} mono />
              <Field label="Issued on" value={pay?.created_at ? new Date(pay.created_at).toLocaleString() : new Date().toLocaleString()} />
            </dl>

            <p className="mt-8 border-t border-border pt-4 text-center text-xs text-muted-foreground">
              This is a computer-generated receipt. Powered by Razorpay.
            </p>
          </div>
        )}
      </section>
    </AppShell>
  );
}

function Field({ label, value, sub, mono }: { label: string; value: string; sub?: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 text-sm font-medium text-foreground ${mono ? "font-mono break-all text-xs" : ""}`}>{value}</dd>
      {sub && <dd className="text-xs text-muted-foreground">{sub}</dd>}
    </div>
  );
}