import { toast } from "sonner";
import { Copy, ExternalLink, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function statusTone(status: string | null): { label: string; className: string } {
  const s = (status ?? "").toLowerCase();
  if (s === "created" || s === "scheduled" || s === "active")
    return {
      label: "Meeting created",
      className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    };
  if (s === "cancelled" || s === "canceled")
    return {
      label: "Meeting cancelled",
      className: "border-destructive/25 bg-destructive/10 text-destructive",
    };
  if (!s)
    return {
      label: "Not created yet",
      className: "border-border bg-muted text-muted-foreground",
    };
  return {
    label: s.charAt(0).toUpperCase() + s.slice(1),
    className: "border-primary/25 bg-primary/10 text-primary",
  };
}

export function GoogleMeetCard({
  meetingUrl,
  meetingStatus,
  meetingTime,
  className,
}: {
  meetingUrl: string | null;
  meetingStatus?: string | null;
  meetingTime?: string | null;
  className?: string;
}) {
  const tone = statusTone(meetingStatus ?? (meetingUrl ? "created" : null));

  const copy = async () => {
    if (!meetingUrl) return;
    try {
      await navigator.clipboard.writeText(meetingUrl);
      toast.success("Meeting link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  return (
    <section
      className={cn(
        "rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <Video className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-foreground">Google Meet</p>
            <p className="text-xs text-muted-foreground">
              {meetingTime ?? "Video consultation"}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-medium",
            tone.className,
          )}
        >
          {tone.label}
        </span>
      </div>

      {meetingUrl ? (
        <>
          <p className="mt-3 break-all rounded-xl bg-muted/50 px-3 py-2 font-mono text-[11px] text-muted-foreground">
            {meetingUrl}
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button asChild className="h-10 rounded-xl">
              <a
                href={meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="mr-1.5 h-4 w-4" aria-hidden /> Join meeting
              </a>
            </Button>
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                void copy();
              }}
            >
              <Copy className="mr-1.5 h-4 w-4" aria-hidden /> Copy link
            </Button>
          </div>
        </>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          The meeting link appears here once the consultation is confirmed.
        </p>
      )}
    </section>
  );
}