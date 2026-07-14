import { createFileRoute } from "@tanstack/react-router";

// Best-effort cancellation confirmation email.
// - No-ops (200) if RESEND_API_KEY / SUPABASE_SERVICE_ROLE_KEY aren't configured,
//   so the client-side cancellation flow never fails on missing email infra.
// - When configured, fetches the appointment + patient email server-side and
//   sends a plain confirmation email via Resend.
export const Route = createFileRoute("/api/public/notifications/appointment-cancelled")({
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

        const resendKey = process.env.RESEND_API_KEY;
        const supabaseUrl = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!resendKey || !supabaseUrl || !serviceKey) {
          // Email not configured — treat as no-op so the UI flow succeeds.
          return Response.json({ ok: true, sent: false, reason: "email_not_configured" });
        }

        try {
          const { createClient } = await import("@supabase/supabase-js");
          const admin = createClient(supabaseUrl, serviceKey, {
            auth: { persistSession: false },
          });
          const { data: appt, error } = await admin
            .from("appointments")
            .select(
              "id, appointment_status, appointment_date, start_time, end_time, patient_id, doctors(full_name), consultation_types(name, mode)",
            )
            .eq("id", appointmentId)
            .maybeSingle();
          if (error || !appt) {
            return Response.json({ ok: true, sent: false, reason: "appointment_not_found" });
          }

          const { data: userRes } = await admin.auth.admin.getUserById(
            (appt as any).patient_id,
          );
          const email = userRes?.user?.email;
          if (!email) {
            return Response.json({ ok: true, sent: false, reason: "no_recipient" });
          }

          const doctorName = (appt as any).doctors?.full_name ?? "your doctor";
          const mode = (appt as any).consultation_types?.mode === "online" ? "Video" : "In-person";
          const typeName = (appt as any).consultation_types?.name ?? "Consultation";
          const date = (appt as any).appointment_date ?? "";
          const start = (appt as any).start_time ?? "";
          const end = (appt as any).end_time ?? "";

          const html = `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
              <h2 style="margin:0 0 12px">Your appointment has been cancelled</h2>
              <p>This is a confirmation that the following appointment has been cancelled.</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0">
                <tr><td style="padding:6px 0;color:#64748b">Doctor</td><td style="padding:6px 0"><strong>${doctorName}</strong></td></tr>
                <tr><td style="padding:6px 0;color:#64748b">Date</td><td style="padding:6px 0">${date}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b">Time</td><td style="padding:6px 0">${start} – ${end}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b">Type</td><td style="padding:6px 0">${typeName} · ${mode}</td></tr>
              </table>
              <p style="color:#475569;font-size:14px">The time slot has been released. If this was a mistake, please book again from the MediCure app.</p>
            </div>
          `;

          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendKey}`,
            },
            body: JSON.stringify({
              from: process.env.RESEND_FROM ?? "MediCure <onboarding@resend.dev>",
              to: [email],
              subject: "Your MediCure appointment has been cancelled",
              html,
            }),
          });
          if (!res.ok) {
            const text = await res.text();
            return Response.json({ ok: true, sent: false, reason: `resend_${res.status}`, detail: text.slice(0, 200) });
          }
          return Response.json({ ok: true, sent: true });
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