import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { formatFee, formatMode, type ConsultationType } from "@/lib/booking-queries";

export const Route = createFileRoute("/admin/consultation-types")({
  component: ConsultationTypesPage,
});

const db = supabase as any;

type DoctorLite = { id: string; full_name: string; is_active: boolean };
type Row = ConsultationType & { description: string | null; doctor: DoctorLite | null };

type FormState = {
  doctor_id: string;
  name: string;
  mode: "online" | "in_person";
  duration_minutes: string;
  fee: string;
  currency: string;
  description: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  doctor_id: "",
  name: "",
  mode: "in_person",
  duration_minutes: "30",
  fee: "500",
  currency: "INR",
  description: "",
  is_active: true,
};

const DEFAULT_SEEDS: Array<Omit<FormState, "doctor_id">> = [
  { name: "In-Clinic Consultation", mode: "in_person", duration_minutes: "30", fee: "500", currency: "INR", description: "", is_active: true },
  { name: "Video Consultation", mode: "online", duration_minutes: "30", fee: "700", currency: "INR", description: "", is_active: true },
  { name: "Reschedule Appointment", mode: "in_person", duration_minutes: "0", fee: "100", currency: "INR", description: "Fee applied when rescheduling an existing appointment.", is_active: true },
];

function ConsultationTypesPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);

  const doctorsQ = useQuery({
    queryKey: ["admin", "doctors-lite"],
    queryFn: async (): Promise<DoctorLite[]> => {
      const { data, error } = await db
        .from("doctors")
        .select("id, full_name, is_active")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as DoctorLite[];
    },
  });

  const typesQ = useQuery({
    queryKey: ["admin", "consultation-types"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await db
        .from("consultation_types")
        .select("id, doctor_id, name, mode, duration_minutes, fee, currency, is_active, description, doctors(id, full_name, is_active)")
        .order("name");
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ ...r, doctor: r.doctors ?? null })) as Row[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: FormState & { id?: string }) => {
      const record = {
        doctor_id: payload.doctor_id,
        name: payload.name.trim(),
        mode: payload.mode,
        duration_minutes: Number(payload.duration_minutes) || 0,
        fee: Number(payload.fee) || 0,
        currency: payload.currency.trim() || "INR",
        description: payload.description.trim() || null,
        is_active: payload.is_active,
      };
      if (payload.id) {
        const { error } = await db.from("consultation_types").update(record).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("consultation_types").insert(record);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "consultation-types"] });
      setDialogOpen(false);
      setEditing(null);
      toast.success(editing ? "Consultation type updated" : "Consultation type created");
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const remove = useMutation({
    mutationFn: async (row: Row) => {
      const { count, error: cErr } = await db
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("consultation_type_id", row.id);
      if (cErr) throw cErr;
      if ((count ?? 0) > 0) {
        throw new Error(`Cannot delete — ${count} appointment(s) reference this type.`);
      }
      const { error } = await db.from("consultation_types").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "consultation-types"] });
      setDeleteTarget(null);
      toast.success("Consultation type deleted");
    },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });

  const seed = useMutation({
    mutationFn: async (doctorId: string) => {
      const existing = new Set(
        (typesQ.data ?? [])
          .filter((r) => r.doctor_id === doctorId)
          .map((r) => r.name.toLowerCase()),
      );
      const rows = DEFAULT_SEEDS
        .filter((s) => !existing.has(s.name.toLowerCase()))
        .map((s) => ({
          doctor_id: doctorId,
          name: s.name,
          mode: s.mode,
          duration_minutes: Number(s.duration_minutes),
          fee: Number(s.fee),
          currency: s.currency,
          description: s.description || null,
          is_active: s.is_active,
        }));
      if (!rows.length) return 0;
      const { error } = await db.from("consultation_types").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["admin", "consultation-types"] });
      toast.success(n ? `Added ${n} default type(s)` : "Defaults already present");
    },
    onError: (e: any) => toast.error(e?.message ?? "Seed failed"),
  });

  const doctorOptions = doctorsQ.data ?? [];
  const rows = typesQ.data ?? [];

  const [seedDoctorId, setSeedDoctorId] = useState<string>("");
  const seedDoctor = useMemo(
    () => doctorOptions.find((d) => d.id === seedDoctorId) ?? null,
    [doctorOptions, seedDoctorId],
  );

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, doctor_id: doctorOptions[0]?.id ?? "" });
    setDialogOpen(true);
  }

  function openEdit(row: Row) {
    setEditing(row);
    setForm({
      doctor_id: row.doctor_id,
      name: row.name,
      mode: (row.mode === "online" ? "online" : "in_person") as FormState["mode"],
      duration_minutes: String(row.duration_minutes ?? 0),
      fee: String(row.fee ?? 0),
      currency: row.currency ?? "INR",
      description: row.description ?? "",
      is_active: !!row.is_active,
    });
    setDialogOpen(true);
  }

  function submit() {
    if (!form.doctor_id) return toast.error("Select a doctor");
    if (!form.name.trim()) return toast.error("Name is required");
    if (!(Number(form.fee) >= 0)) return toast.error("Fee must be a valid number");
    if (!(Number(form.duration_minutes) >= 0)) return toast.error("Duration must be a valid number");
    upsert.mutate({ ...form, id: editing?.id });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Consultation Types</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Single source of truth for consultation formats, fees and durations across patient and admin booking flows.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-1.5 pl-3">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <Select value={seedDoctorId} onValueChange={setSeedDoctorId}>
              <SelectTrigger className="h-8 w-[200px] border-0 bg-transparent px-2 shadow-none focus:ring-0">
                <SelectValue placeholder="Seed defaults for…" />
              </SelectTrigger>
              <SelectContent>
                {doctorOptions.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="secondary"
              className="h-8 rounded-lg"
              disabled={!seedDoctor || seed.isPending}
              onClick={() => seedDoctor && seed.mutate(seedDoctor.id)}
            >
              {seed.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Seed"}
            </Button>
          </div>
          <Button className="h-10 rounded-xl" onClick={openCreate} disabled={!doctorOptions.length}>
            <Plus className="mr-2 h-4 w-4" /> Add type
          </Button>
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {typesQ.isLoading && (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
              )}
              {!typesQ.isLoading && rows.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No consultation types yet.</TableCell></TableRow>
              )}
              {rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="font-medium">{t.name}</div>
                    {t.description && (
                      <div className="text-xs text-muted-foreground">{t.description}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{t.doctor?.full_name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{formatMode(t.mode)}</TableCell>
                  <TableCell>{t.duration_minutes ? `${t.duration_minutes} min` : "—"}</TableCell>
                  <TableCell>{formatFee(Number(t.fee), t.currency)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      t.is_active
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "bg-muted text-muted-foreground"
                    }`}>{t.is_active ? "Active" : "Inactive"}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(t)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit consultation type" : "Add consultation type"}</DialogTitle>
            <DialogDescription>
              Changes here apply immediately to the patient and admin booking flows.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Doctor</Label>
              <Select value={form.doctor_id} onValueChange={(v) => setForm((f) => ({ ...f, doctor_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger>
                <SelectContent>
                  {doctorOptions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Video Consultation" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Mode</Label>
                <Select value={form.mode} onValueChange={(v) => setForm((f) => ({ ...f, mode: v as FormState["mode"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_person">In-person</SelectItem>
                    <SelectItem value="online">Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Duration (min)</Label>
                <Input type="number" min="0" value={form.duration_minutes} onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Fee</Label>
                <Input type="number" min="0" value={form.fee} onChange={(e) => setForm((f) => ({ ...f, fee: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Currency</Label>
                <Input value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Description (optional)</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <div className="text-sm font-medium">Active</div>
                <div className="text-xs text-muted-foreground">Inactive types are hidden from patient booking.</div>
              </div>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={upsert.isPending}>
              {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create type"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This is permanent. Deletion is blocked if any appointment already references this type — deactivate it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (deleteTarget) remove.mutate(deleteTarget); }}
              disabled={remove.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}