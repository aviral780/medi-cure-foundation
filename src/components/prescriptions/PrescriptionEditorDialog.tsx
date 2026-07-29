import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  emptyMedicine,
  fetchPrescriptionByAppointment,
  savePrescription,
  type Medicine,
} from "@/lib/prescriptions-api";

type Form = {
  chief_complaint: string;
  diagnosis: string;
  medicines: Medicine[];
  investigations: string;
  advice: string;
  follow_up_date: string;
  additional_notes: string;
};

const EMPTY_FORM: Form = {
  chief_complaint: "",
  diagnosis: "",
  medicines: [emptyMedicine()],
  investigations: "",
  advice: "",
  follow_up_date: "",
  additional_notes: "",
};

export function PrescriptionEditorDialog({
  appointmentId,
  patientId,
  doctorId,
  patientName,
  doctorName,
  open,
  onOpenChange,
}: {
  appointmentId: string;
  patientId: string | null;
  doctorId: string | null;
  patientName: string;
  doctorName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(EMPTY_FORM);

  const { data: existing, isLoading } = useQuery({
    queryKey: ["prescription", appointmentId],
    queryFn: () => fetchPrescriptionByAppointment(appointmentId),
    enabled: open && Boolean(appointmentId),
  });

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setForm({
        chief_complaint: existing.chief_complaint ?? "",
        diagnosis: existing.diagnosis ?? "",
        medicines: existing.medicines.length > 0 ? existing.medicines : [emptyMedicine()],
        investigations: existing.investigations ?? "",
        advice: existing.advice ?? "",
        follow_up_date: existing.follow_up_date ?? "",
        additional_notes: existing.additional_notes ?? "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, existing]);

  const isPublished = existing?.status === "published";

  const save = useMutation({
    mutationFn: (status: "draft" | "published") =>
      savePrescription({
        appointment_id: appointmentId,
        patient_id: patientId,
        doctor_id: doctorId,
        chief_complaint: form.chief_complaint.trim(),
        diagnosis: form.diagnosis.trim(),
        medicines: form.medicines,
        investigations: form.investigations.trim(),
        advice: form.advice.trim(),
        follow_up_date: form.follow_up_date || null,
        additional_notes: form.additional_notes.trim(),
        status,
      }),
    onSuccess: (row) => {
      toast.success(row.status === "published" ? "Prescription published" : "Draft saved");
      queryClient.invalidateQueries({ queryKey: ["prescription", appointmentId] });
      queryClient.invalidateQueries({ queryKey: ["prescription-flags"] });
      if (row.status === "published") onOpenChange(false);
    },
    onError: (err: unknown) => toast.error((err as Error).message),
  });

  const setMedicine = (index: number, patch: Partial<Medicine>) =>
    setForm((f) => ({
      ...f,
      medicines: f.medicines.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    }));

  const validate = () => {
    if (!form.diagnosis.trim()) {
      toast.error("Diagnosis is required.");
      return false;
    }
    if (!form.medicines.some((m) => m.name.trim())) {
      toast.error("Add at least one medicine.");
      return false;
    }
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
          <DialogTitle>{existing ? "Prescription" : "Create prescription"}</DialogTitle>
          <DialogDescription>
            {patientName} · {doctorName}
            {isPublished ? " · Published" : existing ? " · Draft" : ""}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[62vh]">
          <div className="space-y-4 px-6 py-5">
            {isLoading ? (
              <div className="h-40 animate-pulse rounded-xl bg-muted" />
            ) : (
              <>
                <Field label="Chief complaint">
                  <Textarea
                    rows={2}
                    value={form.chief_complaint}
                    onChange={(e) => setForm({ ...form, chief_complaint: e.target.value })}
                    placeholder="Presenting symptoms"
                  />
                </Field>
                <Field label="Diagnosis">
                  <Textarea
                    rows={2}
                    value={form.diagnosis}
                    onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
                    placeholder="Clinical diagnosis"
                  />
                </Field>

                <Separator />

                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Medicines</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 rounded-lg"
                    onClick={() =>
                      setForm((f) => ({ ...f, medicines: [...f.medicines, emptyMedicine()] }))
                    }
                  >
                    <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add medicine
                  </Button>
                </div>

                <div className="space-y-3">
                  {form.medicines.map((m, i) => (
                    <div key={i} className="rounded-xl border border-border bg-muted/30 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Medicine {i + 1}
                        </p>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          disabled={form.medicines.length === 1}
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              medicines: f.medicines.filter((_, idx) => idx !== i),
                            }))
                          }
                          aria-label={`Remove medicine ${i + 1}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <Input
                          value={m.name}
                          onChange={(e) => setMedicine(i, { name: e.target.value })}
                          placeholder="Medicine name"
                        />
                        <Input
                          value={m.dosage}
                          onChange={(e) => setMedicine(i, { dosage: e.target.value })}
                          placeholder="Dosage (e.g. 500 mg)"
                        />
                        <Input
                          value={m.frequency}
                          onChange={(e) => setMedicine(i, { frequency: e.target.value })}
                          placeholder="Frequency (e.g. 1-0-1)"
                        />
                        <Input
                          value={m.duration}
                          onChange={(e) => setMedicine(i, { duration: e.target.value })}
                          placeholder="Duration (e.g. 5 days)"
                        />
                        <Input
                          className="sm:col-span-2"
                          value={m.instructions}
                          onChange={(e) => setMedicine(i, { instructions: e.target.value })}
                          placeholder="Instructions (e.g. after food)"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                <Field label="Investigations">
                  <Textarea
                    rows={2}
                    value={form.investigations}
                    onChange={(e) => setForm({ ...form, investigations: e.target.value })}
                    placeholder="Tests to be done"
                  />
                </Field>
                <Field label="Advice">
                  <Textarea
                    rows={2}
                    value={form.advice}
                    onChange={(e) => setForm({ ...form, advice: e.target.value })}
                    placeholder="General advice"
                  />
                </Field>
                <Field label="Follow-up date">
                  <Input
                    type="date"
                    value={form.follow_up_date}
                    onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })}
                  />
                </Field>
                <Field label="Additional notes">
                  <Textarea
                    rows={2}
                    value={form.additional_notes}
                    onChange={(e) => setForm({ ...form, additional_notes: e.target.value })}
                  />
                </Field>
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 border-t border-border px-6 py-4">
          <Button
            variant="outline"
            className="h-11 rounded-xl"
            disabled={save.isPending}
            onClick={() => {
              if (!validate()) return;
              save.mutate("draft");
            }}
          >
            Save draft
          </Button>
          <Button
            className="h-11 rounded-xl"
            disabled={save.isPending}
            onClick={() => {
              if (!validate()) return;
              save.mutate("published");
            }}
          >
            {isPublished ? "Update published" : "Publish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
