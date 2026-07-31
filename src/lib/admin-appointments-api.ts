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

/**
 * Admin-side reschedule. Reuses the same RPCs the patient reschedule flow
 * relies on (no fee), then asks the server to move the Google Calendar /
 * Meet event when one exists.
 */
export async function adminRescheduleAppointment(input: {
  appointmentId: string;
  newSlotId: string;
}): Promise<void> {
  const { error: freeErr } = await db.rpc("free_stale_slot_reservations", {
    p_slot_id: input.newSlotId,
  });
  if (freeErr) throw freeErr;

  const { error } = await db.rpc("reschedule_appointment", {
    p_appointment_id: input.appointmentId,
    p_new_slot_id: input.newSlotId,
  });
  if (error) throw error;

  // Best-effort meeting sync — never blocks the reschedule.
  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    await fetch("/api/public/appointments/sync-meeting", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ appointment_id: input.appointmentId }),
    });
  } catch {
    // ignore
  }
}