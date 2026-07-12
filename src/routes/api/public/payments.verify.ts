import { createFileRoute } from "@tanstack/react-router";
import {
  HttpError,
  jsonError,
  jsonOk,
  razorpayFetchPayment,
  requireUserId,
  supabaseWithUserToken,
  verifyRazorpaySignature,
} from "@/lib/razorpay.server";

export const Route = createFileRoute("/api/public/payments/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { userId, token } = await requireUserId(request);
          const body = (await request.json().catch(() => null)) as
            | {
                appointmentId?: string;
                razorpay_order_id?: string;
                razorpay_payment_id?: string;
                razorpay_signature?: string;
              }
            | null;
          if (
            !body?.appointmentId ||
            !body.razorpay_order_id ||
            !body.razorpay_payment_id ||
            !body.razorpay_signature
          ) {
            return jsonError(400, "Missing payment fields");
          }

          const supabase = supabaseWithUserToken(token);

          // Confirm the payment row belongs to this user + appointment + order.
          const { data: paymentRow, error: pErr } = await supabase
            .from("payments")
            .select("id, patient_id, appointment_id, status")
            .eq("razorpay_order_id", body.razorpay_order_id)
            .maybeSingle();
          if (pErr) return jsonError(500, pErr.message);
          if (!paymentRow) return jsonError(404, "Payment record not found");
          if ((paymentRow as any).patient_id !== userId) return jsonError(403, "Not authorized");
          if ((paymentRow as any).appointment_id !== body.appointmentId)
            return jsonError(400, "Payment does not match appointment");

          const valid = verifyRazorpaySignature(
            body.razorpay_order_id,
            body.razorpay_payment_id,
            body.razorpay_signature,
          );

          if (!valid) {
            await supabase
              .from("payments")
              .update({
                status: "failed",
                error_description: "Signature verification failed",
                razorpay_payment_id: body.razorpay_payment_id,
                updated_at: new Date().toISOString(),
              })
              .eq("id", (paymentRow as any).id);
            return jsonError(400, "Payment signature verification failed");
          }

          const details = await razorpayFetchPayment(body.razorpay_payment_id);

          const { error: updErr } = await supabase
            .from("payments")
            .update({
              status: "paid",
              payment_method: details.method,
              razorpay_payment_id: body.razorpay_payment_id,
              razorpay_signature: body.razorpay_signature,
              updated_at: new Date().toISOString(),
            })
            .eq("id", (paymentRow as any).id);
          if (updErr) return jsonError(500, `Could not update payment: ${updErr.message}`);

          const { error: rpcErr } = await supabase.rpc("mark_appointment_paid", {
            p_appointment_id: body.appointmentId,
          });
          if (rpcErr) return jsonError(500, `Could not confirm appointment: ${rpcErr.message}`);

          return jsonOk({ ok: true, paymentMethod: details.method, paymentId: body.razorpay_payment_id });
        } catch (e) {
          if (e instanceof HttpError) return jsonError(e.status, e.message);
          const msg = e instanceof Error ? e.message : "Unexpected error";
          return jsonError(500, msg);
        }
      },
    },
  },
});