import { createFileRoute } from "@tanstack/react-router";
import {
  HttpError,
  jsonError,
  jsonOk,
  requireUserId,
  supabaseWithUserToken,
} from "@/lib/razorpay.server";

export const Route = createFileRoute("/api/public/payments/mark-failed")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { userId, token } = await requireUserId(request);
          const body = (await request.json().catch(() => null)) as
            | { appointmentId?: string; razorpay_order_id?: string; reason?: string }
            | null;
          if (!body?.razorpay_order_id) return jsonError(400, "razorpay_order_id required");

          const supabase = supabaseWithUserToken(token);
          const { error } = await supabase
            .from("payments")
            .update({
              status: "failed",
              error_description: body.reason ?? "Payment not completed",
              updated_at: new Date().toISOString(),
            })
            .eq("razorpay_order_id", body.razorpay_order_id)
            .eq("patient_id", userId);
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