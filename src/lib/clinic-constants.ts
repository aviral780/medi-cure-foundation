// Single source of truth for clinic + doctor branding fallbacks.
// Pure module (no imports) so it is safe on both server and client.

export type ClinicInfo = {
  name: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  working_hours: string;
};

export const DEFAULT_CLINIC: ClinicInfo = {
  name: "Vardhman Medicare",
  phone: "+91 98 0000 0000",
  email: "contact@vardhmanivf.in",
  website: "https://vardhmanivf.in",
  address: "Vardhman Medicare, India",
  working_hours: "Mon-Sat 09:00-20:00",
};

export const CLINIC_TAGLINE = "Clinic consultation & appointment management";

export const DEFAULT_DOCTOR = {
  name: "Dr. Mahaveer Jain",
  specialty: "Pediatrician",
  description:
    "MBBS, MD (Pediatrics). Senior Pediatrician with nearly 40 years of clinical experience, providing comprehensive care for infants, children and adolescents.",
};

export function websiteHost(url: string): string {
  return String(url || "").replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

/** Server-safe clinic name lookup for a Supabase client of any flavour. */
export async function fetchClinicName(db: any): Promise<string> {
  try {
    const { data } = await db.from("clinic_settings").select("name").eq("id", 1).maybeSingle();
    const name = (data as { name?: string } | null)?.name;
    return name && name.trim() ? name.trim() : DEFAULT_CLINIC.name;
  } catch {
    return DEFAULT_CLINIC.name;
  }
}