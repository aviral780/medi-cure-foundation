import { formatTime } from "@/lib/booking-queries";

export type SlotButtonState = "available" | "booked" | "expired" | "current";

export function SlotButton({
  startTime,
  state,
  selected,
  onSelect,
}: {
  startTime: string;
  state: SlotButtonState;
  selected: boolean;
  onSelect: () => void;
}) {
  const disabled = state !== "available";
  const label = formatTime(startTime);
  const aria =
    state === "available"
      ? label
      : `${label} (${state === "booked" ? "booked" : state === "expired" ? "expired" : "current"})`;

  let cls =
    "min-h-11 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors flex flex-col items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
  if (state === "current") {
    cls += " cursor-not-allowed border-primary/40 bg-primary-soft text-primary";
  } else if (state === "booked") {
    cls += " cursor-not-allowed border-dashed border-border bg-muted text-muted-foreground line-through opacity-70";
  } else if (state === "expired") {
    cls += " cursor-not-allowed border-dashed border-border bg-muted/60 text-muted-foreground opacity-60";
  } else if (selected) {
    cls += " border-primary bg-primary text-primary-foreground";
  } else {
    cls += " border-border bg-card text-foreground hover:border-primary/50";
  }

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={aria}
      onClick={() => !disabled && onSelect()}
      className={cls}
    >
      <span>{label}</span>
      {state === "booked" && <span className="mt-0.5 text-[10px] font-normal">Booked</span>}
      {state === "expired" && <span className="mt-0.5 text-[10px] font-normal">Expired</span>}
      {state === "current" && <span className="mt-0.5 text-[10px] font-normal">Current</span>}
    </button>
  );
}