import {
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  CreditCard,
  Hourglass,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = {
  className: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
};

function titleize(s: string): string {
  const t = s.replace(/_/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

function toneFor(status: string, kind: "status" | "payment"): Tone {
  const s = status.toLowerCase();
  const label = titleize(s);

  if (["confirmed", "scheduled", "booked"].includes(s))
    return {
      label,
      icon: BadgeCheck,
      className:
        "border-primary/25 bg-primary/10 text-primary dark:bg-primary/15",
    };
  if (["completed"].includes(s))
    return {
      label,
      icon: CheckCircle2,
      className:
        "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    };
  if (["paid", "success", "succeeded", "captured"].includes(s))
    return {
      label,
      icon: kind === "payment" ? ShieldCheck : CheckCircle2,
      className:
        "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    };
  if (["rescheduled"].includes(s))
    return {
      label,
      icon: CalendarClock,
      className:
        "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    };
  if (["refunded", "refund"].includes(s))
    return {
      label,
      icon: RotateCcw,
      className:
        "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    };
  if (["cancelled", "canceled", "failed"].includes(s))
    return {
      label,
      icon: XCircle,
      className: "border-destructive/25 bg-destructive/10 text-destructive",
    };
  if (["pending", "processing", "created", "awaiting_payment"].includes(s))
    return {
      label,
      icon: Hourglass,
      className:
        "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    };
  return {
    label: label || "Unknown",
    icon: CircleDashed,
    className: "border-border bg-muted text-muted-foreground",
  };
}

const BASE =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium leading-none tracking-tight transition-colors";

export function StatusBadge({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  if (!status) return null;
  const tone = toneFor(status, "status");
  const Icon = tone.icon;
  return (
    <span className={cn(BASE, tone.className, className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {tone.label}
    </span>
  );
}

export function PaymentBadge({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  if (!status) return null;
  const tone = toneFor(status, "payment");
  const Icon = tone.icon === CircleDashed ? CreditCard : tone.icon;
  return (
    <span className={cn(BASE, tone.className, className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {tone.label}
    </span>
  );
}