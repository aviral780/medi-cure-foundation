import { createFileRoute } from "@tanstack/react-router";
import {
  HttpError,
  jsonError,
  jsonOk,
  requireUserId,
  supabaseWithUserToken,
} from "@/lib/razorpay.server";

export const Route = createFileRoute("/api/public/appointments/release-pending")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { token } = await requireUserId(request);
          const body = (await request.json().catch(() => null)) as
            | { appointmentId?: string }
            | null;
          if (!body?.appointmentId) return jsonError(400, "appointmentId is required");

          const supabase = supabaseWithUserToken(token);
          const { error } = await supabase.rpc("release_appointment_slot", {
            p_appointment_id: body.appointmentId,
          });
          if (error) return jsonError(500, error.message);
          return jsonOk({ ok: true });
        } catch (e) {
          if (e instanceof HttpError) return jsonError(e.status, e.message);
          return jsonError(500, e instanceof Error ? e.message : "Unexpected error");
        }
      },
    },
  },
});