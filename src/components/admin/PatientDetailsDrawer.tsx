import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  CreditCard,
  Mail,
  MapPin,
  Phone,
  Repeat,
  Search,
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge, PaymentBadge } from "@/components/appointments/StatusBadges";
import {
  formatFee,
  formatFullDate,
  formatMode,
  formatTime,
  initialsOf,
} from "@/lib/booking-queries";
import { supabase } from "@/lib/supabase";

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
};

type ApptRow = {
  id: string;
  appointment_status: string | null;
  payment_status: string | null;
  appointment_date: string | null;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  cancellation_reason: string | null;
  doctor_id: string | null;
  doctors: { full_name: string | null; specialization: string | null } | null;
  consultation_types: {
    name: string | null;
    mode: string | null;
    fee: number | null;
    currency: string | null;
  } | null;
};

type PaymentAgg = {
  appointment_id: string;
  amount: number;
  status: string;
};

async function fetchPatientProfile(id: string): Promise<ProfileRow | null> {
  const { data, error } = await (supabase as any)
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as ProfileRow | null;
}

async function fetchPatientAppointments(id: string): Promise<ApptRow[]> {
  const { data, error } = await (supabase as any)
    .from("appointments")
    .select(
      "id, appointment_status, payment_status, appointment_date, start_time, end_time, created_at, cancellation_reason, doctor_id, doctors(full_name, specialization), consultation_types(name, mode, fee, currency)",
    )
    .eq("patient_id", id)
    .order("appointment_date", { ascending: false, nullsFirst: false })
    .order("start_time", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as ApptRow[];
}

async function fetchPatientPayments(id: string): Promise<PaymentAgg[]> {
  const { data, error } = await (supabase as any)
    .from("payments")
    .select("appointment_id, amount, status")
    .eq("patient_id", id);
  if (error) throw error;
  return (data ?? []) as PaymentAgg[];
}

function computeAge(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  const age = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  return age >= 0 && age < 150 ? age : null;
}

export function PatientDetailsDrawer({
  patientId,
  open,
  onOpenChange,
}: {
  patientId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const enabled = Boolean(patientId) && open;
  const [profQ, apptQ, payQ] = useQueries({
    queries: [
      {
        queryKey: ["admin-patient-profile", patientId],
        queryFn: () => fetchPatientProfile(patientId as string),
        enabled,
      },
      {
        queryKey: ["admin-patient-appts", patientId],
        queryFn: () => fetchPatientAppointments(patientId as string),
        enabled,
      },
      {
        queryKey: ["admin-patient-payments", patientId],
        queryFn: () => fetchPatientPayments(patientId as string),
        enabled,
      },
    ],
  });

  const profile = profQ.data;
  const appts = apptQ.data ?? [];
  const payments = payQ.data ?? [];

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const paidByAppt = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of payments) {
      if ((p.status ?? "").toLowerCase() === "paid" || (p.status ?? "").toLowerCase() === "success") {
        m.set(p.appointment_id, (m.get(p.appointment_id) ?? 0) + Number(p.amount ?? 0));
      }
    }
    return m;
  }, [payments]);

  const stats = useMemo(() => {
    let completed = 0;
    let upcoming = 0;
    let cancelled = 0;
    let total = 0;
    const now = Date.now();
    let first: string | null = null;
    let last: string | null = null;
    for (const a of appts) {
      const s = (a.appointment_status ?? "").toLowerCase();
      if (s === "cancelled" || s === "canceled") {
        cancelled++;
      } else {
        total++;
        if (a.appointment_date) {
          if (!first || a.appointment_date < first) first = a.appointment_date;
          if (!last || a.appointment_date > last) last = a.appointment_date;
        }
        if (s === "completed") completed++;
        else if (a.appointment_date && a.start_time) {
          const [y, m, d] = a.appointment_date.split("-").map(Number);
          const [hh, mm] = a.start_time.split(":").map(Number);
          const ts = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0).getTime();
          if (ts >= now) upcoming++;
        }
      }
    }
    let spent = 0;
    for (const v of paidByAppt.values()) spent += v;
    return { completed, upcoming, cancelled, total, first, last, spent };
  }, [appts, paidByAppt]);

  // Follow-up: any appointment (chronologically after the first) with the same doctor
  const followUpIds = useMemo(() => {
    const perDoctor = new Map<string, string>(); // doctor_id -> earliest appt id (by date)
    const sorted = [...appts]
      .filter((a) => a.doctor_id && a.appointment_date)
      .sort((a, b) => (a.appointment_date! < b.appointment_date! ? -1 : 1));
    const followUps = new Set<string>();
    for (const a of sorted) {
      const key = a.doctor_id as string;
      if (perDoctor.has(key)) followUps.add(a.id);
      else perDoctor.set(key, a.id);
    }
    return followUps;
  }, [appts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return appts.filter((a) => {
      if (statusFilter !== "all") {
        const s = (a.appointment_status ?? "").toLowerCase();
        if (statusFilter === "cancelled" && !(s === "cancelled" || s === "canceled")) return false;
        if (statusFilter !== "cancelled" && s !== statusFilter) return false;
      }
      if (!q) return true;
      const hay = [
        a.doctors?.full_name,
        a.doctors?.specialization,
        a.consultation_types?.name,
        a.appointment_status,
        a.payment_status,
        a.appointment_date,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [appts, search, statusFilter]);

  const age = computeAge(profile?.date_of_birth);
  const isLoading = profQ.isLoading || apptQ.isLoading;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-hidden p-0 sm:max-w-2xl">
        <SheetHeader className="border-b border-border bg-card px-6 pb-4 pt-6">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
              {initialsOf(profile?.full_name ?? "?")}
            </span>
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate text-lg font-semibold">
                {profile?.full_name ?? "Patient"}
              </SheetTitle>
              <SheetDescription className="mt-1 font-mono text-xs">
                {patientId ?? ""}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-104px)]">
          <div className="space-y-5 px-6 py-6">
            {isLoading && <div className="h-64 animate-pulse rounded-2xl bg-muted" />}

            {!isLoading && (
              <>
                <Section title="Patient information">
                  <InfoRow icon={User} label="Full name" value={profile?.full_name ?? "—"} />
                  <InfoRow icon={Phone} label="Phone" value={profile?.phone ?? "—"} />
                  <InfoRow icon={Mail} label="Email" value={profile?.email ?? "—"} />
                  {age !== null && <InfoRow icon={User} label="Age" value={`${age}`} />}
                  {profile?.gender && (
                    <InfoRow icon={User} label="Gender" value={String(profile.gender)} />
                  )}
                </Section>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Total visits" value={stats.total} />
                  <Stat label="Completed" value={stats.completed} tone="success" />
                  <Stat label="Upcoming" value={stats.upcoming} tone="primary" />
                  <Stat label="Cancelled" value={stats.cancelled} tone="destructive" />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Stat
                    label="First visit"
                    value={stats.first ? formatFullDate(stats.first) : "—"}
                    small
                  />
                  <Stat
                    label="Last visit"
                    value={stats.last ? formatFullDate(stats.last) : "—"}
                    small
                  />
                  <Stat label="Total spent" value={formatFee(stats.spent, "INR")} small />
                </div>

                <Section title="Appointment history">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search by doctor, type or status"
                        className="h-10 rounded-xl pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-10 w-full rounded-xl sm:w-44">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="rescheduled">Rescheduled</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {filtered.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No appointments match your filters.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {filtered.map((a) => (
                        <li
                          key={a.id}
                          className="rounded-xl border border-border bg-background p-3"
                        >
                          <ApptCard
                            appt={a}
                            paidAmount={paidByAppt.get(a.id) ?? 0}
                            isFollowUp={followUpIds.has(a.id)}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function ApptCard({
  appt,
  paidAmount,
  isFollowUp,
}: {
  appt: ApptRow;
  paidAmount: number;
  isFollowUp: boolean;
}) {
  const s = (appt.appointment_status ?? "").toLowerCase();
  const isCancelled = s === "cancelled" || s === "canceled";
  const isRescheduled = s === "rescheduled";
  const ModeIcon = appt.consultation_types?.mode === "online" ? Video : MapPin;
  const StatusIcon = isCancelled
    ? XCircle
    : s === "completed"
      ? CheckCircle2
      : Clock;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {appt.doctors?.full_name ?? "—"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {appt.doctors?.specialization ?? ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={appt.appointment_status} />
          <PaymentBadge status={appt.payment_status} />
          {isFollowUp && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">
              <Repeat className="h-3 w-3" aria-hidden /> Follow-up
            </span>
          )}
          {isRescheduled && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <CalendarClock className="h-3 w-3" aria-hidden /> Rescheduled
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" aria-hidden />
          {appt.appointment_date ? formatFullDate(appt.appointment_date) : "—"}
        </span>
        {appt.start_time && appt.end_time && (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {formatTime(appt.start_time)} – {formatTime(appt.end_time)}
          </span>
        )}
        {appt.consultation_types && (
          <span className="inline-flex items-center gap-1.5">
            <ModeIcon className="h-3.5 w-3.5" aria-hidden />
            {appt.consultation_types.name} · {formatMode(appt.consultation_types.mode ?? "")}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <CreditCard className="h-3.5 w-3.5" aria-hidden />
          {appt.consultation_types
            ? formatFee(Number(appt.consultation_types.fee ?? 0), appt.consultation_types.currency ?? "INR")
            : "—"}
          {paidAmount > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400">
              · paid {formatFee(paidAmount, appt.consultation_types?.currency ?? "INR")}
            </span>
          )}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <StatusIcon className="h-3.5 w-3.5" aria-hidden />
          {appt.appointment_status ?? "—"}
        </span>
      </div>
      {isCancelled && appt.cancellation_reason && (
        <p className="rounded-md bg-destructive/5 px-2 py-1.5 text-xs text-destructive">
          Reason: {appt.cancellation_reason}
        </p>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 break-words text-foreground">{value}</p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  small,
}: {
  label: string;
  value: string | number;
  tone?: "success" | "primary" | "destructive";
  small?: boolean;
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "primary"
        ? "text-primary"
        : tone === "destructive"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-soft)]">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 font-semibold ${toneClass} ${small ? "text-sm" : "text-xl"}`}>
        {value}
      </p>
    </div>
  );
}