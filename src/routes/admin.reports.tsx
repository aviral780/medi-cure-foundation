import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileDown, IndianRupee, CalendarDays, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import {
  fetchRevenueReport, fetchAppointmentReport, fetchPatientReport,
} from "@/lib/reports-queries";
import {
  downloadRevenueReportPdf, downloadAppointmentReportPdf,
  downloadPatientReportPdf, downloadCombinedReportPdf,
} from "@/lib/report-pdf";

export const Route = createFileRoute("/admin/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const revenue = useQuery({ queryKey: ["admin", "report", "revenue"], queryFn: () => fetchRevenueReport(30) });
  const appts = useQuery({ queryKey: ["admin", "report", "appointments"], queryFn: () => fetchAppointmentReport(30) });
  const patients = useQuery({ queryKey: ["admin", "report", "patients"], queryFn: fetchPatientReport });

  const loading = revenue.isLoading || appts.isLoading || patients.isLoading;
  const ready = !!revenue.data && !!appts.data && !!patients.data;
  const err = (revenue.error ?? appts.error ?? patients.error) as Error | undefined;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">Financial and operational reporting.</p>
        </div>
        <Button
          className="h-10 rounded-xl"
          disabled={!ready}
          onClick={() => ready && downloadCombinedReportPdf(revenue.data!, appts.data!, patients.data!)}
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
          Export All
        </Button>
      </header>

      {err && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Couldn't load report data: {err.message}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <ReportCard
          title="Revenue Report"
          icon={IndianRupee}
          color="var(--color-primary)"
          loading={revenue.isLoading}
          data={(revenue.data?.byMonth ?? []).map((b) => ({ m: b.label, v: b.value }))}
          stats={[
            ["Total revenue", formatINR(revenue.data?.totalRevenue ?? 0)],
            ["Today", formatINR(revenue.data?.todaysRevenue ?? 0)],
            ["Paid appointments", String(revenue.data?.totalPaidAppointments ?? 0)],
            ["Avg / appointment", formatINR(revenue.data?.averageRevenue ?? 0)],
          ]}
          onExport={revenue.data ? () => downloadRevenueReportPdf(revenue.data!) : undefined}
        />
        <ReportCard
          title="Appointment Report"
          icon={CalendarDays}
          color="oklch(0.68 0.14 155)"
          loading={appts.isLoading}
          data={(appts.data?.dailyTrend ?? []).map((b) => ({ m: b.label, v: b.value }))}
          stats={[
            ["Total", String(appts.data?.total ?? 0)],
            ["Completed", String(appts.data?.completed ?? 0)],
            ["Upcoming", String(appts.data?.upcoming ?? 0)],
            ["Cancelled", String(appts.data?.cancelled ?? 0)],
          ]}
          onExport={appts.data ? () => downloadAppointmentReportPdf(appts.data!) : undefined}
        />
        <ReportCard
          title="Patient Report"
          icon={Users}
          color="oklch(0.6 0.22 25)"
          loading={patients.isLoading}
          data={(patients.data?.monthlyPatients ?? []).map((b) => ({ m: b.label, v: b.value }))}
          stats={[
            ["Total patients", String(patients.data?.totalPatients ?? 0)],
            ["New (30d)", String(patients.data?.newPatients ?? 0)],
            ["Returning", String(patients.data?.returningPatients ?? 0)],
            ["Total visits", String(patients.data?.totalVisits ?? 0)],
          ]}
          onExport={patients.data ? () => downloadPatientReportPdf(patients.data!) : undefined}
        />
      </div>
    </div>
  );
}

function formatINR(n: number): string {
  return `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
}

function ReportCard({
  title, icon: Icon, color, data, stats, loading, onExport,
}: {
  title: string;
  icon: typeof IndianRupee;
  color: string;
  data: Array<{ m: string; v: number }>;
  stats: Array<[string, string]>;
  loading: boolean;
  onExport?: () => void;
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
        <Button size="sm" variant="ghost" className="h-8" disabled={!onExport} onClick={onExport}>
          <FileDown className="mr-1.5 h-3.5 w-3.5" /> Export
        </Button>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border/70 bg-muted/40 px-3 py-2">
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 text-sm font-semibold text-foreground">{loading ? "…" : value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
            <Line type="monotone" dataKey="v" name={title} stroke={color} strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}