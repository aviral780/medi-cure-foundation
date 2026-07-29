import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { fetchPrescriptionByAppointment } from "@/lib/prescriptions-api";
import { formatFullDate } from "@/lib/booking-queries";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
          <DialogTitle>Prescription</DialogTitle>
          <DialogDescription>
            {doctorName ? `${doctorName} · ` : ""}
            {data?.published_at ? new Date(data.published_at).toLocaleDateString() : ""}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-4 px-6 py-5 text-sm">
            {isLoading && <div className="h-40 animate-pulse rounded-xl bg-muted" />}
            {error && (
              <p className="text-destructive">{(error as Error).message}</p>
            )}
            {!isLoading && !error && !data && (
              <p className="text-muted-foreground">No prescription available yet.</p>
            )}
            {data && (
              <>
                <Block label="Chief complaint" value={data.chief_complaint} />
                <Block label="Diagnosis" value={data.diagnosis} />
                <Separator />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Medicines
                  </p>
                  {data.medicines.length === 0 ? (
                    <p className="mt-1 text-muted-foreground">—</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {data.medicines.map((m, i) => (
                        <li key={i} className="rounded-xl border border-border bg-muted/30 p-3">
                          <p className="font-medium text-foreground">{m.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {[m.dosage, m.frequency, m.duration].filter(Boolean).join(" · ") || "—"}
                          </p>
                          {m.instructions && (
                            <p className="mt-1 text-xs text-muted-foreground">{m.instructions}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <Separator />
                <Block label="Investigations" value={data.investigations} />
                <Block label="Advice" value={data.advice} />
                <Block
                  label="Follow-up"
                  value={data.follow_up_date ? formatFullDate(data.follow_up_date) : null}
                />
                <Block label="Additional notes" value={data.additional_notes} />
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function Block({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-line text-foreground">{value?.trim() ? value : "—"}</p>
    </div>
  );
}
