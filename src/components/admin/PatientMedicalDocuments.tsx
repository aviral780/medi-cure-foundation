import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileText, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openExternalAsync } from "@/lib/open-external";
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
  const { data, isLoading } = useQuery({
    queryKey: ["medical-documents", appointmentId],
    queryFn: () => fetchMedicalDocuments(appointmentId),
    enabled,
  });
  const docs = data ?? [];

  const downloadDoc = async (doc: MedicalDocument) => {
    try {
      await openExternalAsync(() => getDocumentSignedUrl(doc, { download: true }));
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (isLoading) return <div className="h-12 animate-pulse rounded-lg bg-muted" />;
  if (docs.length === 0) {
    return <p className="text-sm text-muted-foreground">No medical documents uploaded.</p>;
  }

  return (
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
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label={`Download ${doc.file_name}`}
            onClick={() => void downloadDoc(doc)}
          >
            <Download className="h-4 w-4" aria-hidden />
          </Button>
        </li>
      ))}
    </ul>
  );
}
