import { supabase } from "@/lib/supabase";

const db = supabase as any;

/** Updates the appointment lifecycle status using the existing table + RLS. */
export async function setAppointmentStatus(
  appointmentId: string,
  status: "confirmed" | "completed",
): Promise<void> {
  const { data, error } = await db
    .from("appointments")
    .update({ appointment_status: status })
    .eq("id", appointmentId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error(
      "Update was blocked — your admin account doesn't have write access to this appointment.",
    );
  }
}

async function adminPost(path: string, body: Record<string, unknown>, fallback: string) {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Please try again.");
  }
  const payload = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) throw new Error(payload?.error || fallback);
  return payload;
}

/**
 * Admin-side reschedule (no fee). Uses the admin-authorized server route —
 * the patient RPC rejects admins because it enforces patient_id = auth.uid().
 * The route reserves the new slot, moves the appointment, releases the old
 * slot and re-syncs the Google Calendar / Meet event.
 */
export async function adminRescheduleAppointment(input: {
  appointmentId: string;
  newSlotId: string;
}): Promise<void> {
  await adminPost(
    "/api/public/admin/appointments/reschedule",
    { appointment_id: input.appointmentId, new_slot_id: input.newSlotId },
    "Unable to reschedule appointment. Please try again.",
  );
}

/** Admin-side cancellation — admin-authorized route, releases the slot. */
export async function adminCancelAppointment(input: {
  appointmentId: string;
  reason?: string | null;
}): Promise<void> {
  await adminPost(
    "/api/public/admin/appointments/cancel",
    { appointment_id: input.appointmentId, reason: input.reason ?? null },
    "Unable to cancel appointment. Please try again.",
  );
}