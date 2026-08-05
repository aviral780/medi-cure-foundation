import { supabase } from "@/lib/supabase";

const db = supabase as any;

export const MEDICAL_DOCS_BUCKET = "medical-documents";

export const ACCEPTED_DOC_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export const ACCEPT_ATTR = ".pdf,.jpg,.jpeg,.png,.webp";
export const MAX_DOC_BYTES = 10 * 1024 * 1024;

export type MedicalDocument = {
  id: string;
  appointment_id: string;
  patient_id: string;
  file_name: string;
  storage_path: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
};

const SELECT =
  "id, appointment_id, patient_id, file_name, storage_path, file_type, file_size, uploaded_at";

export function isImageDoc(fileType: string): boolean {
  return (fileType ?? "").startsWith("image/");
}

export function humanFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileTypeLabel(fileType: string): string {
  if (fileType === "application/pdf") return "PDF";
  const sub = (fileType ?? "").split("/")[1] ?? fileType;
  return String(sub).toUpperCase();
}

/** Client-side guard mirroring the storage policies. */
export function validateDocumentFile(file: File): string | null {
  const type = (file.type || "").toLowerCase();
  if (!(ACCEPTED_DOC_TYPES as readonly string[]).includes(type)) {
    return `${file.name}: only PDF, JPG, PNG or WEBP files are supported.`;
  }
  if (file.size > MAX_DOC_BYTES) {
    return `${file.name}: file is larger than 10 MB.`;
  }
  return null;
}

export async function fetchMedicalDocuments(
  appointmentId: string,
): Promise<MedicalDocument[]> {
  const { data, error } = await db
    .from("medical_documents")
    .select(SELECT)
    .eq("appointment_id", appointmentId)
    .order("uploaded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MedicalDocument[];
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

export async function uploadMedicalDocument(input: {
  appointmentId: string;
  file: File;
}): Promise<MedicalDocument> {
  const invalid = validateDocumentFile(input.file);
  if (invalid) throw new Error(invalid);

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (userError || !userId) throw new Error("Please sign in again to upload documents.");

  const path = `${userId}/${input.appointmentId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}-${safeName(input.file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(MEDICAL_DOCS_BUCKET)
    .upload(path, input.file, { contentType: input.file.type, upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await db
    .from("medical_documents")
    .insert({
      appointment_id: input.appointmentId,
      patient_id: userId,
      file_name: input.file.name,
      storage_path: path,
      file_type: input.file.type,
      file_size: input.file.size,
    })
    .select(SELECT)
    .maybeSingle();

  if (error || !data) {
    await supabase.storage.from(MEDICAL_DOCS_BUCKET).remove([path]);
    throw new Error(error?.message ?? "Could not save the document.");
  }
  return data as MedicalDocument;
}

export async function deleteMedicalDocument(doc: MedicalDocument): Promise<void> {
  const { error } = await db.from("medical_documents").delete().eq("id", doc.id);
  if (error) throw error;
  await supabase.storage.from(MEDICAL_DOCS_BUCKET).remove([doc.storage_path]);
}

/** Short-lived signed URL — storage paths are never exposed as public URLs. */
export async function getDocumentSignedUrl(
  doc: MedicalDocument,
  options?: { download?: boolean },
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(MEDICAL_DOCS_BUCKET)
    .createSignedUrl(
      doc.storage_path,
      60 * 5,
      options?.download ? { download: doc.file_name } : undefined,
    );
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Could not open this document.");
  }
  return data.signedUrl;
}
