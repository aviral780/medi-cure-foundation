import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity,
  CalendarClock,
  ClipboardList,
  FlaskConical,
  Lightbulb,
  Loader2,
  Paperclip,
  Pill,
  Plus,
  QrCode,
  Stethoscope,
  Trash2,
  User,
} from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  emptyMedicine,
  fetchPrescriptionByAppointment,
  savePrescription,
  type Medicine,
} from "@/lib/prescriptions-api";
import { usePrescriptionContext } from "@/lib/prescription-context";
import { extractPrescriptionFromFile } from "@/lib/prescription-ocr.functions";
import { formatFullDate } from "@/lib/booking-queries";
import {
  AttachmentDropzone,
  type LocalAttachment,
} from "@/components/prescriptions/AttachmentDropzone";
import { cn } from "@/lib/utils";

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
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [extractingId, setExtractingId] = useState<string | null>(null);

  const { context, isLoading: contextLoading } = usePrescriptionContext(appointmentId, open);

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

  useEffect(() => {
    if (!open) {
      setAttachments([]);
      setExtractingId(null);
    }
  }, [open]);

  const isPublished = existing?.status === "published";
  const resolvedPatientName = context.patient?.full_name || patientName;
  const resolvedDoctorName = context.doctor.name || doctorName;

  const save = useMutation({
    mutationFn: (status: "draft" | "published") =>
      savePrescription({
        appointment_id: appointmentId,
        patient_id: patientId ?? context.patientId,
        doctor_id: doctorId ?? context.doctorId,
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

  const runExtraction = async (item: LocalAttachment) => {
    setExtractingId(item.id);
    try {
      const result = await extractPrescriptionFromFile({
        data: { fileName: item.name, mimeType: item.mimeType, dataUrl: item.dataUrl },
      });
      setForm((f) => {
        const existingMeds = f.medicines.filter((m) => m.name.trim());
        const merged = [
          ...existingMeds,
          ...result.medicines.map((m) => ({ ...emptyMedicine(), ...m })),
        ];
        return {
          ...f,
          chief_complaint: f.chief_complaint.trim() || result.chief_complaint,
          diagnosis: f.diagnosis.trim() || result.diagnosis,
          investigations: f.investigations.trim() || result.investigations,
          advice: f.advice.trim() || result.advice,
          medicines: merged.length > 0 ? merged : [emptyMedicine()],
        };
      });
      const found =
        result.medicines.length +
        [result.diagnosis, result.advice, result.investigations, result.chief_complaint].filter(
          Boolean,
        ).length;
      toast.success(
        found > 0
          ? "Details extracted — please review before saving."
          : "No readable details found in that file.",
      );
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setExtractingId(null);
    }
  };

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

  const busy = isLoading || contextLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-full overflow-hidden p-0 sm:max-w-3xl">
        {/* Letterhead */}
        <DialogHeader className="space-y-0 border-b border-border bg-gradient-to-br from-primary/10 via-card to-card px-6 pb-5 pt-6 text-left">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                {context.clinic.name}
              </p>
              <DialogTitle className="mt-1 text-xl font-semibold tracking-tight">
                E-Prescription
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs">
                {resolvedDoctorName} · {context.doctor.qualifications} ·{" "}
                {context.doctor.specialization}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-3">
              <StatusPill
                tone={isPublished ? "success" : existing ? "warn" : "muted"}
                label={isPublished ? "Published" : existing ? "Draft" : "New"}
              />
              {/* Reserved: QR / digital signature slot */}
              <div
                aria-hidden
                className="hidden h-14 w-14 items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground/50 sm:flex"
              >
                <QrCode className="h-6 w-6" />
              </div>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[62vh]">
          <div className="space-y-5 px-6 py-5">
            {busy ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-40 w-full rounded-2xl" />
                <Skeleton className="h-28 w-full rounded-2xl" />
              </div>
            ) : (
              <>
                {/* Patient information (read-only, auto-filled) */}
                <SectionCard
                  icon={User}
                  title="Patient information"
                  subtitle="Auto-filled from the appointment record"
                >
                  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
                    <ReadOnly label="Patient" value={resolvedPatientName} />
                    <ReadOnly label="Age" value={context.patientAge} />
                    <ReadOnly label="Gender" value={context.patientGender} />
                    <ReadOnly label="Phone" value={context.patientPhone} />
                    <ReadOnly
                      label="Appointment date"
                      value={
                        context.appointmentDate ? formatFullDate(context.appointmentDate) : "—"
                      }
                    />
                    <ReadOnly label="Consultation" value={context.consultationType} />
                    <ReadOnly label="Doctor" value={resolvedDoctorName} />
                    <ReadOnly label="Specialization" value={context.doctor.specialization} />
                    <ReadOnly
                      label="Prescription date"
                      value={new Date().toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    />
                  </dl>
                </SectionCard>

                {/* Attachments + OCR */}
                <SectionCard
                  icon={Paperclip}
                  title="Attachments"
                  subtitle="Upload a scan and let AI pre-fill the clinical fields — always review before saving"
                >
                  <AttachmentDropzone
                    attachments={attachments}
                    onAdd={(items) => setAttachments((prev) => [...prev, ...items])}
                    onRemove={(id) => setAttachments((prev) => prev.filter((a) => a.id !== id))}
                    onExtract={(item) => void runExtraction(item)}
                    extractingId={extractingId}
                    onError={(m) => toast.error(m)}
                  />
                </SectionCard>

                {/* Clinical notes */}
                <SectionCard icon={Stethoscope} title="Clinical notes">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Chief complaint" icon={Activity}>
                      <Textarea
                        rows={3}
                        value={form.chief_complaint}
                        onChange={(e) => setForm({ ...form, chief_complaint: e.target.value })}
                        placeholder="Presenting symptoms, duration, severity"
                      />
                    </Field>
                    <Field label="Diagnosis" icon={ClipboardList} required>
                      <Textarea
                        rows={3}
                        value={form.diagnosis}
                        onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
                        placeholder="Clinical diagnosis"
                      />
                    </Field>
                  </div>
                </SectionCard>

                {/* Medicines */}
                <SectionCard
                  icon={Pill}
                  title="Medicines"
                  subtitle={`${form.medicines.filter((m) => m.name.trim()).length} prescribed`}
                  action={
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
                  }
                >
                  <div className="space-y-3">
                    {form.medicines.map((m, i) => (
                      <div
                        key={i}
                        className="animate-fade-in rounded-2xl border border-border bg-muted/20 p-3.5 transition-colors hover:border-primary/40"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {i + 1}
                          </span>
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
                        <div className="mt-2 grid gap-2.5 sm:grid-cols-12">
                          <MedField className="sm:col-span-5" label="Medicine">
                            <Input
                              value={m.name}
                              onChange={(e) => setMedicine(i, { name: e.target.value })}
                              placeholder="e.g. Amoxicillin"
                            />
                          </MedField>
                          <MedField className="sm:col-span-3" label="Dosage">
                            <Input
                              value={m.dosage}
                              onChange={(e) => setMedicine(i, { dosage: e.target.value })}
                              placeholder="500 mg"
                            />
                          </MedField>
                          <MedField className="sm:col-span-2" label="Frequency">
                            <Input
                              value={m.frequency}
                              onChange={(e) => setMedicine(i, { frequency: e.target.value })}
                              placeholder="1-0-1"
                            />
                          </MedField>
                          <MedField className="sm:col-span-2" label="Duration">
                            <Input
                              value={m.duration}
                              onChange={(e) => setMedicine(i, { duration: e.target.value })}
                              placeholder="5 days"
                            />
                          </MedField>
                          <MedField className="sm:col-span-12" label="Instructions">
                            <Input
                              value={m.instructions}
                              onChange={(e) => setMedicine(i, { instructions: e.target.value })}
                              placeholder="e.g. After food, with plenty of water"
                            />
                          </MedField>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                {/* Investigations & advice */}
                <SectionCard icon={FlaskConical} title="Investigations">
                  <Textarea
                    rows={2}
                    value={form.investigations}
                    onChange={(e) => setForm({ ...form, investigations: e.target.value })}
                    placeholder="Tests to be done (CBC, LFT, X-ray chest…)"
                  />
                </SectionCard>

                <SectionCard icon={Lightbulb} title="Advice">
                  <Textarea
                    rows={2}
                    value={form.advice}
                    onChange={(e) => setForm({ ...form, advice: e.target.value })}
                    placeholder="Diet, rest, lifestyle guidance"
                  />
                </SectionCard>

                {/* Follow-up */}
                <SectionCard icon={CalendarClock} title="Follow-up">
                  <div className="grid gap-4 sm:grid-cols-2">
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
                        placeholder="Anything else the patient should know"
                      />
                    </Field>
                  </div>
                </SectionCard>
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 border-t border-border bg-muted/20 px-6 py-4 sm:justify-between">
          <p className="hidden text-xs text-muted-foreground sm:block">
            Reviewed and issued by {resolvedDoctorName}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-11 rounded-xl"
              disabled={save.isPending || busy}
              onClick={() => {
                if (!validate()) return;
                save.mutate("draft");
              }}
            >
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              Save draft
            </Button>
            <Button
              className="h-11 rounded-xl"
              disabled={save.isPending || busy}
              onClick={() => {
                if (!validate()) return;
                save.mutate("published");
              }}
            >
              {isPublished ? "Update published" : "Publish"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  action,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="animate-fade-in rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-foreground">{value || "—"}</dd>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  required,
  children,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

function MedField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function StatusPill({ tone, label }: { tone: "success" | "warn" | "muted"; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        tone === "success" && "bg-primary/15 text-primary",
        tone === "warn" && "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
        tone === "muted" && "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}
