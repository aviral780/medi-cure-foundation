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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="truncate text-base">{fileName}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-auto rounded-xl bg-muted/40 p-2">
          {url ? (
            <img src={url} alt={fileName} className="mx-auto max-h-[65vh] w-auto rounded-lg object-contain" />
          ) : (
            <div className="h-64 animate-pulse rounded-lg bg-muted" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
