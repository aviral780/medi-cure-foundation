import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { openExternal } from "@/lib/open-external";

const CLINIC_MAPS_URL =
  "https://www.google.com/maps/place/Vardhman+Medicare+Centre/@28.4834234,77.0152622,17z/data=!3m1!4b1!4m6!3m5!1s0x390d3dd3aaaaaaab:0xe0fbcdc2c6a82c97!8m2!3d28.4834187!4d77.0178371!16s%2Fg%2F1tjgm_01?entry=ttu";

export function ClinicLocationCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4", className)}>
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden />
        Clinic Location
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Vardhman Medicare — get directions before your visit.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3 h-10 w-full rounded-lg"
        onClick={() => openExternal(CLINIC_MAPS_URL)}
      >
        <MapPin className="mr-1.5 h-4 w-4" aria-hidden /> Open in Google Maps
      </Button>
    </div>
  );
}

const NOTICES = [
  {
    icon: "⏰",
    title: "Appointment Timing",
    body: "Consultation timings may vary by approximately 15–30 minutes depending on ongoing consultations and clinical requirements. We appreciate your patience.",
  },
  {
    icon: "📋",
    title: "Consultation Charges",
    body: "Your consultation fee covers the doctor's consultation only. Any investigations such as X-rays, scans, laboratory tests, or additional procedures are charged separately based on the services required.",
  },
];

export function ImportantInformation({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Important Information
      </p>
      {NOTICES.map((n) => (
        <div key={n.title} className="rounded-xl border border-border/70 bg-muted/40 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <span aria-hidden>{n.icon}</span> {n.title}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{n.body}</p>
        </div>
      ))}
    </div>
  );
}
