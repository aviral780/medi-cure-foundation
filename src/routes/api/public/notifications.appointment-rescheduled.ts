import { createFileRoute } from "@tanstack/react-router";

// Best-effort reschedule confirmation email. No-ops (200) if RESEND_API_KEY or
// SUPABASE_SERVICE_ROLE_KEY are missing so the client flow never fails.
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

        const resendKey = process.env.RESEND_API_KEY;
        const supabaseUrl = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!resendKey || !supabaseUrl || !serviceKey) {
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
              "id, appointment_date, start_time, end_time, patient_id, doctors(full_name), consultation_types(name, mode)",
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
          const prevDate = body?.previous?.date ?? "";
          const prevStart = body?.previous?.start_time ?? "";
          const prevEnd = body?.previous?.end_time ?? "";
          const newDate = (appt as any).appointment_date ?? "";
          const newStart = (appt as any).start_time ?? "";
          const newEnd = (appt as any).end_time ?? "";
          const fee = Number(body?.fee_inr ?? 100);

          const html = `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
              <h2 style="margin:0 0 12px">Your appointment has been rescheduled</h2>
              <p>Your MediCure appointment with <strong>${doctorName}</strong> has been rescheduled successfully.</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0">
                <tr><td style="padding:6px 0;color:#64748b">Doctor</td><td style="padding:6px 0"><strong>${doctorName}</strong></td></tr>
                <tr><td style="padding:6px 0;color:#64748b">Consultation</td><td style="padding:6px 0">${typeName} · ${mode}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b">Previous</td><td style="padding:6px 0">${prevDate} · ${prevStart} – ${prevEnd}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b">New</td><td style="padding:6px 0"><strong>${newDate} · ${newStart} – ${newEnd}</strong></td></tr>
                <tr><td style="padding:6px 0;color:#64748b">Reschedule fee paid</td><td style="padding:6px 0">₹${fee}</td></tr>
              </table>
              <p style="color:#475569;font-size:14px">See you at your new appointment time.</p>
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
              subject: "Your MediCure appointment has been rescheduled",
              html,
            }),
          });
          if (!res.ok) {
            const text = await res.text();
            return Response.json({
              ok: true,
              sent: false,
              reason: `resend_${res.status}`,
              detail: text.slice(0, 200),
            });
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