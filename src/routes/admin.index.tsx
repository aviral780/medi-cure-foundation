import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CalendarCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Users,
  IndianRupee,
  Activity,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { StatCard } from "@/components/admin/StatCard";
import { StatusBadge, PaymentBadge } from "@/components/appointments/StatusBadges";
import {
  fetchAdminStats,
  fetchAppointmentTrend,
  fetchRevenueTrend,
  fetchRecentAppointments,
} from "@/lib/admin-queries";
import { formatTime } from "@/lib/booking-queries";

export const Route = createFileRoute("/admin/")({
  component: DashboardPage,
});

function formatINR(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function DashboardPage() {
  const stats = useQuery({ queryKey: ["admin", "stats"], queryFn: fetchAdminStats });
  const trend = useQuery({ queryKey: ["admin", "appt-trend", 30], queryFn: () => fetchAppointmentTrend(30) });
  const revenue = useQuery({ queryKey: ["admin", "revenue-trend", 30], queryFn: () => fetchRevenueTrend(30) });
  const recent = useQuery({ queryKey: ["admin", "recent-appts"], queryFn: () => fetchRecentAppointments(10) });

  const s = stats.data;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Live overview of clinic activity, appointments and revenue.</p>
      </header>

      {stats.error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Could not load dashboard statistics. {(stats.error as Error).message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Patients" value={s ? s.totalPatients.toLocaleString() : "—"} icon={Users} accent="warning" />
        <StatCard label="Today's Appointments" value={s ? String(s.todaysAppointments) : "—"} icon={CalendarCheck} accent="info" />
        <StatCard label="Upcoming Appointments" value={s ? String(s.upcomingAppointments) : "—"} icon={CalendarDays} accent="primary" />
        <StatCard label="Pending Appointments" value={s ? String(s.pendingAppointments) : "—"} icon={Clock} accent="warning" />
        <StatCard label="Completed" value={s ? String(s.completedAppointments) : "—"} icon={CheckCircle2} accent="success" />
        <StatCard label="Cancelled" value={s ? String(s.cancelledAppointments) : "—"} icon={XCircle} accent="warning" />
        <StatCard label="Today's Revenue" value={s ? formatINR(s.todaysRevenue) : "—"} icon={IndianRupee} accent="info" />
        <StatCard label="Total Revenue" value={s ? formatINR(s.totalRevenue) : "—"} icon={TrendingUp} accent="success" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <div>
            <h2 className="text-base font-semibold">Appointment Trend</h2>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </div>
          <div className="mt-4 h-64">
            {trend.isLoading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend.data ?? []} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="apptGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                  <Area type="monotone" dataKey="value" name="Appointments" stroke="var(--color-primary)" strokeWidth={2} fill="url(#apptGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <div>
            <h2 className="text-base font-semibold">Revenue</h2>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </div>
          <div className="mt-4 h-64">
            {revenue.isLoading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenue.data ?? []} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(0)}k` : v}`} />
                  <Tooltip formatter={(v: any) => formatINR(Number(v))} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                  <Bar dataKey="value" name="Revenue" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Recent Appointments</h2>
          </div>
          <Link to="/admin/appointments" className="text-xs font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">Doctor</th>
                <th className="py-2 pr-4 font-medium">Consultation</th>
                <th className="py-2 pr-4 font-medium">When</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Payment</th>
                <th className="py-2 pr-4 font-medium text-right">Fee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recent.isLoading && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">Loading…</td>
                </tr>
              )}
              {!recent.isLoading && (recent.data?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">No appointments yet.</td>
                </tr>
              )}
              {recent.data?.map((a) => (
                <tr key={a.id} className="align-top">
                  <td className="py-3 pr-4">
                    <div className="font-medium">{a.doctors?.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{a.doctors?.specialization ?? ""}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="font-medium">{a.consultation_types?.name ?? "—"}</div>
                    <div className="text-xs capitalize text-muted-foreground">{(a.consultation_types?.mode ?? "").replace("_", " ")}</div>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {a.appointment_date ?? "—"}
                    {a.start_time ? ` · ${formatTime(a.start_time)}` : ""}
                  </td>
                  <td className="py-3 pr-4"><StatusBadge status={a.appointment_status} /></td>
                  <td className="py-3 pr-4"><PaymentBadge status={a.payment_status} /></td>
                  <td className="py-3 pr-4 text-right font-medium">
                    {a.consultation_types ? formatINR(a.consultation_types.fee) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return <div className="h-full w-full animate-pulse rounded-xl bg-muted/60" />;
}
