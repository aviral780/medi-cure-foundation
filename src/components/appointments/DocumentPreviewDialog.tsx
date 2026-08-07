import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function DocumentPreviewDialog({
  fileName,
  url,
  open,
  onOpenChange,
}: {
  fileName: string;
  url: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border-border/40 bg-background/95 backdrop-blur">
        <DialogHeader>
          <DialogTitle className="truncate text-base">{fileName}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[75vh] overflow-auto rounded-xl bg-foreground/90 p-2">
          {url ? (
            <img
              src={url}
              alt={fileName}
              className="mx-auto h-auto w-auto max-w-full rounded-lg object-contain"
            />
          ) : (
            <div className="h-64 animate-pulse rounded-lg bg-muted" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
