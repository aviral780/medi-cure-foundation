import { createFileRoute } from "@tanstack/react-router";
import { requireUserId, supabaseWithUserToken, jsonError, jsonOk, HttpError } from "@/lib/razorpay.server";
import { supabaseService } from "@/lib/google/google.server";

/**
 * Admin-authorized cancellation. Does NOT use the patient-only
 * `cancel_appointment` RPC. Verifies the caller is an active admin, then
 * cancels through the service-role client, releases the slot and clears the
 * Google Calendar event.
 */
export const Route = createFileRoute("/api/public/admin/appointments/cancel")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          let body: { appointment_id?: string; reason?: string | null };
          try {
            body = await request.json();
          } catch {
            return jsonError(400, "Please try again.");
          }
          const appointmentId = body?.appointment_id;
          if (!appointmentId) return jsonError(400, "Please try again.");

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
          if (!db) return jsonError(500, "Unable to cancel appointment. Please try again.");

          const { data: appt } = await db
            .from("appointments")
            .select("id, appointment_status, availability_slot_id")
            .eq("id", appointmentId)
            .maybeSingle();
          if (!appt) return jsonError(404, "Appointment not found.");
          const status = String((appt as any).appointment_status ?? "").toLowerCase();
          if (status === "cancelled" || status === "canceled") {
            return jsonError(409, "Appointment has already been cancelled.");
          }

          const update: Record<string, unknown> = {
            appointment_status: "cancelled",
            availability_slot_id: null,
          };
          if (body.reason) update.cancellation_reason = body.reason;

          const { error: updErr } = await db
            .from("appointments")
            .update(update)
            .eq("id", appointmentId);
          if (updErr) {
            console.error("[admin.cancel]", updErr.message);
            return jsonError(500, "Unable to cancel appointment. Please try again.");
          }

          const slotId = (appt as any).availability_slot_id as string | null;
          if (slotId) {
            await db.from("availability_slots").update({ status: "available" }).eq("id", slotId);
          }

          try {
            const { cancelMeetingForAppointment } = await import("@/lib/google/calendar.server");
            await cancelMeetingForAppointment(appointmentId);
          } catch (err) {
            console.error("[admin.cancel] meeting cancel failed", (err as Error).message);
          }

          return jsonOk({ ok: true });
        } catch (e) {
          if (e instanceof HttpError) return jsonError(e.status, "Please sign in again.");
          console.error("[admin.cancel]", (e as Error).message);
          return jsonError(500, "Unable to cancel appointment. Please try again.");
        }
      },
    },
  },
});
