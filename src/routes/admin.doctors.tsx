import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Stethoscope, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { formatFee, formatMode, type ConsultationType, type Doctor } from "@/lib/booking-queries";
import { fetchAllDoctors, createDoctor, updateDoctor, deleteDoctor, type DoctorInput } from "@/lib/doctors-api";
import { DEFAULT_DOCTOR } from "@/lib/clinic-constants";

export const Route = createFileRoute("/admin/doctors")({
  component: DoctorsPage,
});

const db = supabase as any;

type FormState = {
  full_name: string;
  specialization: string;
  qualifications: string;
  experience_years: string;
  bio: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  full_name: DEFAULT_DOCTOR.name,
  specialization: DEFAULT_DOCTOR.specialty,
  qualifications: DEFAULT_DOCTOR.qualifications,
  experience_years: String(DEFAULT_DOCTOR.experienceYears),
  bio: DEFAULT_DOCTOR.description,
  is_active: true,
};

function toForm(d: Doctor): FormState {
  return {
    full_name: d.full_name ?? "",
    specialization: d.specialization ?? "",
    qualifications: d.qualifications ?? "",
    experience_years: d.experience_years == null ? "" : String(d.experience_years),
    bio: d.bio ?? "",
    is_active: !!d.is_active,
  };
}

function toInput(f: FormState): DoctorInput {
  const years = f.experience_years.trim() === "" ? null : Number(f.experience_years);
  return {
    full_name: f.full_name.trim(),
    specialization: f.specialization.trim(),
    qualifications: f.qualifications.trim() || null,
    experience_years: years != null && Number.isFinite(years) ? years : null,
    bio: f.bio.trim() || null,
    is_active: f.is_active,
  };
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter((p) => !/^dr\.?$/i.test(p));
  return (parts.slice(-1)[0] ?? name).slice(0, 2).toUpperCase();
}

function DoctorsPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Doctor | null>(null);

  const doctorsQ = useQuery({ queryKey: ["admin", "doctors"], queryFn: fetchAllDoctors });

  const typesQ = useQuery({
    queryKey: ["admin", "consultation-types-lite"],
    queryFn: async (): Promise<ConsultationType[]> => {
      const { data, error } = await db
        .from("consultation_types")
        .select("id, doctor_id, name, mode, duration_minutes, fee, currency, is_active")
        .order("name");
      if (error) throw error;
      return (data ?? []) as ConsultationType[];
    },
  });

  const feeByDoctor = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of typesQ.data ?? []) {
      if (!t.is_active) continue;
      const cur = map.get(t.doctor_id);
      if (cur == null || Number(t.fee) < cur) map.set(t.doctor_id, Number(t.fee));
    }
    return map;
  }, [typesQ.data]);

  // Any doctor change must show up everywhere the doctor is used.
  function invalidateDoctorConsumers() {
    qc.invalidateQueries({ queryKey: ["admin", "doctors"] });
    qc.invalidateQueries({ queryKey: ["doctors"] });
    qc.invalidateQueries({ queryKey: ["doctor"] });
    qc.invalidateQueries({ queryKey: ["admin", "doctors-lite"] });
    qc.invalidateQueries({ queryKey: ["appointment"] });
    qc.invalidateQueries({ queryKey: ["admin-appt-detail"] });
    qc.invalidateQueries({ queryKey: ["admin", "appointments"] });
    qc.invalidateQueries({ queryKey: ["visits"] });
    qc.invalidateQueries({ queryKey: ["admin", "overview"] });
    qc.invalidateQueries({ queryKey: ["admin", "reports"] });
  }

  const saveM = useMutation({
    mutationFn: async () => {
      const input = toInput(form);
      if (!input.full_name) throw new Error("Doctor name is required.");
      if (!input.specialization) throw new Error("Specialty is required.");
      if (editing) return updateDoctor(editing.id, input);
      return createDoctor(input);
    },
    onSuccess: () => {
      toast.success(editing ? "Doctor updated" : "Doctor added");
      setDialogOpen(false);
      setEditing(null);
      invalidateDoctorConsumers();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteM = useMutation({
    mutationFn: async (d: Doctor) => deleteDoctor(d.id),
    onSuccess: (result) => {
      toast.success(
        result === "deleted"
          ? "Doctor deleted"
          : "Doctor has appointments — deactivated instead of deleted",
      );
      setDeleteTarget(null);
      invalidateDoctorConsumers();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const doctors = doctorsQ.data ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Doctors</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage clinic doctors and consultation types.</p>
        </div>
        <Button
          className="h-10 rounded-xl"
          onClick={() => { setEditing(null); setForm(emptyForm); setDialogOpen(true); }}
        >
          <Plus className="mr-2 h-4 w-4" /> Add Doctor
        </Button>
      </header>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doctor</TableHead>
                <TableHead>Specialty</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doctorsQ.isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  </TableCell>
                </TableRow>
              )}
              {!doctorsQ.isLoading && doctors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No doctors yet.
                  </TableCell>
                </TableRow>
              )}
              {doctors.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary-soft text-primary text-xs font-semibold">
                          {initials(d.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium">{d.full_name}</div>
                        {d.qualifications && (
                          <div className="text-xs text-muted-foreground">{d.qualifications}</div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{d.specialization}</TableCell>
                  <TableCell>{d.experience_years != null ? `${d.experience_years} yrs` : "—"}</TableCell>
                  <TableCell>
                    {feeByDoctor.has(d.id) ? formatFee(feeByDoctor.get(d.id)!, "INR") : "—"}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      d.is_active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                    }`}>{d.is_active ? "Active" : "Inactive"}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Edit"
                        onClick={() => { setEditing(d); setForm(toForm(d)); setDialogOpen(true); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Delete"
                        className="text-destructive"
                        onClick={() => setDeleteTarget(d)}
                      >
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

      <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Consultation Types</h2>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(typesQ.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No consultation types yet.</p>
          )}
          {(typesQ.data ?? []).map((c) => (
            <div key={c.id} className="rounded-xl border border-border/70 p-4">
              <div className="text-sm font-medium">{c.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {formatMode(c.mode)} · {c.duration_minutes} min · {formatFee(Number(c.fee), c.currency)}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Manage these in the Consultation Types page.
        </p>
      </section>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit doctor" : "Add doctor"}</DialogTitle>
            <DialogDescription>
              Changes apply everywhere the doctor appears across the app.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="doc-name">Full name</Label>
              <Input id="doc-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="doc-spec">Specialty</Label>
                <Input id="doc-spec" value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-exp">Experience (years)</Label>
                <Input id="doc-exp" type="number" min={0} value={form.experience_years} onChange={(e) => setForm({ ...form, experience_years: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-qual">Qualifications</Label>
              <Input id="doc-qual" value={form.qualifications} onChange={(e) => setForm({ ...form, qualifications: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-bio">Description</Label>
              <Textarea id="doc-bio" rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <Label htmlFor="doc-active">Active</Label>
                <p className="text-xs text-muted-foreground">Inactive doctors are hidden from patients.</p>
              </div>
              <Switch id="doc-active" checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>
              {saveM.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Add doctor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              If this doctor has appointments, the record is deactivated instead of deleted so
              existing appointment history stays intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); if (deleteTarget) deleteM.mutate(deleteTarget); }}
              disabled={deleteM.isPending}
            >
              {deleteM.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
