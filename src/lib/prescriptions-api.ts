import { supabase } from "@/lib/supabase";

const db = supabase as any;

export type Medicine = {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
};

export type Prescription = {
  id: string;
  appointment_id: string;
  patient_id: string | null;
  doctor_id: string | null;
  chief_complaint: string | null;
  diagnosis: string | null;
  medicines: Medicine[];
  investigations: string | null;
  advice: string | null;
  follow_up_date: string | null;
  additional_notes: string | null;
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PrescriptionInput = {
  appointment_id: string;
  patient_id: string | null;
  doctor_id: string | null;
  chief_complaint: string;
  diagnosis: string;
  medicines: Medicine[];
  investigations: string;
  advice: string;
  follow_up_date: string | null;
  additional_notes: string;
  status: "draft" | "published";
};

const SELECT =
  "id, appointment_id, patient_id, doctor_id, chief_complaint, diagnosis, medicines, investigations, advice, follow_up_date, additional_notes, status, published_at, created_at, updated_at";

function normalize(row: any): Prescription {
  return {
    ...row,
    medicines: Array.isArray(row?.medicines) ? (row.medicines as Medicine[]) : [],
  } as Prescription;
}

export function emptyMedicine(): Medicine {
  return { name: "", dosage: "", frequency: "", duration: "", instructions: "" };
}

export async function fetchPrescriptionByAppointment(
  appointmentId: string,
): Promise<Prescription | null> {
  const { data, error } = await db
    .from("prescriptions")
    .select(SELECT)
    .eq("appointment_id", appointmentId)
    .maybeSingle();
  if (error) throw error;
  return data ? normalize(data) : null;
}

/** Appointment ids (from the given list) that have a published prescription. */
export async function fetchPublishedPrescriptionAppointmentIds(
  appointmentIds: string[],
): Promise<string[]> {
  if (appointmentIds.length === 0) return [];
  const { data, error } = await db
    .from("prescriptions")
    .select("appointment_id, status")
    .in("appointment_id", appointmentIds)
    .eq("status", "published");
  if (error) throw error;
  return ((data ?? []) as { appointment_id: string }[]).map((r) => r.appointment_id);
}

export async function savePrescription(input: PrescriptionInput): Promise<Prescription> {
  const payload = {
    ...input,
    medicines: input.medicines.filter((m) => m.name.trim().length > 0),
    published_at: input.status === "published" ? new Date().toISOString() : null,
  };
  const { data, error } = await db
    .from("prescriptions")
    .upsert(payload, { onConflict: "appointment_id" })
    .select(SELECT)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Prescription could not be saved.");
  return normalize(data);
}
