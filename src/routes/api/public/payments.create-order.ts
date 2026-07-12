import { createFileRoute } from "@tanstack/react-router";
import {
  HttpError,
  jsonError,
  jsonOk,
  razorpayCreateOrder,
  requireUserId,
  supabaseWithUserToken,
} from "@/lib/razorpay.server";

export const Route = createFileRoute("/api/public/payments/create-order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { userId, token } = await requireUserId(request);
          const body = (await request.json().catch(() => null)) as { appointmentId?: string } | null;
          const appointmentId = body?.appointmentId;
          if (!appointmentId) return jsonError(400, "appointmentId is required");

          const supabase = supabaseWithUserToken(token);

          const { data: appt, error: apptErr } = await supabase
            .from("appointments")
            .select(
              "id, patient_id, appointment_status, payment_status, consultation_type_id, doctors(full_name), consultation_types(name, fee, currency)",
            )
            .eq("id", appointmentId)
            .maybeSingle();
          if (apptErr) return jsonError(500, apptErr.message);
          if (!appt) return jsonError(404, "Appointment not found");
          if ((appt as any).patient_id !== userId) return jsonError(403, "Not authorized");
          if ((appt as any).payment_status === "paid")
            return jsonError(409, "This appointment is already paid.");
          const status = String((appt as any).appointment_status ?? "").toLowerCase();
          if (status === "cancelled" || status === "canceled")
            return jsonError(409, "This appointment was cancelled.");

          const type = (appt as any).consultation_types;
          if (!type) return jsonError(500, "Consultation type missing on appointment");
          const fee = Number(type.fee ?? 0);
          if (!(fee > 0)) return jsonError(400, "This consultation has no fee to charge.");
          const currency = String(type.currency ?? "INR");
          const amountPaise = Math.round(fee * 100);

          const order = await razorpayCreateOrder({
            amountPaise,
            currency,
            receipt: `appt_${appointmentId.slice(0, 30)}`,
            notes: { appointment_id: appointmentId, patient_id: userId },
          });

          const { data: inserted, error: insErr } = await supabase
            .from("payments")
            .insert({
              appointment_id: appointmentId,
              patient_id: userId,
              amount: fee,
              currency,
              razorpay_order_id: order.id,
              status: "created",
            })
            .select("id")
            .single();
          if (insErr) return jsonError(500, `Could not record payment: ${insErr.message}`);

          return jsonOk({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: order.keyId,
            paymentRowId: (inserted as { id: string }).id,
            appointment: {
              id: appointmentId,
              doctorName: (appt as any).doctors?.full_name ?? "",
              consultationName: type.name ?? "",
            },
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