import { DEFAULT_CLINIC } from "@/lib/clinic-constants";

// Reusable booking confirmation email template.

export type BookingConfirmationData = {
  patientName?: string | null;
  doctorName: string;
  consultationName: string;
  mode: "online" | "in_person" | string;
  date: string; // YYYY-MM-DD or friendly
  startTime: string;
  endTime: string;
  feeDisplay?: string | null; // e.g. "₹500" or "Free"
  appointmentId?: string | null;
  clinicName?: string | null;
  meetingUrl?: string | null;
};

export function renderBookingConfirmationEmail(d: BookingConfirmationData): {
  subject: string;
  html: string;
} {
  const modeLabel = d.mode === "online" ? "Video consultation" : "In-person";
  const greetingName = d.patientName?.trim() ? d.patientName : "there";
  const clinic = d.clinicName?.trim() || DEFAULT_CLINIC.name;
  const subject = `Your ${clinic} appointment with ${d.doctorName} is confirmed`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:24px">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;color:#0f172a;border:1px solid #e2e8f0">
        <h2 style="margin:0 0 8px;font-size:20px;color:#0f766e">Booking confirmed</h2>
        <p style="margin:0 0 16px;color:#334155">Hi ${escapeHtml(greetingName)}, your appointment has been successfully booked.</p>
        <table style="width:100%;border-collapse:collapse;margin:8px 0 16px">
          <tr><td style="padding:6px 0;color:#64748b;width:38%">Doctor</td><td style="padding:6px 0"><strong>${escapeHtml(d.doctorName)}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Consultation</td><td style="padding:6px 0">${escapeHtml(d.consultationName)} · ${escapeHtml(modeLabel)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Date</td><td style="padding:6px 0">${escapeHtml(d.date)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Time</td><td style="padding:6px 0">${escapeHtml(d.startTime)} – ${escapeHtml(d.endTime)}</td></tr>
          ${d.feeDisplay ? `<tr><td style="padding:6px 0;color:#64748b">Fee</td><td style="padding:6px 0">${escapeHtml(d.feeDisplay)}</td></tr>` : ""}
          ${d.appointmentId ? `<tr><td style="padding:6px 0;color:#64748b">Reference</td><td style="padding:6px 0;font-family:monospace;font-size:12px">${escapeHtml(d.appointmentId)}</td></tr>` : ""}
        </table>
        ${
          d.meetingUrl
            ? `<div style="margin:8px 0 16px;padding:16px;border-radius:10px;background:#ecfdf5;border:1px solid #a7f3d0">
                 <p style="margin:0 0 10px;color:#065f46;font-size:14px"><strong>Join your video consultation</strong></p>
                 <a href="${escapeHtml(d.meetingUrl)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px">Join Google Meet</a>
                 <p style="margin:10px 0 0;color:#047857;font-size:12px;word-break:break-all">${escapeHtml(d.meetingUrl)}</p>
               </div>`
            : ""
        }
        <p style="margin:16px 0 0;color:#475569;font-size:14px">You can view or manage this appointment anytime from the Visits tab in ${escapeHtml(clinic)}.</p>
        <p style="margin:20px 0 0;color:#94a3b8;font-size:12px">— The ${escapeHtml(clinic)} Team</p>
      </div>
    </div>
  `;
  return { subject, html };
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}