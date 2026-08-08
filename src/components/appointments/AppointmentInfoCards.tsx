import { useState } from "react";
import { MapPin, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CLINIC_NAME = "Vardhman Medicare Centre";
const CLINIC_ADDRESS = "239, Sector 5, Gurugram (122001)";
const CLINIC_MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=Vardhman+Medicare+Centre+Sector+56+Gurugram";

export function ClinicLocationCard({ className }: { className?: string }) {
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(CLINIC_ADDRESS);
      setCopied(true);
      toast.success("Address copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy address");
    }
  };

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4", className)}>
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden />
        Clinic Location
      </div>
      <div className="mt-2">
        <p className="text-sm font-semibold text-foreground">{CLINIC_NAME}</p>
        <p className="text-xs text-muted-foreground">{CLINIC_ADDRESS}</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-10 w-full rounded-lg"
          onClick={copyAddress}
        >
          {copied ? (
            <Check className="mr-1.5 h-4 w-4" aria-hidden />
          ) : (
            <Copy className="mr-1.5 h-4 w-4" aria-hidden />
          )}
          {copied ? "Copied" : "Copy Address"}
        </Button>
        <Button asChild variant="outline" size="sm" className="h-10 w-full rounded-lg">
          <a href={CLINIC_MAPS_URL} target="_blank" rel="noopener noreferrer">
            <MapPin className="mr-1.5 h-4 w-4" aria-hidden /> Get Directions
          </a>
        </Button>
      </div>
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
