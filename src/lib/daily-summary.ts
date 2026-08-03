import { supabase } from "@/lib/supabase";

const db = supabase as any;

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export type DailySummaryData = {
  date: string;
  totalToday: number;
  completedToday: number;
  cancelledToday: number;
  rescheduledToday: number;
  pendingToday: number;
  upcomingToday: number;
  upcomingAhead: number;
  newPatientsToday: number;
  returningPatientsToday: number;
  revenueToday: number;
  revenueYesterday: number;
  revenueWeek: number;
  averageFee: number;
  consultationMix: Array<{ name: string; count: number }>;
  topConsultationType: string | null;
  topDoctor: { name: string; count: number } | null;
  completionRate: number | null;
  completionRateYesterday: number | null;
  totalYesterday: number;
  occupancy: number | null;
  currency: string;
};

const PAID_STATUSES = ["paid", "captured", "success", "successful"];

export async function fetchDailySummaryData(): Promise<DailySummaryData> {
  const now = new Date();
  const today = toISODate(now);
  const yesterday = toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

  const [apptRes, paymentsRes, profilesRes, slotsRes] = await Promise.all([
    db
      .from("appointments")
      .select(
        "id, patient_id, appointment_date, start_time, appointment_status, payment_status, created_at, doctors(full_name), consultation_types(name, fee, currency)",
      )
      .gte("appointment_date", toISODate(weekStart)),
    db
      .from("payments")
      .select("amount, currency, status, paid_at, created_at")
      .in("status", PAID_STATUSES)
      .gte("created_at", weekStart.toISOString()),
    db.from("profiles").select("id, created_at").gte("created_at", startOfToday.toISOString()),
    db
      .from("availability_slots")
      .select("id, status", { count: "exact" })
      .eq("slot_date", today),
  ]);

  const appts = (apptRes.data ?? []) as Array<any>;
  const payments = (paymentsRes.data ?? []) as Array<any>;

  const todays = appts.filter((a) => a.appointment_date === today);
  const yesterdays = appts.filter((a) => a.appointment_date === yesterday);

  const statusOf = (a: any) => String(a.appointment_status ?? "").toLowerCase();
  const isCancelled = (s: string) => s === "cancelled" || s === "canceled";

  const completedToday = todays.filter((a) => statusOf(a) === "completed").length;
  const cancelledToday = todays.filter((a) => isCancelled(statusOf(a))).length;
  const rescheduledToday = todays.filter((a) => statusOf(a) === "rescheduled").length;
  const pendingToday = todays.filter(
    (a) => String(a.payment_status ?? "").toLowerCase() === "pending" && !isCancelled(statusOf(a)),
  ).length;
  const upcomingToday = todays.filter(
    (a) => statusOf(a) === "confirmed" || statusOf(a) === "scheduled",
  ).length;
  const upcomingAhead = appts.filter(
    (a) => (a.appointment_date ?? "") > today && !isCancelled(statusOf(a)),
  ).length;

  const active = todays.filter((a) => !isCancelled(statusOf(a)));
  const doctorMap = new Map<string, number>();
  const typeMap = new Map<string, number>();
  let feeSum = 0;
  let feeCount = 0;
  let currency = "INR";
  for (const a of active) {
    const doc = a.doctors?.full_name ?? null;
    if (doc) doctorMap.set(doc, (doctorMap.get(doc) ?? 0) + 1);
    const type = a.consultation_types?.name ?? null;
    if (type) typeMap.set(type, (typeMap.get(type) ?? 0) + 1);
    const fee = Number(a.consultation_types?.fee ?? 0);
    if (fee > 0) {
      feeSum += fee;
      feeCount += 1;
    }
    if (a.consultation_types?.currency) currency = a.consultation_types.currency;
  }

  const sortDesc = (m: Map<string, number>) =>
    Array.from(m.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

  const consultationMix = sortDesc(typeMap);
  const doctors = sortDesc(doctorMap);

  const sumPayments = (from: Date, to?: Date) =>
    payments.reduce((sum, p) => {
      const when = p.paid_at ?? p.created_at;
      if (!when) return sum;
      const d = new Date(when);
      if (Number.isNaN(d.getTime())) return sum;
      if (d < from) return sum;
      if (to && d >= to) return sum;
      return sum + (Number(p.amount ?? 0) || 0);
    }, 0);

  const newPatientsToday = (profilesRes.data ?? []).length;
  const patientsWithVisitToday = new Set(
    active.map((a) => a.patient_id).filter(Boolean) as string[],
  );
  const newPatientIds = new Set(((profilesRes.data ?? []) as any[]).map((p) => p.id));
  const returningPatientsToday = Array.from(patientsWithVisitToday).filter(
    (id) => !newPatientIds.has(id),
  ).length;

  const finishedToday = completedToday + cancelledToday;
  const completionRate = finishedToday > 0 ? (completedToday / finishedToday) * 100 : null;
  const yCompleted = yesterdays.filter((a) => statusOf(a) === "completed").length;
  const yCancelled = yesterdays.filter((a) => isCancelled(statusOf(a))).length;
  const yFinished = yCompleted + yCancelled;
  const completionRateYesterday = yFinished > 0 ? (yCompleted / yFinished) * 100 : null;

  const totalSlots = slotsRes?.count ?? (slotsRes?.data?.length ?? 0);
  const occupancy = totalSlots > 0 ? Math.min(100, (active.length / totalSlots) * 100) : null;

  return {
    date: today,
    totalToday: todays.length,
    completedToday,
    cancelledToday,
    rescheduledToday,
    pendingToday,
    upcomingToday,
    upcomingAhead,
    newPatientsToday,
    returningPatientsToday,
    revenueToday: sumPayments(startOfToday),
    revenueYesterday: sumPayments(startOfYesterday, startOfToday),
    revenueWeek: sumPayments(weekStart),
    averageFee: feeCount > 0 ? feeSum / feeCount : 0,
    consultationMix,
    topConsultationType: consultationMix[0]?.name ?? null,
    topDoctor: doctors[0] ?? null,
    completionRate,
    completionRateYesterday,
    totalYesterday: yesterdays.length,
    occupancy,
    currency,
  };
}

export function formatMoney(n: number, currency = "INR"): string {
  const symbol = currency === "INR" ? "₹" : "";
  return `${symbol}${Math.round(n).toLocaleString("en-IN")}`;
}

/** Deterministic narrative used before/instead of the AI response. */
export function buildFallbackNarrative(d: DailySummaryData): string {
  const lines: string[] = [];
  if (d.totalToday === 0) {
    lines.push("No appointments are on the books for today yet.");
  } else {
    const parts: string[] = [];
    if (d.completedToday) parts.push(`${d.completedToday} completed`);
    if (d.cancelledToday) parts.push(`${d.cancelledToday} cancelled`);
    if (d.rescheduledToday) parts.push(`${d.rescheduledToday} rescheduled`);
    if (d.upcomingToday) parts.push(`${d.upcomingToday} still upcoming`);
    lines.push(
      `Today the clinic handled ${d.totalToday} appointment${d.totalToday === 1 ? "" : "s"}${
        parts.length ? `, including ${parts.join(", ")}` : ""
      }.`,
    );
  }
  if (d.newPatientsToday)
    lines.push(`${d.newPatientsToday} new patient${d.newPatientsToday === 1 ? "" : "s"} registered today.`);
  if (d.revenueToday)
    lines.push(`Revenue collected today was ${formatMoney(d.revenueToday, d.currency)}.`);
  if (d.topDoctor) lines.push(`${d.topDoctor.name} handled the highest number of consultations.`);
  if (d.topConsultationType) lines.push(`Most appointments were ${d.topConsultationType}.`);
  if (d.completionRate != null)
    lines.push(`Appointment completion rate is currently ${Math.round(d.completionRate)}%.`);
  if (lines.length === 0) lines.push("There is no clinic activity recorded for today yet.");
  return lines.join(" ");
}

export type Insight = {
  tone: "positive" | "warning" | "info";
  title: string;
  body: string;
};

export function buildInsights(d: DailySummaryData): Insight[] {
  const performance: Insight = (() => {
    if (d.completionRate != null && d.completionRateYesterday != null) {
      const diff = d.completionRate - d.completionRateYesterday;
      return {
        tone: diff >= 0 ? "positive" : "warning",
        title: "Clinic Performance",
        body: `Appointment completion ${diff >= 0 ? "increased" : "dropped"} by ${Math.abs(
          Math.round(diff),
        )}% versus yesterday (${Math.round(d.completionRate)}% today).`,
      };
    }
    if (d.completionRate != null)
      return {
        tone: "positive",
        title: "Clinic Performance",
        body: `${Math.round(d.completionRate)}% of today's finished appointments were completed.`,
      };
    return {
      tone: "info",
      title: "Clinic Performance",
      body: "Not enough completed appointments today to measure performance yet.",
    };
  })();

  const attention: Insight =
    d.pendingToday > 0
      ? {
          tone: "warning",
          title: "Attention Needed",
          body: `${d.pendingToday} appointment${d.pendingToday === 1 ? "" : "s"} remain${
            d.pendingToday === 1 ? "s" : ""
          } pending payment confirmation.`,
        }
      : {
          tone: "positive",
          title: "All Clear",
          body: "No appointments are waiting on payment confirmation right now.",
        };

  const revenue: Insight = (() => {
    if (d.revenueToday === 0 && d.revenueYesterday === 0)
      return {
        tone: "info",
        title: "Revenue Insight",
        body: "No payments have been collected today or yesterday.",
      };
    const diff = d.revenueToday - d.revenueYesterday;
    return {
      tone: diff >= 0 ? "positive" : "info",
      title: "Revenue Insight",
      body:
        diff === 0
          ? `Revenue matched yesterday at ${formatMoney(d.revenueToday, d.currency)}.`
          : `Revenue today ${diff > 0 ? "exceeded" : "trailed"} yesterday by ${formatMoney(
              Math.abs(diff),
              d.currency,
            )} (${formatMoney(d.revenueToday, d.currency)} collected).`,
    };
  })();

  return [performance, attention, revenue];
}
