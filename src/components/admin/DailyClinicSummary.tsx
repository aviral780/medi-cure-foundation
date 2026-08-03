import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClinicSettings } from "@/lib/clinic-settings";
import {
  buildFallbackNarrative,
  buildInsights,
  fetchDailySummaryData,
  formatMoney,
  type DailySummaryData,
  type Insight,
} from "@/lib/daily-summary";
import { generateDailySummary } from "@/lib/daily-summary.functions";

function factsFrom(d: DailySummaryData): Record<string, string | number> {
  const f: Record<string, string | number> = {
    "Total appointments today": d.totalToday,
    "Completed today": d.completedToday,
    "Cancelled today": d.cancelledToday,
  };
  if (d.rescheduledToday) f["Rescheduled today"] = d.rescheduledToday;
  if (d.upcomingToday) f["Still upcoming today"] = d.upcomingToday;
  if (d.upcomingAhead) f["Upcoming in the next 7 days"] = d.upcomingAhead;
  if (d.pendingToday) f["Pending payment confirmation"] = d.pendingToday;
  if (d.newPatientsToday) f["New patient registrations today"] = d.newPatientsToday;
  if (d.returningPatientsToday) f["Returning patients today"] = d.returningPatientsToday;
  if (d.revenueToday) f["Revenue today"] = formatMoney(d.revenueToday, d.currency);
  if (d.revenueYesterday) f["Revenue yesterday"] = formatMoney(d.revenueYesterday, d.currency);
  if (d.revenueWeek) f["Revenue last 7 days"] = formatMoney(d.revenueWeek, d.currency);
  if (d.averageFee) f["Average consultation fee"] = formatMoney(d.averageFee, d.currency);
  if (d.topDoctor) f["Doctor with most consultations"] = `${d.topDoctor.name} (${d.topDoctor.count})`;
  if (d.topConsultationType) f["Most booked consultation type"] = d.topConsultationType;
  if (d.consultationMix.length)
    f["Consultation mix"] = d.consultationMix.map((c) => `${c.name}: ${c.count}`).join(", ");
  if (d.completionRate != null) f["Completion rate"] = `${Math.round(d.completionRate)}%`;
  if (d.occupancy != null) f["Slot occupancy today"] = `${Math.round(d.occupancy)}%`;
  return f;
}

const toneStyles: Record<Insight["tone"], { wrap: string; icon: string }> = {
  positive: {
    wrap: "border-emerald-200/70 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/20",
    icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  warning: {
    wrap: "border-amber-200/70 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20",
    icon: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  },
  info: {
    wrap: "border-sky-200/70 bg-sky-50/60 dark:border-sky-900/50 dark:bg-sky-950/20",
    icon: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  },
};

const toneIcon = {
  positive: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
} as const;

export function DailyClinicSummary() {
  const { clinic } = useClinicSettings();
  const generate = useServerFn(generateDailySummary);

  const data = useQuery({
    queryKey: ["admin", "daily-summary-data"],
    queryFn: fetchDailySummaryData,
    staleTime: 60_000,
  });

  const facts = useMemo(() => (data.data ? factsFrom(data.data) : null), [data.data]);

  const ai = useQuery({
    queryKey: ["admin", "daily-summary-ai", facts],
    enabled: Boolean(facts),
    staleTime: 10 * 60_000,
    retry: false,
    queryFn: () => generate({ data: { clinicName: clinic.name, facts: facts! } }),
  });

  const d = data.data;
  const narrative = ai.data?.narrative ?? (d ? buildFallbackNarrative(d) : "");
  const insights = d ? buildInsights(d) : [];
  const highlights = d
    ? [
        { label: "Appointments", value: String(d.totalToday) },
        { label: "Completed", value: String(d.completedToday) },
        { label: "New patients", value: String(d.newPatientsToday) },
        { label: "Revenue today", value: formatMoney(d.revenueToday, d.currency) },
      ]
    : [];

  const refreshing = data.isFetching || ai.isFetching;

  return (
    <section className="space-y-5">
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 py-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-soft)]">
              <Sparkles className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Daily Clinic Summary</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                AI-generated overview of today&apos;s activity at {clinic.name}.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl"
            disabled={refreshing}
            onClick={() => {
              void data.refetch();
              void ai.refetch();
            }}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="space-y-6 px-6 py-6">
          {data.isLoading ? (
            <div className="space-y-2.5">
              <div className="h-4 w-11/12 animate-pulse rounded-full bg-muted" />
              <div className="h-4 w-10/12 animate-pulse rounded-full bg-muted" />
              <div className="h-4 w-7/12 animate-pulse rounded-full bg-muted" />
            </div>
          ) : data.error ? (
            <p className="text-sm text-destructive">
              Could not load today&apos;s activity. {(data.error as Error).message}
            </p>
          ) : (
            <>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Today&apos;s Clinic Overview
                </div>
                <p className="mt-2 max-w-3xl text-[15px] leading-7 text-foreground/90">
                  {ai.isFetching && !ai.data ? (
                    <span className="text-muted-foreground">Generating summary…</span>
                  ) : (
                    narrative
                  )}
                </p>
                {ai.error && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    AI narrative unavailable right now — showing a data-derived summary instead.
                  </p>
                )}
              </div>

              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {highlights.map((h) => (
                  <div
                    key={h.label}
                    className="rounded-2xl border border-border/60 bg-background/60 px-4 py-3"
                  >
                    <dt className="text-xs font-medium text-muted-foreground">{h.label}</dt>
                    <dd className="mt-1 text-lg font-semibold tracking-tight">{h.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {(insights.length
          ? insights
          : ([
              { tone: "info", title: "Clinic Performance", body: "Waiting for today's data." },
              { tone: "info", title: "Attention Needed", body: "Waiting for today's data." },
              { tone: "info", title: "Revenue Insight", body: "Waiting for today's data." },
            ] as Insight[])
        ).map((ins) => {
          const Icon = toneIcon[ins.tone];
          const style = toneStyles[ins.tone];
          return (
            <div
              key={ins.title}
              className={`rounded-2xl border p-5 transition-shadow hover:shadow-[var(--shadow-soft)] ${style.wrap}`}
            >
              <div className="flex items-center gap-2.5">
                <span className={`grid h-8 w-8 place-items-center rounded-xl ${style.icon}`}>
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <h3 className="text-sm font-semibold">{ins.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{ins.body}</p>
            </div>
          );
        })}
      </div>

      {d && d.occupancy != null && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" aria-hidden />
          Slot occupancy today: {Math.round(d.occupancy)}%
        </div>
      )}
    </section>
  );
}
