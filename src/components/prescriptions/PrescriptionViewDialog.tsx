import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  ClipboardList,
  Download,
  FileWarning,
  FlaskConical,
  Lightbulb,
  Pill,
  QrCode,
  Stethoscope,
  User,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { fetchPrescriptionByAppointment } from "@/lib/prescriptions-api";
import { formatFullDate } from "@/lib/booking-queries";
import { usePrescriptionContext } from "@/lib/prescription-context";
import { downloadPrescriptionPdf } from "@/lib/prescription-pdf";
import { cn } from "@/lib/utils";

export function PrescriptionViewDialog({
  appointmentId,
  doctorName,
  open,
  onOpenChange,
}: {
  appointmentId: string;
  doctorName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["prescription", appointmentId],
    queryFn: () => fetchPrescriptionByAppointment(appointmentId),
    enabled: open && Boolean(appointmentId),
  });

  const { context } = usePrescriptionContext(appointmentId, open);
  const doctor = context.doctor.name || doctorName || "Your doctor";
  const isPublished = data?.status === "published";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-full overflow-hidden p-0 sm:max-w-xl">
        {/* Letterhead */}
        <DialogHeader className="space-y-0 border-b border-border bg-gradient-to-br from-primary/10 via-card to-card px-6 pb-5 pt-6 text-left">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                {context.clinic.name}
              </p>
              <DialogTitle className="mt-1 text-xl font-semibold tracking-tight">
                Prescription
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs">
                {data?.published_at
                  ? `Issued ${new Date(data.published_at).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}`
                  : "Medical record"}
              </DialogDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                  isPublished
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {isPublished ? "Published" : data ? "Draft" : "—"}
              </span>
              {/* Reserved: QR code / digital signature */}
              <div
                aria-hidden
                className="hidden h-14 w-14 items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground/50 sm:flex"
              >
                <QrCode className="h-6 w-6" />
              </div>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-4 px-6 py-5">
            {isLoading && (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-32 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {(error as Error).message}
              </div>
            )}

            {!isLoading && !error && !data && (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-12 text-center">
                <FileWarning className="h-8 w-8 text-muted-foreground" aria-hidden />
                <p className="mt-3 text-sm font-medium text-foreground">
                  No prescription available yet
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your doctor will publish it here once the consultation notes are complete.
                </p>
              </div>
            )}

            {data && (
              <>
                {/* Download */}
                <Button
                  variant="outline"
                  className="h-11 w-full rounded-xl border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                  onClick={() =>
                    downloadPrescriptionPdf({
                      prescription: data,
                      doctorName: doctor,
                      doctorQualifications: context.doctor.qualifications,
                      doctorSpecialization: context.doctor.specialization,
                      patientName: context.patientName,
                      patientAge: context.patientAge,
                      patientGender: context.patientGender,
                      patientPhone: context.patientPhone,
                      appointmentDate: context.appointmentDate,
                      consultationType: context.consultationType,
                      appointmentId,
                    })
                  }
                >
                  <Download className="mr-2 h-4 w-4" aria-hidden /> Download PDF
                </Button>

                {/* Doctor profile */}
                <Card>
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Stethoscope className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{doctor}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[context.doctor.qualifications, context.doctor.specialization]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Patient summary */}
                <Card icon={User} title="Patient summary">
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                    <Meta label="Patient" value={context.patientName} />
                    <Meta label="Age" value={context.patientAge} />
                    <Meta label="Gender" value={context.patientGender} />
                    <Meta label="Consultation" value={context.consultationType} />
                    <Meta
                      label="Appointment"
                      value={
                        context.appointmentDate ? formatFullDate(context.appointmentDate) : "—"
                      }
                    />
                    <Meta
                      label="Created"
                      value={new Date(data.created_at).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    />
                  </dl>
                </Card>

                <Card icon={ClipboardList} title="Diagnosis">
                  <Body value={data.diagnosis} />
                  {data.chief_complaint?.trim() && (
                    <div className="mt-3 rounded-xl bg-muted/40 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Chief complaint
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm text-foreground">
                        {data.chief_complaint}
                      </p>
                    </div>
                  )}
                </Card>

                {/* Medicines */}
                <Card icon={Pill} title="Medicines">
                  {data.medicines.length === 0 ? (
                    <Empty text="No medicines prescribed." />
                  ) : (
                    <ul className="space-y-2.5">
                      {data.medicines.map((m, i) => (
                        <li
                          key={i}
                          className="animate-fade-in rounded-2xl border border-border bg-muted/20 p-3.5"
                        >
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                              {i + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground">{m.name}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {[m.dosage, m.frequency, m.duration].filter(Boolean).join(" · ") ||
                                  "—"}
                              </p>
                              {m.instructions && (
                                <p className="mt-1.5 rounded-lg bg-card px-2.5 py-1.5 text-xs text-muted-foreground">
                                  {m.instructions}
                                </p>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card icon={FlaskConical} title="Tests & investigations">
                  <Body value={data.investigations} />
                </Card>

                <Card icon={Lightbulb} title="Advice">
                  <Body value={data.advice} />
                </Card>

                <Card icon={CalendarClock} title="Follow-up">
                  <Body
                    value={data.follow_up_date ? formatFullDate(data.follow_up_date) : null}
                  />
                  {data.additional_notes?.trim() && (
                    <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">
                      {data.additional_notes}
                    </p>
                  )}
                </Card>

                {/* Reserved footer: signature / QR / PDF actions */}
                <div className="flex items-end justify-between gap-4 rounded-2xl border border-dashed border-border px-4 py-4">
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Digitally issued record · {context.clinic.name}
                  </p>
                  <div className="text-right">
                    <div className="h-8 w-32 border-b border-border" aria-hidden />
                    <p className="mt-1 text-[11px] text-muted-foreground">{doctor}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function Card({
  icon: Icon,
  title,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="animate-fade-in rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
      {title && (
        <div className="mb-3 flex items-center gap-2.5">
          {Icon && (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </span>
          )}
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        </div>
      )}
      {children}
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-foreground">{value || "—"}</dd>
    </div>
  );
}

function Body({ value }: { value: string | null }) {
  if (!value?.trim()) return <Empty text="Not specified." />;
  return <p className="whitespace-pre-line text-sm text-foreground">{value}</p>;
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}
