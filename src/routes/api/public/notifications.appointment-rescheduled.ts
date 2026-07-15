import { createFileRoute } from "@tanstack/react-router";
import { sendEmail } from "@/lib/email/resend.server";
import { renderRescheduleConfirmationEmail } from "@/lib/email/templates/reschedule-confirmation";
import { requireUserId, supabaseWithUserToken } from "@/lib/razorpay.server";

// Best-effort reschedule confirmation email. Authenticates with the caller's
// Supabase session (same pattern as appointment-confirmed) so it works without
// a service-role key. Never fails the client flow.
export const Route = createFileRoute("/api/public/notifications/appointment-rescheduled")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: {
          appointment_id?: string;
          previous?: { date?: string; start_time?: string; end_time?: string };
          fee_inr?: number;
        };
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
          const { token } = await requireUserId(request).catch(() => ({ token: "" }));
          if (!token) {
            return Response.json({ ok: true, sent: false, reason: "no_session" });
          }
          const db = supabaseWithUserToken(token);
          const { data: appt, error } = await db
            .from("appointments")
            .select(
              "id, appointment_date, start_time, end_time, patient_id, doctors(full_name), consultation_types(name, mode)",
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

          const fee = Number(body?.fee_inr ?? 100);
          const feeDisplay = fee > 0
            ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(fee)
            : null;

          const { subject, html } = renderRescheduleConfirmationEmail({
            patientName,
            doctorName: (appt as any).doctors?.full_name ?? "your doctor",
            consultationName: (appt as any).consultation_types?.name ?? "Consultation",
            mode: (appt as any).consultation_types?.mode ?? "in_person",
            previousDate: body?.previous?.date ?? "",
            previousStartTime: body?.previous?.start_time ?? "",
            previousEndTime: body?.previous?.end_time ?? "",
            newDate: (appt as any).appointment_date ?? "",
            newStartTime: (appt as any).start_time ?? "",
            newEndTime: (appt as any).end_time ?? "",
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