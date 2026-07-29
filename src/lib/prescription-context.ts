import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { fetchAppointmentById, type AppointmentDetail } from "@/lib/booking-queries";
import { fetchClinicSettings } from "@/lib/clinic-settings";
import { DEFAULT_CLINIC, DEFAULT_DOCTOR, type ClinicInfo } from "@/lib/clinic-constants";

export type PatientProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
};

export type PrescriptionContext = {
  clinic: ClinicInfo;
  appointment: AppointmentDetail | null;
  patient: PatientProfile | null;
  doctor: {
    name: string;
    specialization: string;
    qualifications: string;
  };
  patientName: string;
  patientAge: string;
  patientGender: string;
  patientPhone: string;
  appointmentDate: string | null;
  consultationType: string;
  patientId: string | null;
  doctorId: string | null;
};

export function computeAge(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const years = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
  return years >= 0 && years < 150 ? years : null;
}

async function fetchPatient(id: string): Promise<PatientProfile | null> {
  const { data, error } = await (supabase as any)
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return null;
  return (data ?? null) as PatientProfile | null;
}

/** Assembles every read-only header field for the prescription screens. */
export function usePrescriptionContext(appointmentId: string | null, enabled: boolean) {
  const active = Boolean(appointmentId) && enabled;

  const clinicQ = useQuery({
    queryKey: ["clinic-settings"],
    queryFn: fetchClinicSettings,
    enabled: active,
  });

  const apptQ = useQuery({
    queryKey: ["prescription-appt", appointmentId],
    queryFn: () => fetchAppointmentById(appointmentId as string),
    enabled: active,
  });

  const patientId = ((apptQ.data as any)?.patient_id ?? null) as string | null;

  const patientQ = useQuery({
    queryKey: ["prescription-patient", patientId],
    queryFn: () => fetchPatient(patientId as string),
    enabled: active && Boolean(patientId),
  });

  const appt = apptQ.data ?? null;
  const patient = patientQ.data ?? null;
  const age = computeAge(patient?.date_of_birth);

  const context: PrescriptionContext = {
    clinic: clinicQ.data ?? DEFAULT_CLINIC,
    appointment: appt,
    patient,
    doctor: {
      name: appt?.doctors?.full_name || DEFAULT_DOCTOR.name,
      specialization: appt?.doctors?.specialization || DEFAULT_DOCTOR.specialty,
      qualifications: appt?.doctors?.qualifications || DEFAULT_DOCTOR.qualifications,
    },
    patientName: patient?.full_name || "Patient",
    patientAge: age !== null ? `${age} yrs` : "—",
    patientGender: patient?.gender ? String(patient.gender) : "—",
    patientPhone: patient?.phone || "—",
    appointmentDate: appt?.appointment_date ?? null,
    consultationType: appt?.consultation_types?.name || "Consultation",
    patientId,
    doctorId: appt?.doctor_id ?? null,
  };

  return {
    context,
    isLoading: apptQ.isLoading || (Boolean(patientId) && patientQ.isLoading),
  };
}
