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

export const Route = createFileRoute("/api/public/reschedule/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { userId, token } = await requireUserId(request);
          const body = (await request.json().catch(() => null)) as
            | {
                appointmentId?: string;
                newSlotId?: string;
                razorpay_order_id?: string;
                razorpay_payment_id?: string;
                razorpay_signature?: string;
              }
            | null;
          if (
            !body?.appointmentId ||
            !body.newSlotId ||
            !body.razorpay_order_id ||
            !body.razorpay_payment_id ||
            !body.razorpay_signature
          ) {
            return jsonError(400, "Missing payment fields");
          }

          const supabase = supabaseWithUserToken(token);

          const { data: paymentRow, error: pErr } = await supabase
            .from("payments")
            .select("id, patient_id, appointment_id, status")
            .eq("gateway_order_id", body.razorpay_order_id)
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
            await supabase.rpc("mark_payment_failed", {
              p_payment_id: (paymentRow as any).id,
              p_gateway_payment_id: body.razorpay_payment_id,
              p_reason: "Signature verification failed",
            });
            return jsonError(400, "Payment signature verification failed");
          }

          const details = await razorpayFetchPayment(body.razorpay_payment_id);

          const { error: updErr } = await supabase.rpc("mark_payment_paid", {
            p_payment_id: (paymentRow as any).id,
            p_gateway_payment_id: body.razorpay_payment_id,
            p_gateway_signature: body.razorpay_signature,
          });
          if (updErr) return jsonError(500, `Could not update payment: ${updErr.message}`);

          // Free stale (cancelled/completed/rescheduled) references to the
          // target slot so the reschedule swap doesn't hit a UNIQUE
          // (availability_slot_id) violation on public.appointments.
          await supabase.rpc("free_stale_slot_reservations", {
            p_slot_id: body.newSlotId,
          });

          // Perform the reschedule — existing RPC releases the old slot and
          // reserves the new one atomically. If it fails (e.g. slot just taken),
          // the ₹100 fee stays recorded as paid so the user can retry with a
          // different slot without paying again (or contact support for refund).
          const { error: rpcErr } = await supabase.rpc("reschedule_appointment", {
            p_appointment_id: body.appointmentId,
            p_new_slot_id: body.newSlotId,
          });
          if (rpcErr) return jsonError(500, `Could not reschedule: ${rpcErr.message}`);

          // Move the Google Calendar event (and keep the same Meet link) for
          // online consultations. Best-effort — never fails the reschedule.
          let meeting: { synced: boolean; meetingUrl?: string | null } = { synced: false };
          try {
            const { rescheduleMeetingForAppointment } = await import("@/lib/google/calendar.server");
            meeting = await rescheduleMeetingForAppointment(body.appointmentId);
          } catch (err) {
            console.error("[reschedule.verify] meeting sync failed", (err as Error).message);
          }

          return jsonOk({
            ok: true,
            paymentMethod: details.method,
            paymentId: body.razorpay_payment_id,
            meetingUrl: meeting.meetingUrl ?? null,
            meetingSynced: meeting.synced,
          });
        } catch (e) {
          if (e instanceof HttpError) return jsonError(e.status, e.message);
          const msg = e instanceof Error ? e.message : "Unexpected error";
          return jsonError(500, msg);
        }
      },
    },
  },
});