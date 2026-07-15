import { createFileRoute } from "@tanstack/react-router";
import { sendEmail } from "@/lib/email/resend.server";
import { renderBookingConfirmationEmail } from "@/lib/email/templates/booking-confirmation";
import { supabaseWithUserToken, requireUserId } from "@/lib/razorpay.server";

// Best-effort booking confirmation email. Never fails the booking flow.
export const Route = createFileRoute("/api/public/notifications/appointment-confirmed")({
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
          // Authenticate the caller against the external Supabase project (RLS applies).
          const { token } = await requireUserId(request).catch(() => ({ token: "" }));
          if (!token) {
            return Response.json({ ok: true, sent: false, reason: "no_session" });
          }
          const db = supabaseWithUserToken(token);
          const { data: appt, error } = await db
            .from("appointments")
            .select(
              "id, appointment_date, start_time, end_time, patient_id, doctors(full_name), consultation_types(name, mode, fee, currency)",
            )
            .eq("id", appointmentId)
            .maybeSingle();
          if (error || !appt) {
            return Response.json({ ok: true, sent: false, reason: "appointment_not_found" });
          }

          const { data: userRes } = await db.auth.getUser(token);
          const email = userRes?.user?.email;
          if (!email) {
            return Response.json({ ok: true, sent: false, reason: "no_recipient" });
          }

          const meta = (userRes?.user?.user_metadata ?? {}) as Record<string, unknown>;
          const patientName =
            (typeof meta.full_name === "string" && meta.full_name) ||
            (typeof meta.name === "string" && meta.name) ||
            null;

          const ct = (appt as any).consultation_types ?? {};
          const fee = Number(ct.fee ?? 0);
          const currency = (ct.currency ?? "INR") as string;
          const feeDisplay = fee > 0
            ? new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(fee)
            : "Free";

          const { subject, html } = renderBookingConfirmationEmail({
            patientName,
            doctorName: (appt as any).doctors?.full_name ?? "your doctor",
            consultationName: ct.name ?? "Consultation",
            mode: ct.mode ?? "in_person",
            date: (appt as any).appointment_date ?? "",
            startTime: (appt as any).start_time ?? "",
            endTime: (appt as any).end_time ?? "",
            feeDisplay,
            appointmentId: (appt as any).id,
          });

          const result = await sendEmail({ to: email, subject, html });
          return Response.json(result);
        } catch (err) {
          return Response.json({
            ok: true,
            sent: false,
            reason: "exception",
            detail: (err as Error).message,
          });
        }
      },
    },
  },
});