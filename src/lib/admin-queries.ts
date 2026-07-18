import { supabase } from "@/lib/supabase";

const db = supabase as any;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toISODate(d);
}

async function countWhere(
  build: (q: any) => any,
): Promise<number> {
  const base = db.from("appointments").select("id", { count: "exact", head: true });
  const { count, error } = await build(base);
  if (error) throw error;
  return count ?? 0;
}

export type AdminStats = {
  totalPatients: number;
  todaysAppointments: number;
  upcomingAppointments: number;
  pendingAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  todaysRevenue: number;
  totalRevenue: number;
};

export async function fetchAdminStats(): Promise<AdminStats> {
  const today = todayISO();
  const now = new Date();
  const startOfDayISO = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const [
    patientsRes,
    todayApptsRes,
    upcomingRes,
    pendingRes,
    completedRes,
    cancelledRes,
    revenueTodayRes,
    revenueTotalRes,
  ] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }),
    // Today's appointments — scheduled for today and not cancelled
    countWhere((q: any) =>
      q.eq("appointment_date", today).not("appointment_status", "in", "(cancelled,canceled)"),
    ),
    // Upcoming — confirmed appointments dated today or later
    countWhere((q: any) => q.gte("appointment_date", today).eq("appointment_status", "confirmed")),
    // Pending — awaiting payment, not cancelled/completed
    countWhere((q: any) =>
      q
        .eq("payment_status", "pending")
        .not("appointment_status", "in", "(cancelled,canceled,completed)"),
    ),
    countWhere((q: any) => q.eq("appointment_status", "completed")),
    countWhere((q: any) => q.in("appointment_status", ["cancelled", "canceled"])),
    db.from("payments").select("amount").eq("status", "paid").gte("paid_at", startOfDayISO),
    db.from("payments").select("amount").eq("status", "paid"),
  ]);

  const sumAmounts = (rows: any): number =>
    Array.isArray(rows) ? rows.reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0) : 0;

  return {
    totalPatients: patientsRes.count ?? 0,
    todaysAppointments: todayApptsRes,
    upcomingAppointments: upcomingRes,
    pendingAppointments: pendingRes,
    completedAppointments: completedRes,
    cancelledAppointments: cancelledRes,
    todaysRevenue: sumAmounts(revenueTodayRes.data),
    totalRevenue: sumAmounts(revenueTotalRes.data),
  };
}

export type TrendPoint = { date: string; label: string; value: number };

function buildDateBuckets(days: number): TrendPoint[] {
  const out: TrendPoint[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    out.push({
      date: toISODate(d),
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: 0,
    });
  }
  return out;
}

export async function fetchAppointmentTrend(days = 30): Promise<TrendPoint[]> {
  const since = daysAgoISO(days - 1);
  const { data, error } = await db
    .from("appointments")
    .select("appointment_date")
    .gte("appointment_date", since);
  if (error) throw error;
  const buckets = buildDateBuckets(days);
  const idx = new Map(buckets.map((b, i) => [b.date, i] as const));
  for (const row of data ?? []) {
    const key = row.appointment_date as string | null;
    if (!key) continue;
    const i = idx.get(key);
    if (i != null) buckets[i]!.value += 1;
  }
  return buckets;
}

export async function fetchRevenueTrend(days = 30): Promise<TrendPoint[]> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  const { data, error } = await db
    .from("payments")
    .select("amount, paid_at")
    .eq("status", "paid")
    .gte("paid_at", start.toISOString());
  if (error) throw error;
  const buckets = buildDateBuckets(days);
  const idx = new Map(buckets.map((b, i) => [b.date, i] as const));
  for (const row of data ?? []) {
    if (!row.paid_at) continue;
    const d = new Date(row.paid_at);
    const key = toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
    const i = idx.get(key);
    if (i != null) buckets[i]!.value += Number(row.amount ?? 0);
  }
  return buckets;
}

export type RecentAppointment = {
  id: string;
  created_at: string;
  appointment_date: string | null;
  start_time: string | null;
  appointment_status: string | null;
  payment_status: string | null;
  doctors: { full_name: string; specialization: string } | null;
  consultation_types: { name: string; mode: string; fee: number; currency: string } | null;
};

export async function fetchRecentAppointments(limit = 10): Promise<RecentAppointment[]> {
  const { data, error } = await db
    .from("appointments")
    .select(
      "id, created_at, appointment_date, start_time, appointment_status, payment_status, doctors(full_name, specialization), consultation_types(name, mode, fee, currency)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as RecentAppointment[];
}