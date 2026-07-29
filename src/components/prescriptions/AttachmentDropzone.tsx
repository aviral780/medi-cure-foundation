import { useRef, useState } from "react";
import { FileText, ImageIcon, Loader2, Sparkles, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type LocalAttachment = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  dataUrl: string;
};

const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
const MAX_BYTES = 8 * 1024 * 1024;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentDropzone({
  attachments,
  onAdd,
  onRemove,
  onExtract,
  extractingId,
  disabled,
  onError,
}: {
  attachments: LocalAttachment[];
  onAdd: (items: LocalAttachment[]) => void;
  onRemove: (id: string) => void;
  onExtract: (item: LocalAttachment) => void;
  extractingId: string | null;
  disabled?: boolean;
  onError: (message: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const accepted: LocalAttachment[] = [];
    for (const file of Array.from(files)) {
      if (!ACCEPTED.includes(file.type)) {
        onError(`${file.name}: only JPG, PNG or PDF files are supported.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        onError(`${file.name}: file is larger than 8 MB.`);
        continue;
      }
      try {
        accepted.push({
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          size: file.size,
          mimeType: file.type,
          dataUrl: await readAsDataUrl(file),
        });
      } catch (err) {
        onError((err as Error).message);
      }
    }
    if (accepted.length > 0) onAdd(accepted);
  };

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload prescription images or reports"
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/20 px-6 py-8 text-center transition-all duration-200",
          "hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          dragging && "scale-[1.01] border-primary bg-primary/10",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <UploadCloud className="h-7 w-7 text-primary" aria-hidden />
        <p className="mt-2 text-sm font-medium text-foreground">
          Drag &amp; drop scans, handwritten notes or reports
        </p>
        <p className="mt-1 text-xs text-muted-foreground">JPG, PNG or PDF · up to 8 MB each</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No files attached yet. Uploads stay in this session and are used to auto-fill the form.
        </p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((a) => {
            const isImage = a.mimeType.startsWith("image/");
            const busy = extractingId === a.id;
            return (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5 animate-fade-in"
              >
                {isImage ? (
                  <img
                    src={a.dataUrl}
                    alt={a.name}
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <FileText className="h-5 w-5 text-muted-foreground" aria-hidden />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{a.name}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      {isImage ? (
                        <ImageIcon className="h-3 w-3" aria-hidden />
                      ) : (
                        <FileText className="h-3 w-3" aria-hidden />
                      )}
                      {humanSize(a.size)}
                    </span>
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-lg"
                  disabled={busy || disabled}
                  onClick={() => onExtract(a)}
                >
                  {busy ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="mr-1.5 h-4 w-4" aria-hidden />
                  )}
                  {busy ? "Reading…" : "Extract"}
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 text-destructive hover:bg-destructive/10"
                  aria-label={`Remove ${a.name}`}
                  onClick={() => onRemove(a.id)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
