import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Ban, CircleCheck } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/schedule")({
  component: SchedulePage,
});

const slots = [
  { time: "09:00", state: "available" },
  { time: "09:30", state: "booked" },
  { time: "10:00", state: "available" },
  { time: "10:30", state: "blocked" },
  { time: "11:00", state: "available" },
  { time: "11:30", state: "booked" },
  { time: "12:00", state: "available" },
  { time: "12:30", state: "available" },
];

const stateStyles: Record<string, string> = {
  available: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200",
  booked: "border-primary/40 bg-primary-soft text-primary",
  blocked: "border-destructive/30 bg-destructive/10 text-destructive",
};

function SchedulePage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Schedule Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create, block or unblock availability slots.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="h-10 rounded-xl"><Plus className="mr-2 h-4 w-4" /> Create Slots</Button>
          <Button variant="outline" className="h-10 rounded-xl"><Ban className="mr-2 h-4 w-4" /> Block Slots</Button>
          <Button variant="outline" className="h-10 rounded-xl"><CircleCheck className="mr-2 h-4 w-4" /> Unblock Slots</Button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        <div className="rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-soft)]">
          <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-xl" />
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">
              Slots for {date?.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
            </h2>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <LegendDot className="bg-emerald-500" /> Available
              <LegendDot className="bg-primary" /> Booked
              <LegendDot className="bg-destructive" /> Blocked
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {slots.map((s) => (
              <button
                key={s.time}
                type="button"
                className={`rounded-xl border px-3 py-3 text-sm font-medium capitalize transition-colors ${stateStyles[s.state]}`}
              >
                <div>{s.time}</div>
                <div className="mt-0.5 text-[11px] font-normal opacity-80">{s.state}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LegendDot({ className }: { className: string }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${className}`} />;
}