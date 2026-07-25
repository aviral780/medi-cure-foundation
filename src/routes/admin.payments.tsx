import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PaymentBadge } from "@/components/appointments/StatusBadges";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatTime } from "@/lib/booking-queries";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";

export const Route = createFileRoute("/admin/payments")({
  component: PaymentsPage,
});

const db = supabase as any;

type AdminPaymentRow = {
  id: string;
  appointment_id: string;
  patient_id: string | null;
  amount: number;
  currency: string;
  payment_gateway: string | null;
  gateway_order_id: string | null;
  gateway_payment_id: string | null;
  payment_method: string | null;
  status: string;
  paid_at: string | null;
  created_at: string;
  appointments: {
    id: string;
    appointment_date: string | null;
    start_time: string | null;
    doctors: { full_name: string | null; specialization: string | null } | null;
    consultation_types: { name: string | null; mode: string | null } | null;
  } | null;
};

type PatientProfile = { id: string; full_name: string | null; email: string | null };

async function fetchAdminPayments(): Promise<{
  rows: AdminPaymentRow[];
  patients: Map<string, PatientProfile>;
}> {
  const { data, error } = await db
    .from("payments")
    .select(
      "id, appointment_id, patient_id, amount, currency, payment_gateway, gateway_order_id, gateway_payment_id, payment_method, status, paid_at, created_at, appointments(id, appointment_date, start_time, doctors(full_name, specialization), consultation_types(name, mode))",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as AdminPaymentRow[];
  const patientIds = Array.from(
    new Set(rows.map((r) => r.patient_id).filter((v): v is string => !!v)),
  );
  const patients = new Map<string, PatientProfile>();
  if (patientIds.length > 0) {
    const { data: profs, error: pErr } = await db
      .from("profiles")
      .select("id, full_name, email")
      .in("id", patientIds);
    if (pErr) throw pErr;
    for (const p of (profs ?? []) as PatientProfile[]) patients.set(p.id, p);
  }
  return { rows, patients };
}

function formatINR(n: number, currency = "INR"): string {
  const sym = currency?.toUpperCase() === "INR" ? "₹" : `${currency} `;
  return `${sym}${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
}

function formatDateOnly(date: string | null): string {
  if (!date) return "—";
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function methodLabel(row: AdminPaymentRow): string {
  const m = row.payment_method?.trim();
  if (m) return m.toUpperCase();
  return (row.payment_gateway ?? "razorpay").toUpperCase();
}

function PaymentsPage() {
  const queryClient = useQueryClient();
  const { user, session, isAdmin, adminChecked } = useAuth();
  const userId = user?.id ?? null;
  const accessToken = session?.access_token ?? null;
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "payments", userId],
    queryFn: fetchAdminPayments,
    enabled: Boolean(userId) && adminChecked && isAdmin,
  });

  useEffect(() => {
    if (!userId || !accessToken) return;
    const channel = (supabase as any)
      .channel(`admin-payments:${userId}:${accessToken.slice(-12)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin", "payments", userId] });
          queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
          queryClient.invalidateQueries({ queryKey: ["admin", "revenue-trend", 30] });
        },
      )
      .subscribe();
    return () => {
      (supabase as any).removeChannel(channel);
    };
  }, [queryClient, userId, accessToken]);

  const filtered = useMemo(() => {
    const rows = data?.rows ?? [];
    const patients = data?.patients ?? new Map<string, PatientProfile>();
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const p = r.patient_id ? patients.get(r.patient_id) : null;
      const hay = [
        r.id,
        r.gateway_payment_id ?? "",
        r.gateway_order_id ?? "",
        p?.full_name ?? "",
        p?.email ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data, search]);

  function handleInvoice(row: AdminPaymentRow) {
    const patient = row.patient_id ? data?.patients.get(row.patient_id) : undefined;
    const appt = row.appointments;
    const when = appt?.appointment_date
      ? `${formatDateOnly(appt.appointment_date)}${appt.start_time ? ` · ${formatTime(appt.start_time)}` : ""}`
      : "—";
    downloadInvoicePdf({
      invoiceNumber: `MC-${row.id.slice(0, 8).toUpperCase()}`,
      paymentId: row.id,
      appointmentId: row.appointment_id,
      patientName: patient?.full_name || patient?.email || "—",
      doctorName: appt?.doctors?.full_name ?? "—",
      consultationName: appt?.consultation_types?.name ?? "—",
      appointmentDateTime: when,
      amount: Number(row.amount) || 0,
      currency: row.currency || "INR",
      paymentMethod: methodLabel(row),
      paymentStatus: row.status,
      transactionId: row.gateway_payment_id || row.gateway_order_id || null,
      issuedOn: new Date().toLocaleString(),
    });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">Track transactions and download invoices.</p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by payment ID or patient name"
            className="h-10 rounded-xl pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment ID</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    Loading payments…
                  </TableCell>
                </TableRow>
              )}
              {error && !isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-destructive">
                    {(error as Error).message}
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !error && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No payments match your search.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((p) => {
                const patient = p.patient_id ? data?.patients.get(p.patient_id) : undefined;
                const dateLabel = p.paid_at
                  ? new Date(p.paid_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
                  : new Date(p.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.id.slice(0, 8).toUpperCase()}</TableCell>
                    <TableCell className="font-medium">{patient?.full_name ?? patient?.email ?? "—"}</TableCell>
                    <TableCell>{formatINR(Number(p.amount), p.currency)}</TableCell>
                    <TableCell>{methodLabel(p)}</TableCell>
                    <TableCell className="whitespace-nowrap">{dateLabel}</TableCell>
                    <TableCell><PaymentBadge status={p.status} /></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8"
                          onClick={() => handleInvoice(p)}
                        >
                          <FileText className="mr-1.5 h-3.5 w-3.5" /> Invoice
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">Track transactions, download invoices and process refunds.</p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by payment ID or patient" className="h-10 rounded-xl pl-9" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment ID</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.id}</TableCell>
                  <TableCell className="font-medium">{p.patient}</TableCell>
                  <TableCell>{p.amount}</TableCell>
                  <TableCell>{p.method}</TableCell>
                  <TableCell>{p.date}</TableCell>
                  <TableCell><PaymentBadge status={p.status} /></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-8"><FileText className="mr-1.5 h-3.5 w-3.5" /> Invoice</Button>
                      <Button size="sm" variant="ghost" className="h-8 text-destructive"><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Refund</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}