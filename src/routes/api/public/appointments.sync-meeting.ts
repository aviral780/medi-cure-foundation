import { createFileRoute } from "@tanstack/react-router";
import { requireUserId, supabaseWithUserToken } from "@/lib/razorpay.server";

/**
 * Re-syncs the Google Calendar / Meet event for an appointment after an
 * admin-side reschedule. Admin-only: the caller must have an active row in
 * public.admins. Reuses the existing calendar integration untouched.
 */
export const Route = createFileRoute("/api/public/appointments/sync-meeting")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { appointment_id?: string };
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const appointmentId = body?.appointment_id;
        if (!appointmentId || typeof appointmentId !== "string") {
          return new Response("appointment_id required", { status: 400 });
        }
        try {
          const { userId, token } = await requireUserId(request);
          const db = supabaseWithUserToken(token);
          const { data: admin } = await db
            .from("admins")
            .select("id")
            .eq("user_id", userId)
            .eq("is_active", true)
            .maybeSingle();
          if (!admin) return new Response("Forbidden", { status: 403 });

          const { rescheduleMeetingForAppointment } = await import(
            "@/lib/google/calendar.server"
          );
          const result = await rescheduleMeetingForAppointment(appointmentId);
          return Response.json({ ok: true, ...result });
        } catch (err) {
          return Response.json({
            ok: true,
            synced: false,
            reason: (err as Error).message,
          });
        }
      },
    },
  },
});