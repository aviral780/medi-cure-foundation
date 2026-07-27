import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { DEFAULT_CLINIC, type ClinicInfo } from "@/lib/clinic-constants";

const CACHE_KEY = "clinic:settings";

export const clinicSettingsQueryKey = ["clinic-settings"] as const;

function merge(row: Partial<ClinicInfo> | null | undefined): ClinicInfo {
  return {
    name: row?.name?.trim() || DEFAULT_CLINIC.name,
    phone: row?.phone || DEFAULT_CLINIC.phone,
    email: row?.email || DEFAULT_CLINIC.email,
    website: row?.website || DEFAULT_CLINIC.website,
    address: row?.address || DEFAULT_CLINIC.address,
    working_hours: row?.working_hours || DEFAULT_CLINIC.working_hours,
  };
}

/** Synchronous best-effort read — used by PDF/receipt generators. */
export function getCachedClinic(): ClinicInfo {
  if (typeof window === "undefined") return DEFAULT_CLINIC;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? merge(JSON.parse(raw)) : DEFAULT_CLINIC;
  } catch {
    return DEFAULT_CLINIC;
  }
}

function cache(info: ClinicInfo) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(info));
  } catch {
    /* ignore quota errors */
  }
}

export async function fetchClinicSettings(): Promise<ClinicInfo> {
  const { data, error } = await (supabase as any)
    .from("clinic_settings")
    .select("name, phone, email, website, address, working_hours")
    .eq("id", 1)
    .maybeSingle();
  if (error) return getCachedClinic();
  const info = merge(data);
  cache(info);
  return info;
}

export async function saveClinicSettings(input: ClinicInfo): Promise<ClinicInfo> {
  const payload = {
    id: 1,
    name: input.name.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    website: input.website.trim(),
    address: input.address.trim(),
    working_hours: input.working_hours.trim(),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await (supabase as any)
    .from("clinic_settings")
    .upsert(payload, { onConflict: "id" })
    .select("name, phone, email, website, address, working_hours")
    .maybeSingle();
  if (error) throw error;
  const info = merge(data ?? payload);
  cache(info);
  return info;
}

export function useClinicSettings() {
  const query = useQuery({
    queryKey: clinicSettingsQueryKey,
    queryFn: fetchClinicSettings,
    staleTime: 60_000,
  });
  return { clinic: query.data ?? getCachedClinic(), ...query };
}

export type ClinicValidationErrors = Partial<Record<keyof ClinicInfo, string>>;

export function validateClinic(input: ClinicInfo): ClinicValidationErrors {
  const errors: ClinicValidationErrors = {};
  if (!input.name.trim()) errors.name = "Clinic name is required.";
  else if (input.name.trim().length > 120) errors.name = "Clinic name must be under 120 characters.";

  const email = input.email.trim();
  if (!email) errors.email = "Email is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = "Enter a valid email address.";

  const phoneDigits = input.phone.replace(/[^\d]/g, "");
  if (!input.phone.trim()) errors.phone = "Phone number is required.";
  else if (!/^[+]?[\d\s()-]{7,20}$/.test(input.phone.trim()) || phoneDigits.length < 7 || phoneDigits.length > 15)
    errors.phone = "Enter a valid phone number.";

  const website = input.website.trim();
  if (website) {
    const candidate = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    try {
      const url = new URL(candidate);
      if (!/^[\w-]+(\.[\w-]+)+$/.test(url.hostname)) errors.website = "Enter a valid website URL.";
    } catch {
      errors.website = "Enter a valid website URL.";
    }
  }

  if (!input.address.trim()) errors.address = "Address is required.";
  return errors;
}

export function normalizeWebsite(website: string): string {
  const w = website.trim();
  if (!w) return "";
  return /^https?:\/\//i.test(w) ? w : `https://${w}`;
}