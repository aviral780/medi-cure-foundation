import { createFileRoute } from "@tanstack/react-router";
import {
  HttpError,
  jsonError,
  jsonOk,
  razorpayCreateOrder,
  requireUserId,
  supabaseWithUserToken,
} from "@/lib/razorpay.server";

const FEE_INR = 100;
const CUTOFF_HOURS = 4;

export const Route = createFileRoute("/api/public/reschedule/create-order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { userId, token } = await requireUserId(request);
          const body = (await request.json().catch(() => null)) as
            | { appointmentId?: string; newSlotId?: string }
            | null;
          const appointmentId = body?.appointmentId;
          const newSlotId = body?.newSlotId;
          if (!appointmentId || !newSlotId) {
            return jsonError(400, "appointmentId and newSlotId are required");
          }

          const supabase = supabaseWithUserToken(token);

          const { data: appt, error: apptErr } = await supabase
            .from("appointments")
            .select(
              "id, patient_id, appointment_status, doctor_id, consultation_type_id, appointment_date, start_time, end_time, availability_slot_id, availability_slots(slot_date, start_time, end_time), doctors(full_name), consultation_types(name)",
            )
            .eq("id", appointmentId)
            .maybeSingle();
          if (apptErr) return jsonError(500, apptErr.message);
          if (!appt) return jsonError(404, "Appointment not found");
          if ((appt as any).patient_id !== userId) return jsonError(403, "Not authorized");

          const status = String((appt as any).appointment_status ?? "").toLowerCase();
          if (status === "cancelled" || status === "canceled")
            return jsonError(409, "Cancelled appointments cannot be rescheduled.");
          if (status === "completed")
            return jsonError(409, "Completed appointments cannot be rescheduled.");
          if (status === "rescheduled")
            return jsonError(409, "This appointment has already been rescheduled.");
          if (status !== "confirmed")
            return jsonError(409, "Only confirmed appointments can be rescheduled.");

          const prevDate =
            (appt as any).appointment_date ?? (appt as any).availability_slots?.slot_date ?? null;
          const prevStart =
            (appt as any).start_time ?? (appt as any).availability_slots?.start_time ?? null;
          const prevEnd =
            (appt as any).end_time ?? (appt as any).availability_slots?.end_time ?? null;
          if (!prevDate || !prevStart)
            return jsonError(400, "Missing schedule information on appointment.");

          const startMs = new Date(`${prevDate}T${prevStart}`).getTime();
          const hoursUntil = (startMs - Date.now()) / 3_600_000;
          if (hoursUntil <= 0)
            return jsonError(409, "This appointment has already started.");
          if (hoursUntil < CUTOFF_HOURS)
            return jsonError(
              409,
              "Appointments cannot be rescheduled within 4 hours of the scheduled time.",
            );

          const { data: slot, error: slotErr } = await supabase
            .from("availability_slots")
            .select("id, doctor_id, consultation_type_id, slot_date, start_time, end_time, status")
            .eq("id", newSlotId)
            .maybeSingle();
          if (slotErr) return jsonError(500, slotErr.message);
          if (!slot) return jsonError(404, "Selected slot not found");
          if (
            (slot as any).doctor_id !== (appt as any).doctor_id ||
            (slot as any).consultation_type_id !== (appt as any).consultation_type_id
          ) {
            return jsonError(400, "Selected slot does not match this consultation.");
          }
          const isCurrentSlot = (slot as any).id === (appt as any).availability_slot_id;
          if (isCurrentSlot)
            return jsonError(400, "Pick a different time slot to reschedule.");
          if ((slot as any).status !== "available")
            return jsonError(409, "Selected slot is no longer available.");
          const slotStartMs = new Date(
            `${(slot as any).slot_date}T${(slot as any).start_time}`,
          ).getTime();
          if (slotStartMs <= Date.now())
            return jsonError(400, "Selected slot is in the past.");

          const currency = "INR";
          const order = await razorpayCreateOrder({
            amountPaise: FEE_INR * 100,
            currency,
            receipt: `resch_${appointmentId.slice(0, 25)}`,
            notes: {
              appointment_id: appointmentId,
              patient_id: userId,
              purpose: "reschedule_fee",
              new_slot_id: newSlotId,
            },
          });

          const { data: paymentRowId, error: insErr } = await supabase.rpc(
            "create_payment_intent",
            {
              p_appointment_id: appointmentId,
              p_amount: FEE_INR,
              p_currency: currency,
              p_payment_gateway: "razorpay",
              p_gateway_order_id: order.id,
            },
          );
          if (insErr) return jsonError(500, `Could not record payment: ${insErr.message}`);
          if (!paymentRowId) return jsonError(500, "Could not record payment");

          return jsonOk({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: order.keyId,
            paymentRowId: paymentRowId as string,
            appointment: {
              id: appointmentId,
              doctorName: (appt as any).doctors?.full_name ?? "",
              consultationName: (appt as any).consultation_types?.name ?? "",
            },
            previous: { date: prevDate, startTime: prevStart, endTime: prevEnd },
            newSlot: {
              date: (slot as any).slot_date,
              startTime: (slot as any).start_time,
              endTime: (slot as any).end_time,
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