import { supabase } from "@/lib/supabase";

const db = supabase as any;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, 1).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

const PAID_STATUSES = ["paid", "captured", "success", "successful"];

export type Bucket = { key: string; label: string; value: number };

export type RevenueReport = {
  totalRevenue: number;
  todaysRevenue: number;
  totalPaidAppointments: number;
  averageRevenue: number;
  byDay: Bucket[];
  byMonth: Bucket[];
  currency: string;
};

export async function fetchRevenueReport(days = 30): Promise<RevenueReport> {
  const { data, error } = await db
    .from("payments")
    .select("amount, currency, status, paid_at, created_at, appointment_id")
    .in("status", PAID_STATUSES);
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    amount: number | string | null;
    currency: string | null;
    paid_at: string | null;
    created_at: string | null;
    appointment_id: string | null;
  }>;

  const now = new Date();
  const todayKey = toISODate(now);
  let total = 0;
  let today = 0;
  const dayMap = new Map<string, number>();
  const monthMap = new Map<string, number>();
  const appts = new Set<string>();
  let currency = "INR";

  for (const r of rows) {
    const amt = Number(r.amount ?? 0) || 0;
    total += amt;
    if (r.currency) currency = r.currency;
    if (r.appointment_id) appts.add(r.appointment_id);
    const when = r.paid_at ?? r.created_at;
    if (!when) continue;
    const d = new Date(when);
    if (Number.isNaN(d.getTime())) continue;
    const dk = toISODate(d);
    if (dk === todayKey) today += amt;
    dayMap.set(dk, (dayMap.get(dk) ?? 0) + amt);
    const mk = monthKey(d);
    monthMap.set(mk, (monthMap.get(mk) ?? 0) + amt);
  }

  const byDay: Bucket[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = toISODate(d);
    byDay.push({
      key,
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: dayMap.get(key) ?? 0,
    });
  }

  const byMonth: Bucket[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    byMonth.push({ key, label: monthLabel(key), value: monthMap.get(key) ?? 0 });
  }

  const paidCount = appts.size;
  return {
    totalRevenue: total,
    todaysRevenue: today,
    totalPaidAppointments: paidCount,
    averageRevenue: paidCount > 0 ? total / paidCount : 0,
    byDay,
    byMonth,
    currency,
  };
}

export type AppointmentReport = {
  total: number;
  completed: number;
  upcoming: number;
  cancelled: number;
  noShow: number;
  byDoctor: Array<{ name: string; count: number }>;
  byConsultationType: Array<{ name: string; count: number }>;
  dailyTrend: Bucket[];
};

export async function fetchAppointmentReport(days = 30): Promise<AppointmentReport> {
  const { data, error } = await db
    .from("appointments")
    .select(
      "id, appointment_date, appointment_status, doctors(full_name), consultation_types(name, mode)",
    );
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    appointment_date: string | null;
    appointment_status: string | null;
    doctors: { full_name: string | null } | null;
    consultation_types: { name: string | null; mode: string | null } | null;
  }>;

  const now = new Date();
  const todayKey = toISODate(now);
  let completed = 0;
  let upcoming = 0;
  let cancelled = 0;
  let noShow = 0;
  const doctorMap = new Map<string, number>();
  const typeMap = new Map<string, number>();
  const dayMap = new Map<string, number>();

  for (const r of rows) {
    const status = (r.appointment_status ?? "").toLowerCase();
    if (status === "completed") completed += 1;
    else if (status === "cancelled" || status === "canceled") cancelled += 1;
    else if (status === "no_show" || status === "no-show" || status === "noshow") noShow += 1;
    else if (r.appointment_date && r.appointment_date >= todayKey) upcoming += 1;

    if (status !== "cancelled" && status !== "canceled") {
      const doc = r.doctors?.full_name ?? "Unassigned";
      doctorMap.set(doc, (doctorMap.get(doc) ?? 0) + 1);
      const type = r.consultation_types?.name ?? "Consultation";
      typeMap.set(type, (typeMap.get(type) ?? 0) + 1);
      if (r.appointment_date)
        dayMap.set(r.appointment_date, (dayMap.get(r.appointment_date) ?? 0) + 1);
    }
  }

  const dailyTrend: Bucket[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = toISODate(d);
    dailyTrend.push({
      key,
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: dayMap.get(key) ?? 0,
    });
  }

  const sortDesc = (m: Map<string, number>) =>
    Array.from(m.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

  return {
    total: rows.length,
    completed,
    upcoming,
    cancelled,
    noShow,
    byDoctor: sortDesc(doctorMap),
    byConsultationType: sortDesc(typeMap),
    dailyTrend,
  };
}

export type PatientReport = {
  totalPatients: number;
  newPatients: number;
  returningPatients: number;
  totalVisits: number;
  topPatients: Array<{ name: string; email: string; visits: number }>;
  recentRegistrations: Array<{ name: string; email: string; joined: string | null }>;
  monthlyPatients: Bucket[];
};

async function fetchProfiles(): Promise<
  Array<{ id: string; full_name: string | null; email: string | null; created_at: string | null }>
> {
  const withCreated = await db.from("profiles").select("id, full_name, email, created_at");
  if (!withCreated.error) return (withCreated.data ?? []) as any;
  const fallback = await db.from("profiles").select("id, full_name, email");
  if (fallback.error) throw fallback.error;
  return ((fallback.data ?? []) as any[]).map((p) => ({ ...p, created_at: null }));
}

export async function fetchPatientReport(): Promise<PatientReport> {
  const [profiles, apptsRes] = await Promise.all([
    fetchProfiles(),
    db.from("appointments").select("id, patient_id, appointment_status, created_at"),
  ]);
  if (apptsRes.error) throw apptsRes.error;
  const appts = (apptsRes.data ?? []) as Array<{
    patient_id: string | null;
    appointment_status: string | null;
    created_at: string | null;
  }>;

  const visitsByPatient = new Map<string, number>();
  let totalVisits = 0;
  for (const a of appts) {
    const status = (a.appointment_status ?? "").toLowerCase();
    if (status === "cancelled" || status === "canceled") continue;
    totalVisits += 1;
    if (a.patient_id)
      visitsByPatient.set(a.patient_id, (visitsByPatient.get(a.patient_id) ?? 0) + 1);
  }

  const now = new Date();
  const thirtyAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  let newPatients = 0;
  const monthMap = new Map<string, number>();
  for (const p of profiles) {
    if (!p.created_at) continue;
    const d = new Date(p.created_at);
    if (Number.isNaN(d.getTime())) continue;
    if (d >= thirtyAgo) newPatients += 1;
    const mk = monthKey(d);
    monthMap.set(mk, (monthMap.get(mk) ?? 0) + 1);
  }

  const returningPatients = Array.from(visitsByPatient.values()).filter((v) => v > 1).length;

  const nameOf = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    return { name: p?.full_name ?? "Unknown patient", email: p?.email ?? "—" };
  };

  const topPatients = Array.from(visitsByPatient.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, visits]) => ({ ...nameOf(id), visits }));

  const recentRegistrations = [...profiles]
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
    .slice(0, 10)
    .map((p) => ({
      name: p.full_name ?? "Unknown patient",
      email: p.email ?? "—",
      joined: p.created_at,
    }));

  const monthlyPatients: Bucket[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    monthlyPatients.push({ key, label: monthLabel(key), value: monthMap.get(key) ?? 0 });
  }

  return {
    totalPatients: profiles.length,
    newPatients,
    returningPatients,
    totalVisits,
    topPatients,
    recentRegistrations,
    monthlyPatients,
  };
}