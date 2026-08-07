import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, ImageIcon, Loader2, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { DocumentPreviewDialog } from "@/components/appointments/DocumentPreviewDialog";
import { openExternalAsync } from "@/lib/open-external";
import {
  ACCEPT_ATTR,
  deleteMedicalDocument,
  fetchMedicalDocuments,
  fileTypeLabel,
  getDocumentSignedUrl,
  humanFileSize,
  isImageDoc,
  uploadMedicalDocument,
  validateDocumentFile,
  type MedicalDocument,
} from "@/lib/medical-documents-api";

export function MedicalDocumentsCard({
  appointmentId,
  canUpload = true,
  className,
}: {
  appointmentId: string;
  canUpload?: boolean;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [preview, setPreview] = useState<{ name: string; url: string | null } | null>(null);

  const queryKey = ["medical-documents", appointmentId];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchMedicalDocuments(appointmentId),
  });
  const docs = data ?? [];

  const removeMutation = useMutation({
    mutationFn: (doc: MedicalDocument) => deleteMedicalDocument(doc),
    onSuccess: (_r, doc) => {
      queryClient.setQueryData<MedicalDocument[]>(queryKey, (prev) =>
        (prev ?? []).filter((d) => d.id !== doc.id),
      );
      toast.success("Document removed");
    },
    onError: (err) => toast.error((err as Error).message || "Could not remove the document."),
  });

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    const valid: File[] = [];
    for (const file of list) {
      const problem = validateDocumentFile(file);
      if (problem) toast.error(problem);
      else valid.push(file);
    }
    if (valid.length === 0) return;

    setProgress({ done: 0, total: valid.length });
    let uploaded = 0;
    for (const file of valid) {
      try {
        const doc = await uploadMedicalDocument({ appointmentId, file });
        queryClient.setQueryData<MedicalDocument[]>(queryKey, (prev) => [doc, ...(prev ?? [])]);
        uploaded += 1;
      } catch (err) {
        toast.error(`${file.name}: ${(err as Error).message}`);
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }
    setProgress(null);
    if (uploaded > 0) {
      toast.success(uploaded === 1 ? "Document uploaded" : `${uploaded} documents uploaded`);
    }
  };

  const openDoc = async (doc: MedicalDocument) => {
    if (isImageDoc(doc.file_type)) {
      setPreview({ name: doc.file_name, url: null });
      try {
        const url = await getDocumentSignedUrl(doc);
        setPreview({ name: doc.file_name, url });
      } catch (err) {
        setPreview(null);
        toast.error((err as Error).message);
      }
      return;
    }
    try {
      await openExternalAsync(() => getDocumentSignedUrl(doc));
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const uploading = progress !== null;

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4", className)}>
      <p className="text-sm font-semibold text-foreground">Medical Documents</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Upload any previous medical records that may help the doctor during your consultation.
      </p>

      {canUpload && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => !uploading && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!uploading) inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            "mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-center transition-colors hover:border-primary/50",
            dragging && "border-primary bg-primary/5",
            uploading && "pointer-events-none opacity-70",
          )}
        >
          <UploadCloud className="h-5 w-5 text-muted-foreground" aria-hidden />
          <p className="mt-1.5 text-xs font-medium text-foreground">
            Tap to upload or drag files here
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            PDF, JPG, PNG or WEBP · up to 10 MB each
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT_ATTR}
            className="hidden"
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {uploading && progress && (
        <div className="mt-3">
          <Progress value={(progress.done / progress.total) * 100} className="h-1.5" />
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Uploading {progress.done + (progress.done < progress.total ? 1 : 0)} of {progress.total}…
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="mt-3 h-12 animate-pulse rounded-xl bg-muted" />
      ) : docs.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">No medical documents uploaded.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-2"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                {isImageDoc(doc.file_type) ? (
                  <ImageIcon className="h-4 w-4" aria-hidden />
                ) : (
                  <FileText className="h-4 w-4" aria-hidden />
                )}
              </span>
              <button
                type="button"
                onClick={() => void openDoc(doc)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-xs font-medium text-foreground">{doc.file_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {fileTypeLabel(doc.file_type)} · {humanFileSize(Number(doc.file_size))} ·{" "}
                  {new Date(doc.uploaded_at).toLocaleDateString()}
                </p>
              </button>
              {canUpload && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${doc.file_name}`}
                  disabled={removeMutation.isPending}
                  onClick={() => removeMutation.mutate(doc)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <DocumentPreviewDialog
        fileName={preview?.name ?? ""}
        url={preview?.url ?? null}
        open={!!preview}
        onOpenChange={(v) => !v && setPreview(null)}
      />
    </div>
  );
}
