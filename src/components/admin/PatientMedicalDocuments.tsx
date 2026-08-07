import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, ExternalLink, FileText, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentPreviewDialog } from "@/components/appointments/DocumentPreviewDialog";
import { openExternal } from "@/lib/open-external";
import {
  fetchMedicalDocuments,
  fileTypeLabel,
  getDocumentSignedUrl,
  humanFileSize,
  isImageDoc,
  type MedicalDocument,
} from "@/lib/medical-documents-api";

export function PatientMedicalDocuments({
  appointmentId,
  enabled,
}: {
  appointmentId: string;
  enabled: boolean;
}) {
  const [preview, setPreview] = useState<{ name: string; url: string | null } | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["medical-documents", appointmentId],
    queryFn: () => fetchMedicalDocuments(appointmentId),
    enabled,
  });
  const docs = data ?? [];

  const openDoc = async (doc: MedicalDocument) => {
    try {
      const url = await getDocumentSignedUrl(doc);
      if (isImageDoc(doc.file_type)) setPreview({ name: doc.file_name, url });
      else openExternal(url);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const downloadDoc = async (doc: MedicalDocument) => {
    try {
      const url = await getDocumentSignedUrl(doc, { download: true });
      openExternal(url);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (isLoading) return <div className="h-12 animate-pulse rounded-lg bg-muted" />;
  if (docs.length === 0) {
    return <p className="text-sm text-muted-foreground">No medical documents uploaded.</p>;
  }

  return (
    <>
      <ul className="space-y-2">
        {docs.map((doc) => (
          <li
            key={doc.id}
            className="flex items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-2"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
              {isImageDoc(doc.file_type) ? (
                <ImageIcon className="h-4 w-4" aria-hidden />
              ) : (
                <FileText className="h-4 w-4" aria-hidden />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">{doc.file_name}</p>
              <p className="text-[11px] text-muted-foreground">
                {fileTypeLabel(doc.file_type)} · {humanFileSize(Number(doc.file_size))} ·{" "}
                {new Date(doc.uploaded_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={`Open ${doc.file_name}`}
                onClick={() => void openDoc(doc)}
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={`Download ${doc.file_name}`}
                onClick={() => void downloadDoc(doc)}
              >
                <Download className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <DocumentPreviewDialog
        fileName={preview?.name ?? ""}
        url={preview?.url ?? null}
        open={!!preview}
        onOpenChange={(v) => !v && setPreview(null)}
      />
    </>
  );
}
