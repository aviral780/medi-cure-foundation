import { createFileRoute } from "@tanstack/react-router";
import { sendEmail } from "@/lib/email/resend.server";
import { renderCancellationConfirmationEmail } from "@/lib/email/templates/cancellation-confirmation";
import { requireUserId, supabaseWithUserToken } from "@/lib/razorpay.server";

// Best-effort cancellation confirmation email. Authenticates with the caller's
// Supabase session (same pattern as appointment-confirmed). Never fails the UI.
export const Route = createFileRoute("/api/public/notifications/appointment-cancelled")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { appointment_id?: string; reason?: string | null };
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
              "id, appointment_status, appointment_date, start_time, end_time, cancellation_reason, patient_id, doctors(full_name), consultation_types(name, mode)",
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

          const reason =
            (typeof body?.reason === "string" && body.reason.trim()) ||
            ((appt as any).cancellation_reason ?? null);

          const { subject, html } = renderCancellationConfirmationEmail({
            patientName,
            doctorName: (appt as any).doctors?.full_name ?? "your doctor",
            consultationName: (appt as any).consultation_types?.name ?? "Consultation",
            mode: (appt as any).consultation_types?.mode ?? "in_person",
            date: (appt as any).appointment_date ?? "",
            startTime: (appt as any).start_time ?? "",
            endTime: (appt as any).end_time ?? "",
            reason,
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