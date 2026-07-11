import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { ArrowLeft, Clock, MapPin, Video } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  fetchAllSlots,
  fetchConsultationTypes,
  fetchDoctorById,
  formatFee,
  formatMode,
  formatTime,
  isSlotExpired,
  isSlotStartInPast,
  type AvailabilitySlot,
  type ConsultationType,
} from "@/lib/booking-queries";
import { SlotButton } from "@/components/booking/SlotButton";

const searchSchema = z.object({
  consultationTypeId: z.string().min(1).optional(),
});

export const Route = createFileRoute("/_authenticated/doctors/$doctorId/book")({
  validateSearch: (raw): z.infer<typeof searchSchema> => searchSchema.parse(raw),
  component: BookingSelectionPage,
});

function BookingSelectionPage() {
  const { doctorId } = Route.useParams();
  const { consultationTypeId: preselectId } = Route.useSearch();
  const navigate = useNavigate();

  const doctorQ = useQuery({ queryKey: ["doctor", doctorId], queryFn: () => fetchDoctorById(doctorId) });
  const typesQ = useQuery({
    queryKey: ["consultation-types", doctorId],
    queryFn: () => fetchConsultationTypes(doctorId),
  });

  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(preselectId ?? null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  // Ensure the preselected type actually exists for this doctor.
  useEffect(() => {
    if (!preselectId || !typesQ.data) return;
    const exists = typesQ.data.some((t) => t.id === preselectId);
    if (exists && selectedTypeId !== preselectId) {
      setSelectedTypeId(preselectId);
    } else if (!exists && selectedTypeId === preselectId) {
      setSelectedTypeId(null);
    }
  }, [preselectId, typesQ.data]);

  const slotsQ = useQuery({
    queryKey: ["slots", doctorId, selectedTypeId],
    enabled: !!selectedTypeId,
    queryFn: () => fetchAllSlots(doctorId, selectedTypeId!),
  });

  const dates = useMemo(() => {
    const map = new Map<string, AvailabilitySlot[]>();
    (slotsQ.data ?? [])
      .filter((s) => !isSlotExpired(s))
      .forEach((s) => {
      const arr = map.get(s.slot_date) ?? [];
      arr.push(s);
      map.set(s.slot_date, arr);
    });
    return Array.from(map.entries()).map(([date, slots]) => ({
      date,
      slots,
      availableCount: slots.filter((s) => s.status === "available" && !isSlotStartInPast(s)).length,
    }));
  }, [slotsQ.data]);

  const timesForDate = useMemo(() => {
    if (!selectedDate) return [];
    return dates.find((d) => d.date === selectedDate)?.slots ?? [];
  }, [dates, selectedDate]);

  function onSelectType(id: string) {
    setSelectedTypeId(id);
    setSelectedDate(null);
    setSelectedSlotId(null);
  }
  function onSelectDate(date: string) {
    setSelectedDate(date);
    setSelectedSlotId(null);
  }

  const canContinue = !!(selectedTypeId && selectedSlotId);

  function onContinue() {
    if (!canContinue) return;
    navigate({
      to: "/booking/review",
      search: {
        doctorId,
        consultationTypeId: selectedTypeId!,
        slotId: selectedSlotId!,
      },
    });
  }

  return (
    <AppShell>
      <section className="mx-auto max-w-3xl px-4 py-6 pb-40 sm:px-6 sm:py-10">
        <Link
          to="/doctors/$doctorId"
          params={{ doctorId }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to profile
        </Link>

        <div className="mt-4">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Book an appointment</h1>
          {doctorQ.data && (
            <p className="mt-1 text-sm text-muted-foreground">
              with <span className="font-medium text-foreground">{doctorQ.data.full_name}</span> · {doctorQ.data.specialization}
            </p>
          )}
        </div>

        {/* Step 1: consultation type */}
        <Step number={1} title="Choose consultation type">
          {typesQ.isLoading && <div className="h-20 animate-pulse rounded-2xl bg-muted" />}
          {typesQ.error && <ErrorText>Couldn't load consultation options.</ErrorText>}
          {typesQ.data && typesQ.data.length === 0 && (
            <EmptyText>No active consultation options for this doctor.</EmptyText>
          )}
          <ul className="grid gap-3 sm:grid-cols-2">
            {(typesQ.data ?? []).map((t) => (
              <TypeOption
                key={t.id}
                type={t}
                selected={selectedTypeId === t.id}
                onSelect={() => onSelectType(t.id)}
              />
            ))}
          </ul>
        </Step>

        {/* Step 2: date */}
        {selectedTypeId && (
          <Step number={2} title="Select a date">
            {slotsQ.isLoading && <div className="h-16 animate-pulse rounded-2xl bg-muted" />}
            {slotsQ.error && <ErrorText>Couldn't load availability.</ErrorText>}
            {slotsQ.data && dates.length === 0 && (
              <EmptyText>No available appointments right now. Please try a different consultation type.</EmptyText>
            )}
            {dates.length > 0 && (
              <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
                {dates.map(({ date, availableCount }) => (
                  <DateChip
                    key={date}
                    date={date}
                    count={availableCount}
                    selected={selectedDate === date}
                    onClick={() => onSelectDate(date)}
                  />
                ))}
              </div>
            )}
          </Step>
        )}

        {/* Step 3: time */}
        {selectedDate && (
          <Step number={3} title="Pick a time">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {timesForDate.map((s) => {
                const expired = isSlotStartInPast(s);
                const state = expired
                  ? "expired"
                  : s.status === "available"
                  ? "available"
                  : "booked";
                return (
                  <SlotButton
                    key={s.id}
                    startTime={s.start_time}
                    state={state}
                    selected={selectedSlotId === s.id}
                    onSelect={() => setSelectedSlotId(s.id)}
                  />
                );
              })}
            </div>
            {timesForDate.length > 0 && timesForDate.every((s) => s.status !== "available") && (
              <p className="mt-3 text-xs text-muted-foreground">All slots for this day are booked. Try another date.</p>
            )}
          </Step>
        )}
      </section>

      <div
        className="fixed inset-x-0 bottom-14 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:bottom-0 sm:px-6"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <div className="mx-auto max-w-3xl">
          <Button onClick={onContinue} disabled={!canContinue} className="h-12 w-full rounded-xl text-base">
            Review booking
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {number}
        </span>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function TypeOption({ type, selected, onSelect }: { type: ConsultationType; selected: boolean; onSelect: () => void }) {
  const Icon = type.mode === "online" ? Video : MapPin;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`w-full rounded-2xl border p-4 text-left transition-all ${
          selected
            ? "border-primary bg-primary-soft ring-2 ring-primary/30"
            : "border-border bg-card hover:border-primary/40"
        }`}
      >
        <div className="flex items-center gap-2 text-primary">
          <Icon className="h-4 w-4" aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-wide">{formatMode(type.mode)}</span>
        </div>
        <p className="mt-2 text-base font-semibold text-foreground">{type.name}</p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" aria-hidden /> {type.duration_minutes} min
        </p>
        <p className="mt-3 text-lg font-semibold text-foreground">{formatFee(type.fee, type.currency)}</p>
      </button>
    </li>
  );
}

function DateChip({
  date,
  count,
  selected,
  onClick,
}: {
  date: string;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  const weekday = dt.toLocaleDateString(undefined, { weekday: "short" });
  const month = dt.toLocaleDateString(undefined, { month: "short" });
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-[76px] snap-start flex-col items-center rounded-xl border px-3 py-3 transition-colors ${
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:border-primary/50"
      }`}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide opacity-80">{weekday}</span>
      <span className="mt-0.5 text-lg font-semibold leading-none">{dt.getDate()}</span>
      <span className="mt-0.5 text-[11px] uppercase tracking-wide opacity-80">{month}</span>
      <span className={`mt-1.5 text-[10px] ${selected ? "opacity-80" : "text-muted-foreground"}`}>
        {count} slot{count === 1 ? "" : "s"}
      </span>
    </button>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-destructive">{children}</p>;
}
function EmptyText({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
      {children}
    </div>
  );
}