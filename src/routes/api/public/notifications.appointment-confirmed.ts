import { createFileRoute } from "@tanstack/react-router";
import { sendEmail } from "@/lib/email/resend.server";
import { renderBookingConfirmationEmail } from "@/lib/email/templates/booking-confirmation";
import { supabaseWithUserToken, requireUserId } from "@/lib/razorpay.server";
import { generateInvoicePdf } from "@/lib/invoice/generate-invoice-pdf";

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

          // Generate a PDF invoice for paid appointments and attach it to the
          // confirmation email. Free/unpaid appointments send without an
          // attachment. Any generation failure is swallowed so the email is
          // still delivered.
          const attachments: Array<{ filename: string; content: string; contentType?: string }> = [];
          try {
            const { data: payment } = await db
              .from("payments")
              .select("id, amount, currency, gateway_payment_id, status, paid_at, created_at")
              .eq("appointment_id", appointmentId)
              .eq("status", "paid")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (payment) {
              const amt = Number((payment as any).amount ?? fee);
              const cur = ((payment as any).currency ?? currency) as string;
              const amountDisplay = new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency: cur,
                maximumFractionDigits: 2,
              }).format(amt);
              const paidAt = (payment as any).paid_at ?? (payment as any).created_at ?? new Date().toISOString();
              const invoiceDate = new Date(paidAt).toISOString().slice(0, 10);
              const invoiceNumber = `INV-${String((appt as any).id).slice(0, 8).toUpperCase()}`;
              const startTime = (appt as any).start_time ?? "";
              const endTime = (appt as any).end_time ?? "";
              const dateTime = `${(appt as any).appointment_date ?? ""} ${startTime}${endTime ? ` – ${endTime}` : ""}`.trim();

              const pdf = await generateInvoicePdf({
                clinicName: "MediCure",
                invoiceNumber,
                invoiceDate,
                appointmentId: (appt as any).id,
                patientName: patientName ?? email,
                doctorName: (appt as any).doctors?.full_name ?? "your doctor",
                consultationType: `${ct.name ?? "Consultation"} (${ct.mode === "online" ? "Video" : "In-person"})`,
                dateTime,
                paymentId: (payment as any).gateway_payment_id ?? (payment as any).id,
                amountPaid: amountDisplay,
                paymentStatus: "Paid",
              });
              attachments.push({
                filename: pdf.filename,
                content: pdf.contentBase64,
                contentType: "application/pdf",
              });
            }
          } catch {
            /* invoice generation is best-effort */
          }

          const result = await sendEmail({
            to: email,
            subject,
            html,
            ...(attachments.length > 0 ? { attachments } : {}),
          });
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