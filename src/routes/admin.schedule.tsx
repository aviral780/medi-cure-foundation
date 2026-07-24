import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Ban, CircleCheck, Trash2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import {
  fetchActiveDoctors,
  fetchConsultationTypes,
  formatTime,
  type AvailabilitySlot,
  type ConsultationType,
  type Doctor,
} from "@/lib/booking-queries";

export const Route = createFileRoute("/admin/schedule")({
  component: SchedulePage,
});

const db = supabase as any;

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toMinutes(hms: string): number {
  const [h = 0, m = 0] = hms.split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

function slotStartMs(dateStr: string, hms: string): number {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h = 0, mi = 0] = hms.split(":").map(Number);
  return new Date(y ?? 1970, (mo ?? 1) - 1, d ?? 1, h, mi, 0).getTime();
}

async function fetchDaySlots(
  doctorId: string,
  consultationTypeId: string,
  dateStr: string,
): Promise<AvailabilitySlot[]> {
  const { data, error } = await db
    .from("availability_slots")
    .select("id, doctor_id, consultation_type_id, slot_date, start_time, end_time, status")
    .eq("doctor_id", doctorId)
    .eq("consultation_type_id", consultationTypeId)
    .eq("slot_date", dateStr)
    .order("start_time", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AvailabilitySlot[];
}

function isBookedStatus(status: string): boolean {
  const s = (status ?? "").toLowerCase();
  return s !== "available" && s !== "blocked";
}

function SchedulePage() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [consultationTypeId, setConsultationTypeId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);

  const doctorsQ = useQuery({ queryKey: ["admin-schedule-doctors"], queryFn: fetchActiveDoctors });

  useEffect(() => {
    if (!doctorId && doctorsQ.data && doctorsQ.data.length > 0) {
      setDoctorId(doctorsQ.data[0]!.id);
    }
  }, [doctorsQ.data, doctorId]);

  const typesQ = useQuery({
    queryKey: ["admin-schedule-types", doctorId],
    enabled: !!doctorId,
    queryFn: () => fetchConsultationTypes(doctorId!),
  });

  useEffect(() => {
    if (typesQ.data && typesQ.data.length > 0) {
      if (!consultationTypeId || !typesQ.data.some((t) => t.id === consultationTypeId)) {
        setConsultationTypeId(typesQ.data[0]!.id);
      }
    } else if (typesQ.data && typesQ.data.length === 0) {
      setConsultationTypeId(null);
    }
  }, [typesQ.data, consultationTypeId]);

  const dateStr = date ? toISODate(date) : null;

  const slotsQ = useQuery({
    queryKey: ["admin-schedule-slots", doctorId, consultationTypeId, dateStr],
    enabled: !!doctorId && !!consultationTypeId && !!dateStr,
    queryFn: () => fetchDaySlots(doctorId!, consultationTypeId!, dateStr!),
  });

  useEffect(() => {
    setSelected(new Set());
  }, [doctorId, consultationTypeId, dateStr]);

  // Realtime — invalidate on any availability_slots change so admin edits
  // (and patient bookings that flip slots to booked) show up instantly.
  useEffect(() => {
    const channel = db
      .channel(`admin-schedule:${doctorId ?? "none"}:${consultationTypeId ?? "none"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "availability_slots" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin-schedule-slots"] });
        },
      )
      .subscribe();
    return () => {
      db.removeChannel(channel);
    };
  }, [queryClient, doctorId, consultationTypeId]);

  const slots = slotsQ.data ?? [];

  const selectedSlots = useMemo(
    () => slots.filter((s) => selected.has(s.id)),
    [slots, selected],
  );
  const anyBookedSelected = selectedSlots.some((s) => isBookedStatus(s.status));
  const availableSelected = selectedSlots.filter((s) => (s.status ?? "").toLowerCase() === "available");
  const blockedSelected = selectedSlots.filter((s) => (s.status ?? "").toLowerCase() === "blocked");

  function toggleSlot(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-schedule-slots"] });
  };

  const blockMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) throw new Error("Select at least one available slot.");
      const { data, error } = await db
        .from("availability_slots")
        .update({ status: "blocked" })
        .in("id", ids)
        .eq("status", "available")
        .select("id");
      if (error) throw error;
      return (data ?? []).length as number;
    },
    onSuccess: (count) => {
      toast.success(`Blocked ${count} slot${count === 1 ? "" : "s"}.`);
      setSelected(new Set());
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to block slots."),
  });

  const unblockMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) throw new Error("Select at least one blocked slot.");
      const { data, error } = await db
        .from("availability_slots")
        .update({ status: "available" })
        .in("id", ids)
        .eq("status", "blocked")
        .select("id");
      if (error) throw error;
      return (data ?? []).length as number;
    },
    onSuccess: (count) => {
      toast.success(`Unblocked ${count} slot${count === 1 ? "" : "s"}.`);
      setSelected(new Set());
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to unblock slots."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) throw new Error("Select slots to delete.");
      const { data, error } = await db
        .from("availability_slots")
        .delete()
        .in("id", ids)
        .in("status", ["available", "blocked"])
        .select("id");
      if (error) throw error;
      return (data ?? []).length as number;
    },
    onSuccess: (count) => {
      toast.success(`Deleted ${count} slot${count === 1 ? "" : "s"}.`);
      setSelected(new Set());
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete slots."),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Schedule Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create, block or unblock availability slots.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            className="h-10 rounded-xl"
            onClick={() => setCreateOpen(true)}
            disabled={!doctorId || !consultationTypeId || !dateStr}
          >
            <Plus className="mr-2 h-4 w-4" /> Create Slots
          </Button>
          <Button
            variant="outline"
            className="h-10 rounded-xl"
            disabled={availableSelected.length === 0 || anyBookedSelected || blockMutation.isPending}
            onClick={() => blockMutation.mutate(availableSelected.map((s) => s.id))}
          >
            <Ban className="mr-2 h-4 w-4" /> Block ({availableSelected.length})
          </Button>
          <Button
            variant="outline"
            className="h-10 rounded-xl"
            disabled={blockedSelected.length === 0 || anyBookedSelected || unblockMutation.isPending}
            onClick={() => unblockMutation.mutate(blockedSelected.map((s) => s.id))}
          >
            <CircleCheck className="mr-2 h-4 w-4" /> Unblock ({blockedSelected.length})
          </Button>
          <Button
            variant="outline"
            className="h-10 rounded-xl text-destructive hover:text-destructive"
            disabled={selectedSlots.length === 0 || anyBookedSelected || deleteMutation.isPending}
            onClick={() => deleteMutation.mutate(selectedSlots.map((s) => s.id))}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedSlots.length})
          </Button>
        </div>
      </header>

      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] sm:grid-cols-2">
        <div>
          <Label className="text-xs text-muted-foreground">Doctor</Label>
          <Select value={doctorId ?? undefined} onValueChange={(v) => setDoctorId(v)}>
            <SelectTrigger className="mt-1 h-10 rounded-xl">
              <SelectValue placeholder="Select doctor" />
            </SelectTrigger>
            <SelectContent>
              {(doctorsQ.data ?? []).map((d: Doctor) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.full_name} · {d.specialization}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Consultation type</Label>
          <Select
            value={consultationTypeId ?? undefined}
            onValueChange={(v) => setConsultationTypeId(v)}
            disabled={!doctorId || (typesQ.data ?? []).length === 0}
          >
            <SelectTrigger className="mt-1 h-10 rounded-xl">
              <SelectValue placeholder="Select consultation type" />
            </SelectTrigger>
            <SelectContent>
              {(typesQ.data ?? []).map((t: ConsultationType) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name} · {t.duration_minutes} min
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

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

          {(!doctorId || !consultationTypeId) && (
            <p className="mt-4 text-sm text-muted-foreground">Select a doctor and consultation type to view slots.</p>
          )}

          {doctorId && consultationTypeId && (
            <div className="mt-4">
              {slotsQ.isLoading ? (
                <div className="h-20 animate-pulse rounded-xl bg-muted" />
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No slots for this day. Use “Create Slots” to add availability.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {slots.map((s) => {
                    const status = (s.status ?? "").toLowerCase();
                    const state: "available" | "booked" | "blocked" = status === "available"
                      ? "available"
                      : status === "blocked"
                      ? "blocked"
                      : "booked";
                    const isSelected = selected.has(s.id);
                    const disabled = state === "booked";
                    const base =
                      "rounded-xl border px-3 py-3 text-sm font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
                    let cls: string;
                    if (state === "booked") {
                      cls = "cursor-not-allowed border-primary/40 bg-primary-soft text-primary opacity-90";
                    } else if (state === "blocked") {
                      cls = isSelected
                        ? "border-destructive bg-destructive text-destructive-foreground"
                        : "border-destructive/30 bg-destructive/10 text-destructive hover:border-destructive/60";
                    } else {
                      cls = isSelected
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-emerald-300 bg-emerald-50 text-emerald-800 hover:border-emerald-500 dark:bg-emerald-950/30 dark:text-emerald-200";
                    }
                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => !disabled && toggleSlot(s.id)}
                        className={`${base} ${cls}`}
                      >
                        <div>{formatTime(s.start_time)}</div>
                        <div className="mt-0.5 text-[11px] font-normal opacity-80">{state}</div>
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedSlots.length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {selectedSlots.length} selected · Booked slots are protected and cannot be modified.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <CreateSlotsDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        doctorId={doctorId}
        consultationType={typesQ.data?.find((t) => t.id === consultationTypeId) ?? null}
        dateStr={dateStr}
        existing={slots}
        onCreated={() => {
          invalidate();
          setCreateOpen(false);
        }}
      />
    </div>
  );
}

function LegendDot({ className }: { className: string }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${className}`} />;
}

function CreateSlotsDialog({
  open,
  onOpenChange,
  doctorId,
  consultationType,
  dateStr,
  existing,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  doctorId: string | null;
  consultationType: ConsultationType | null;
  dateStr: string | null;
  existing: AvailabilitySlot[];
  onCreated: () => void;
}) {
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [duration, setDuration] = useState<number>(consultationType?.duration_minutes ?? 30);

  useEffect(() => {
    if (consultationType?.duration_minutes) setDuration(consultationType.duration_minutes);
  }, [consultationType?.duration_minutes]);

  const createMut = useMutation({
    mutationFn: async () => {
      if (!doctorId || !consultationType || !dateStr) throw new Error("Missing selection.");
      const dur = Number(duration);
      if (!Number.isFinite(dur) || dur <= 0) throw new Error("Duration must be positive.");
      const startMin = toMinutes(startTime);
      const endMin = toMinutes(endTime);
      if (!(endMin > startMin)) throw new Error("End time must be after start time.");

      const now = Date.now();
      const proposals: { start: number; end: number }[] = [];
      for (let s = startMin; s + dur <= endMin; s += dur) {
        proposals.push({ start: s, end: s + dur });
      }
      if (proposals.length === 0) throw new Error("No slots fit in this window.");

      const existingRanges = existing.map((e) => ({
        start: toMinutes(e.start_time),
        end: toMinutes(e.end_time),
      }));

      const rows: Array<{
        doctor_id: string;
        consultation_type_id: string;
        slot_date: string;
        start_time: string;
        end_time: string;
        status: string;
      }> = [];
      let skippedPast = 0;
      let skippedOverlap = 0;
      for (const p of proposals) {
        if (slotStartMs(dateStr, fromMinutes(p.start)) < now) {
          skippedPast++;
          continue;
        }
        const overlaps = existingRanges.some((r) => p.start < r.end && p.end > r.start);
        if (overlaps) {
          skippedOverlap++;
          continue;
        }
        rows.push({
          doctor_id: doctorId,
          consultation_type_id: consultationType.id,
          slot_date: dateStr,
          start_time: fromMinutes(p.start),
          end_time: fromMinutes(p.end),
          status: "available",
        });
      }

      if (rows.length === 0) {
        return { inserted: 0, skippedPast, skippedOverlap };
      }
      const { data, error } = await db
        .from("availability_slots")
        .insert(rows)
        .select("id");
      if (error) throw error;
      return { inserted: (data ?? []).length, skippedPast, skippedOverlap };
    },
    onSuccess: (res) => {
      const parts: string[] = [];
      parts.push(`Created ${res.inserted} slot${res.inserted === 1 ? "" : "s"}`);
      if (res.skippedPast) parts.push(`${res.skippedPast} in the past skipped`);
      if (res.skippedOverlap) parts.push(`${res.skippedOverlap} overlapping skipped`);
      if (res.inserted === 0) toast.warning(parts.join(" · "));
      else toast.success(parts.join(" · "));
      onCreated();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to create slots."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create availability slots</DialogTitle>
          <DialogDescription>
            Generates back-to-back slots for{" "}
            <span className="font-medium">{consultationType?.name ?? "—"}</span>. Overlapping and past slots are
            skipped automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="start">Start time</Label>
              <Input id="start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="end">End time</Label>
              <Input id="end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="dur">Slot duration (minutes)</Label>
            <Input
              id="dur"
              type="number"
              min={5}
              step={5}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
            {createMut.isPending ? "Creating…" : "Create slots"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}