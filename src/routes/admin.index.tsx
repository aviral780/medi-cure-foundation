import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarDays,
  CalendarCheck,
  Stethoscope,
  Users,
  IndianRupee,
  Activity,
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

export const Route = createFileRoute("/admin/")({
  component: DashboardPage,
});

const trendData = [
  { d: "Mon", appts: 24 },
  { d: "Tue", appts: 32 },
  { d: "Wed", appts: 28 },
  { d: "Thu", appts: 41 },
  { d: "Fri", appts: 38 },
  { d: "Sat", appts: 52 },
  { d: "Sun", appts: 30 },
];

const revenueData = [
  { m: "Jan", r: 42000 },
  { m: "Feb", r: 51000 },
  { m: "Mar", r: 48000 },
  { m: "Apr", r: 63000 },
  { m: "May", r: 71000 },
  { m: "Jun", r: 82000 },
];

const activity = [
  { who: "Dr. Aditi Rao", what: "confirmed an appointment", when: "2 min ago" },
  { who: "Rahul S.", what: "booked a consultation", when: "12 min ago" },
  { who: "Payment", what: "₹800 received via Razorpay", when: "34 min ago" },
  { who: "Dr. Mehta", what: "blocked 3 slots on Fri", when: "1 hr ago" },
  { who: "Priya K.", what: "rescheduled visit", when: "2 hr ago" },
];

function DashboardPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Overview of clinic activity, appointments and revenue.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Appointments" value="1,284" delta="+12.4% vs last month" icon={CalendarDays} accent="primary" />
        <StatCard label="Today's Appointments" value="38" delta="+4 since morning" icon={CalendarCheck} accent="info" />
        <StatCard label="Active Doctors" value="14" delta="2 on leave" trend="flat" icon={Stethoscope} accent="success" />
        <StatCard label="Total Patients" value="6,432" delta="+184 this month" icon={Users} accent="warning" />
        <StatCard label="Revenue (MTD)" value="₹8,24,500" delta="+9.1%" icon={IndianRupee} accent="success" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Appointment Trend</h2>
              <p className="text-xs text-muted-foreground">Last 7 days</p>
            </div>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="apptGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="d" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                <Area type="monotone" dataKey="appts" stroke="var(--color-primary)" strokeWidth={2} fill="url(#apptGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Revenue</h2>
              <p className="text-xs text-muted-foreground">Last 6 months</p>
            </div>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                <Bar dataKey="r" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Recent Activity</h2>
        </div>
        <ul className="mt-4 divide-y divide-border">
          {activity.map((a, i) => (
            <li key={i} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm">
                  <span className="font-medium">{a.who}</span>{" "}
                  <span className="text-muted-foreground">{a.what}</span>
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{a.when}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}