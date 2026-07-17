import { createFileRoute } from "@tanstack/react-router";
import { FileDown, IndianRupee, CalendarDays, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

export const Route = createFileRoute("/admin/reports")({
  component: ReportsPage,
});

const data = [
  { m: "Jan", revenue: 42000, appts: 210, patients: 90 },
  { m: "Feb", revenue: 51000, appts: 260, patients: 110 },
  { m: "Mar", revenue: 48000, appts: 240, patients: 100 },
  { m: "Apr", revenue: 63000, appts: 305, patients: 140 },
  { m: "May", revenue: 71000, appts: 345, patients: 160 },
  { m: "Jun", revenue: 82000, appts: 400, patients: 190 },
];

function ReportsPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">Financial and operational reporting.</p>
        </div>
        <Button className="h-10 rounded-xl"><FileDown className="mr-2 h-4 w-4" /> Export PDF</Button>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <ReportCard title="Revenue Report" icon={IndianRupee} dataKey="revenue" color="var(--color-primary)" />
        <ReportCard title="Appointment Report" icon={CalendarDays} dataKey="appts" color="oklch(0.68 0.14 155)" />
        <ReportCard title="Patient Report" icon={Users} dataKey="patients" color="oklch(0.6 0.22 25)" />
      </div>
    </div>
  );
}

function ReportCard({
  title, icon: Icon, dataKey, color,
}: {
  title: string;
  icon: typeof IndianRupee;
  dataKey: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <h2 className="text-base font-semibold">{title}</h2>
        </div>
        <Button size="sm" variant="ghost" className="h-8"><FileDown className="mr-1.5 h-3.5 w-3.5" /> Export</Button>
      </div>
      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}