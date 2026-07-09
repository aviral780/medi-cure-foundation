import { CreditCard } from "lucide-react";

function toneFor(status: string | null | undefined): { bg: string; text: string; label: string } {
  const s = (status ?? "").toLowerCase();
  if (["confirmed", "scheduled", "booked"].includes(s))
    return { bg: "bg-primary-soft", text: "text-primary", label: s || "confirmed" };
  if (["completed", "paid", "success", "succeeded"].includes(s))
    return { bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", label: s };
  if (["cancelled", "canceled", "failed", "refunded"].includes(s))
    return { bg: "bg-destructive/10", text: "text-destructive", label: s };
  if (["pending", "processing", "awaiting_payment"].includes(s))
    return { bg: "bg-amber-100 dark:bg-amber-950/40", text: "text-amber-800 dark:text-amber-300", label: s };
  return { bg: "bg-muted", text: "text-muted-foreground", label: s || "unknown" };
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  const t = toneFor(status);
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${t.bg} ${t.text}`}>
      {t.label.replace(/_/g, " ")}
    </span>
  );
}

export function PaymentBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  const t = toneFor(status);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${t.bg} ${t.text}`}>
      <CreditCard className="h-3 w-3" aria-hidden />
      {t.label.replace(/_/g, " ")}
    </span>
  );
}