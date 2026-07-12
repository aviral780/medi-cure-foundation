import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Receipt } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { fetchPaymentHistory } from "@/lib/payments-api";
import { formatFee, formatFullDate } from "@/lib/booking-queries";
import { StatusBadge } from "@/components/appointments/StatusBadges";

export const Route = createFileRoute("/_authenticated/payments")({
  component: PaymentHistoryPage,
});

function PaymentHistoryPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["payment-history"],
    queryFn: fetchPaymentHistory,
  });

  return (
    <AppShell>
      <section className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Payment history</h1>
        <p className="mt-1 text-sm text-muted-foreground">All Razorpay transactions on your MediCure account.</p>

        {isLoading && <div className="mt-6 h-32 animate-pulse rounded-2xl bg-muted" />}
        {error && (
          <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-destructive">
            <p className="font-semibold">Couldn't load history</p>
            <p className="mt-1 text-sm opacity-90">{(error as Error).message}</p>
          </div>
        )}

        {!isLoading && !error && (data ?? []).length === 0 && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center">
            <Receipt className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="mt-3 text-base font-semibold text-foreground">No payments yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Payments will appear here once you book a consultation.</p>
          </div>
        )}

        {!isLoading && (data ?? []).length > 0 && (
          <ul className="mt-6 space-y-3">
            {(data ?? []).map((p) => {
              const appt = p.appointments;
              const doc = appt?.doctors?.full_name ?? "Consultation";
              const date = appt?.appointment_date;
              return (
                <li key={p.id}>
                  <Link
                    to="/receipts/$appointmentId"
                    params={{ appointmentId: p.appointment_id }}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{doc}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {date ? formatFullDate(date) : new Date(p.created_at).toLocaleDateString()}
                        {p.payment_method ? ` · ${p.payment_method.toUpperCase()}` : ""}
                      </p>
                      <div className="mt-2"><StatusBadge status={p.status} /></div>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-semibold text-foreground">{formatFee(Number(p.amount), p.currency)}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AppShell>
  );
}