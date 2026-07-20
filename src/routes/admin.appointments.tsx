import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Filter, Eye, Check, CheckCheck, X, CalendarClock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge, PaymentBadge } from "@/components/appointments/StatusBadges";
import { supabase } from "@/lib/supabase";
import { formatTime } from "@/lib/booking-queries";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/admin/appointments")({
  component: AppointmentsPage,
});

type AdminAppointmentRow = {
  id: string;
  patient_id: string | null;
  appointment_date: string | null;
  start_time: string | null;
  appointment_status: string | null;
  payment_status: string | null;
  created_at: string;
  doctors: { full_name: string | null; specialization: string | null } | null;
  consultation_types: { name: string | null; mode: string | null } | null;
};

type PatientProfile = { id: string; full_name: string | null };

const db = supabase as any;

async function fetchAdminAppointments(): Promise<{
  rows: AdminAppointmentRow[];
  patients: Map<string, PatientProfile>;
}> {
  const { data, error } = await db
    .from("appointments")
    .select(
      "id, patient_id, appointment_date, start_time, appointment_status, payment_status, created_at, doctors(full_name, specialization), consultation_types(name, mode)",
    )
    .order("appointment_date", { ascending: false, nullsFirst: false })
    .order("start_time", { ascending: false, nullsFirst: false });
  if (error) throw error;
  const rows = (data ?? []) as AdminAppointmentRow[];

  const patientIds = Array.from(
    new Set(rows.map((r) => r.patient_id).filter((v): v is string => !!v)),
  );
  const patients = new Map<string, PatientProfile>();
  if (patientIds.length > 0) {
    const { data: profs, error: pErr } = await db
      .from("profiles")
      .select("id, full_name")
      .in("id", patientIds);
    if (pErr) throw pErr;
    for (const p of (profs ?? []) as PatientProfile[]) patients.set(p.id, p);
  }
  return { rows, patients };
}

function formatDateTime(date: string | null, time: string | null): string {
  if (!date) return "—";
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  const dateLabel = dt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  return time ? `${dateLabel} · ${formatTime(time)}` : dateLabel;
}

function formatMode(mode: string | null | undefined): string {
  if (mode === "in_person") return "In-Clinic";
  if (mode === "online") return "Online";
  return mode ?? "—";
}

function AppointmentsPage() {
  const queryClient = useQueryClient();
  const { user, session, isAdmin, adminChecked } = useAuth();
  const userId = user?.id ?? null;
  const accessToken = session?.access_token ?? null;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "appointments", userId],
    queryFn: fetchAdminAppointments,
    enabled: Boolean(userId) && adminChecked && isAdmin,
  });

  // Realtime: refresh on any change to appointments so bookings, cancellations
  // and reschedules appear without a manual page refresh.
  //
  // The channel lifecycle is intentionally keyed on the current Supabase
  // session's access token (not on `isAdmin` / `adminChecked`) so it:
  //   - reconnects immediately when the session or token rotates
  //     (sign-in, sign-out, token refresh, account switch), and
  //   - is established as soon as there is any authenticated session,
  //     so events cannot be silently missed during the brief window while
  //     `adminChecked` is still resolving.
  //
  // Security is preserved by the query itself: it stays gated by
  // `adminChecked && isAdmin`, and `invalidateQueries` on a disabled query
  // is a no-op — it will only refetch once admin membership is confirmed,
  // and RLS still governs which rows come back.
  useEffect(() => {
    if (!userId || !accessToken) return;
    const channel = (supabase as any)
      .channel(`admin-appointments:${userId}:${accessToken.slice(-12)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin", "appointments", userId] });
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
    return rows.filter((r) => {
      const status = (r.appointment_status ?? "").toLowerCase();
      if (statusFilter !== "all") {
        if (statusFilter === "cancelled") {
          if (status !== "cancelled" && status !== "canceled") return false;
        } else if (status !== statusFilter) return false;
      }
      if (typeFilter !== "all") {
        const mode = (r.consultation_types?.mode ?? "").toLowerCase();
        if (typeFilter === "online" && mode !== "online") return false;
        if (typeFilter === "clinic" && mode !== "in_person") return false;
      }
      if (q) {
        const p = r.patient_id ? patients.get(r.patient_id) : null;
        const hay = [
          r.id,
          p?.full_name ?? "",
          r.doctors?.full_name ?? "",
          r.doctors?.specialization ?? "",
          r.consultation_types?.name ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, search, statusFilter, typeFilter]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Appointments</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage bookings, payments and status.</p>
        </div>
      </header>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by patient, doctor or ID"
              className="h-10 rounded-xl pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 w-[150px] rounded-xl">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-10 w-[140px] rounded-xl">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="clinic">In-Clinic</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="h-10 rounded-xl" disabled title="Coming soon">
              <Filter className="mr-2 h-4 w-4" /> More filters
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Date &amp; time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    Loading appointments…
                  </TableCell>
                </TableRow>
              )}
              {error && !isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-destructive">
                    {(error as Error).message}
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !error && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    No appointments match your filters.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => {
                const patient = r.patient_id ? data?.patients.get(r.patient_id) : undefined;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.id.slice(0, 8)}</TableCell>
                    <TableCell className="font-medium">
                      {patient?.full_name ?? "—"}
                    </TableCell>
                    <TableCell>
                      {r.doctors?.full_name ?? "—"}
                      {r.doctors?.specialization ? (
                        <div className="text-xs text-muted-foreground">{r.doctors.specialization}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(r.appointment_date, r.start_time)}
                    </TableCell>
                    <TableCell>{formatMode(r.consultation_types?.mode)}</TableCell>
                    <TableCell>
                      <StatusBadge status={r.appointment_status} />
                    </TableCell>
                    <TableCell>
                      <PaymentBadge status={r.payment_status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" title="View" asChild>
                          <Link to="/appointments/$appointmentId" params={{ appointmentId: r.id }}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button size="icon" variant="ghost" title="Confirm (not available)" disabled>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Complete (not available)" disabled>
                          <CheckCheck className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Reschedule (not available)" disabled>
                          <CalendarClock className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Cancel (not available)"
                          disabled
                          className="text-destructive"
                        >
                          <X className="h-4 w-4" />
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
