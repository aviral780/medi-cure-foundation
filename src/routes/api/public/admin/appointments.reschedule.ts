import { createFileRoute } from "@tanstack/react-router";
import { requireUserId, supabaseWithUserToken, jsonError, jsonOk, HttpError } from "@/lib/razorpay.server";
import { supabaseService } from "@/lib/google/google.server";

/**
 * Admin-authorized reschedule. Does NOT use the patient-only
 * `reschedule_appointment` RPC (which enforces patient_id = auth.uid()).
 * The caller must be an active row in public.admins; writes then run with the
 * service-role client so any appointment can be moved.
 */
export const Route = createFileRoute("/api/public/admin/appointments/reschedule")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          let body: { appointment_id?: string; new_slot_id?: string };
          try {
            body = await request.json();
          } catch {
            return jsonError(400, "Please try again.");
          }
          const appointmentId = body?.appointment_id;
          const newSlotId = body?.new_slot_id;
          if (!appointmentId || !newSlotId) return jsonError(400, "Please try again.");

          const { userId, token } = await requireUserId(request);
          const userDb = supabaseWithUserToken(token);
          const { data: admin } = await userDb
            .from("admins")
            .select("id")
            .eq("user_id", userId)
            .eq("is_active", true)
            .maybeSingle();
          if (!admin) return jsonError(403, "You don't have permission to do that.");

          const db = supabaseService();
          if (!db) return jsonError(500, "Unable to reschedule appointment. Please try again.");

          const { data: appt } = await db
            .from("appointments")
            .select("id, appointment_status, availability_slot_id, doctor_id, consultation_type_id")
            .eq("id", appointmentId)
            .maybeSingle();
          if (!appt) return jsonError(404, "Appointment not found.");
          const status = String((appt as any).appointment_status ?? "").toLowerCase();
          if (status === "cancelled" || status === "canceled") {
            return jsonError(409, "Appointment has already been cancelled.");
          }
          if (status === "completed") {
            return jsonError(409, "This appointment is already completed.");
          }

          const { data: slot } = await db
            .from("availability_slots")
            .select("id, slot_date, start_time, end_time, status")
            .eq("id", newSlotId)
            .maybeSingle();
          if (!slot) return jsonError(409, "Selected slot is no longer available.");
          if (String((slot as any).status ?? "").toLowerCase() !== "available") {
            return jsonError(409, "Selected slot is no longer available.");
          }

          const previousSlotId = (appt as any).availability_slot_id as string | null;

          // Free any stale (cancelled / completed / rescheduled) reservation on
          // the target slot so a UNIQUE(availability_slot_id) index can't trip.
          await db
            .from("appointments")
            .update({ availability_slot_id: null })
            .eq("availability_slot_id", newSlotId)
            .in("appointment_status", [
              "cancelled",
              "canceled",
              "completed",
              "rescheduled",
              "Cancelled",
              "Completed",
            ]);

          // Reserve the new slot.
          const { error: reserveErr } = await db
            .from("availability_slots")
            .update({ status: "booked" })
            .eq("id", newSlotId)
            .eq("status", "available");
          if (reserveErr) return jsonError(409, "Unable to reschedule because the slot is unavailable.");

          // Move the appointment.
          const { error: updErr } = await db
            .from("appointments")
            .update({
              availability_slot_id: newSlotId,
              appointment_date: (slot as any).slot_date,
              start_time: (slot as any).start_time,
              end_time: (slot as any).end_time,
            })
            .eq("id", appointmentId);
          if (updErr) {
            await db.from("availability_slots").update({ status: "available" }).eq("id", newSlotId);
            return jsonError(409, "Unable to reschedule because the slot is unavailable.");
          }

          // Release the previous slot.
          if (previousSlotId && previousSlotId !== newSlotId) {
            await db
              .from("availability_slots")
              .update({ status: "available" })
              .eq("id", previousSlotId);
          }

          // Move the Google Calendar event, keeping the same Meet link.
          let meeting: { synced: boolean; meetingUrl?: string | null } = { synced: false };
          try {
            const { rescheduleMeetingForAppointment } = await import("@/lib/google/calendar.server");
            meeting = await rescheduleMeetingForAppointment(appointmentId);
          } catch (err) {
            console.error("[admin.reschedule] meeting sync failed", (err as Error).message);
          }

          return jsonOk({
            ok: true,
            meetingUrl: meeting.meetingUrl ?? null,
            meetingSynced: meeting.synced,
          });
        } catch (e) {
          if (e instanceof HttpError) return jsonError(e.status, "Please sign in again.");
          console.error("[admin.reschedule]", (e as Error).message);
          return jsonError(500, "Unable to reschedule appointment. Please try again.");
        }
      },
    },
  },
});
