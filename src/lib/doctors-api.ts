import { supabase } from "@/lib/supabase";
import type { Doctor } from "@/lib/booking-queries";

const db = supabase as any;

const DOCTOR_COLUMNS =
  "id, profile_id, full_name, specialization, qualifications, experience_years, bio, profile_image_url, is_active";

export type DoctorInput = {
  full_name: string;
  specialization: string;
  qualifications: string | null;
  experience_years: number | null;
  bio: string | null;
  is_active: boolean;
};

export async function fetchAllDoctors(): Promise<Doctor[]> {
  const { data, error } = await db
    .from("doctors")
    .select(DOCTOR_COLUMNS)
    .order("full_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Doctor[];
}

export async function createDoctor(input: DoctorInput): Promise<Doctor> {
  const { data, error } = await db.from("doctors").insert(input).select(DOCTOR_COLUMNS).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Doctor could not be created. You may not have permission.");
  return data as Doctor;
}

export async function updateDoctor(id: string, input: Partial<DoctorInput>): Promise<Doctor> {
  const { data, error } = await db
    .from("doctors")
    .update(input)
    .eq("id", id)
    .select(DOCTOR_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Doctor was not updated. You may not have permission to edit doctors.");
  return data as Doctor;
}

export async function countDoctorAppointments(id: string): Promise<number> {
  const { count, error } = await db
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("doctor_id", id);
  if (error) return 0;
  return count ?? 0;
}

/**
 * Deletes a doctor. When the doctor already has appointments the record is
 * deactivated instead so historical data stays intact.
 */
export async function deleteDoctor(id: string): Promise<"deleted" | "deactivated"> {
  const used = await countDoctorAppointments(id);
  if (used > 0) {
    await updateDoctor(id, { is_active: false });
    return "deactivated";
  }
  const { data, error } = await db.from("doctors").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Doctor was not deleted. You may not have permission to delete doctors.");
  }
  return "deleted";
}