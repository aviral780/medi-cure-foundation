import { supabase } from "@/lib/supabase";

export type Doctor = {
  id: string;
  profile_id: string | null;
  full_name: string;
  specialization: string;
  qualifications: string | null;
  experience_years: number | null;
  bio: string | null;
  profile_image_url: string | null;
  is_active: boolean;
};

export type ConsultationType = {
  id: string;
  doctor_id: string;
  name: string;
  mode: string;
  duration_minutes: number;
  fee: number;
  currency: string;
  is_active: boolean;
};

export type AvailabilitySlot = {
  id: string;
  doctor_id: string;
  consultation_type_id: string;
  slot_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS
  end_time: string;
  status: string;
};

const db = supabase as any;

function todayISODate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function fetchActiveDoctors(): Promise<Doctor[]> {
  const { data, error } = await db
    .from("doctors")
    .select("id, profile_id, full_name, specialization, qualifications, experience_years, bio, profile_image_url, is_active")
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Doctor[];
}

export async function fetchDoctorById(doctorId: string): Promise<Doctor | null> {
  const { data, error } = await db
    .from("doctors")
    .select("id, profile_id, full_name, specialization, qualifications, experience_years, bio, profile_image_url, is_active")
    .eq("id", doctorId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as Doctor | null;
}

export async function fetchConsultationTypes(doctorId: string): Promise<ConsultationType[]> {
  const { data, error } = await db
    .from("consultation_types")
    .select("id, doctor_id, name, mode, duration_minutes, fee, currency, is_active")
    .eq("doctor_id", doctorId)
    .eq("is_active", true)
    .order("fee", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ConsultationType[];
}

export async function fetchConsultationTypeById(id: string): Promise<ConsultationType | null> {
  const { data, error } = await db
    .from("consultation_types")
    .select("id, doctor_id, name, mode, duration_minutes, fee, currency, is_active")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as ConsultationType | null;
}

export async function fetchAvailableSlots(
  doctorId: string,
  consultationTypeId: string,
): Promise<AvailabilitySlot[]> {
  const { data, error } = await db
    .from("availability_slots")
    .select("id, doctor_id, consultation_type_id, slot_date, start_time, end_time, status")
    .eq("doctor_id", doctorId)
    .eq("consultation_type_id", consultationTypeId)
    .gte("slot_date", todayISODate())
    .order("slot_date", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AvailabilitySlot[];
}

export async function fetchAllSlots(
  doctorId: string,
  consultationTypeId: string,
): Promise<AvailabilitySlot[]> {
  const { data, error } = await db
    .from("availability_slots")
    .select("id, doctor_id, consultation_type_id, slot_date, start_time, end_time, status")
    .eq("doctor_id", doctorId)
    .eq("consultation_type_id", consultationTypeId)
    .gte("slot_date", todayISODate())
    .order("slot_date", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AvailabilitySlot[];
}

export type AppointmentDetail = {
  id: string;
  appointment_status: string | null;
  payment_status: string | null;
  patient_notes: string | null;
  created_at: string;
  doctor_id: string;
  consultation_type_id: string;
  slot_id: string;
  doctors: {
    id: string;
    full_name: string;
    specialization: string;
    profile_image_url: string | null;
    qualifications: string | null;
    experience_years: number | null;
  } | null;
  consultation_types: {
    id: string;
    name: string;
    mode: string;
    duration_minutes: number;
    fee: number;
    currency: string;
  } | null;
  availability_slots: {
    id: string;
    slot_date: string;
    start_time: string;
    end_time: string;
    status: string;
  } | null;
};

export async function fetchAppointmentById(id: string): Promise<AppointmentDetail | null> {
  const { data, error } = await db
    .from("appointments")
    .select(
      "id, appointment_status, payment_status, patient_notes, created_at, doctor_id, consultation_type_id, slot_id, doctors(id, full_name, specialization, profile_image_url, qualifications, experience_years), consultation_types(id, name, mode, duration_minutes, fee, currency), availability_slots(id, slot_date, start_time, end_time, status)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as AppointmentDetail | null;
}

export function formatFullDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export async function fetchSlotById(id: string): Promise<AvailabilitySlot | null> {
  const { data, error } = await db
    .from("availability_slots")
    .select("id, doctor_id, consultation_type_id, slot_date, start_time, end_time, status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as AvailabilitySlot | null;
}

export function formatFee(fee: number, currency: string): string {
  const symbol = currency === "INR" ? "₹" : "";
  const amount = Number.isFinite(fee) ? fee.toLocaleString(undefined, { maximumFractionDigits: 0 }) : String(fee);
  return symbol ? `${symbol}${amount}` : `${amount} ${currency}`;
}

export function formatMode(mode: string): string {
  if (mode === "in_person") return "In-person";
  if (mode === "online") return "Video";
  return mode;
}

export function formatTime(hms: string): string {
  const [hStr, mStr] = hms.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hms;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}