import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  delta,
  trend = "up",
  icon: Icon,
  accent = "primary",
}: {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down" | "flat";
  icon: LucideIcon;
  accent?: "primary" | "success" | "warning" | "info";
}) {
  const accents: Record<string, string> = {
    primary: "bg-primary-soft text-primary",
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    warning: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    info: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  };
  const trendColor =
    trend === "up" ? "text-emerald-600" : trend === "down" ? "text-destructive" : "text-muted-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-muted-foreground">{label}</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
          {delta && <div className={`mt-1 text-xs font-medium ${trendColor}`}>{delta}</div>}
        </div>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${accents[accent]}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
    </div>
  );
}