// Reusable reschedule confirmation email template.

export type RescheduleConfirmationData = {
  patientName?: string | null;
  doctorName: string;
  consultationName: string;
  mode: "online" | "in_person" | string;
  previousDate: string;
  previousStartTime: string;
  previousEndTime: string;
  newDate: string;
  newStartTime: string;
  newEndTime: string;
  feeDisplay?: string | null;
  appointmentId?: string | null;
};

export function renderRescheduleConfirmationEmail(d: RescheduleConfirmationData): {
  subject: string;
  html: string;
} {
  const modeLabel = d.mode === "online" ? "Video consultation" : "In-person";
  const greetingName = d.patientName?.trim() ? d.patientName : "there";
  const subject = `Your MediCure appointment with ${d.doctorName} has been rescheduled`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:24px">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;color:#0f172a;border:1px solid #e2e8f0">
        <h2 style="margin:0 0 8px;font-size:20px;color:#0f766e">Appointment rescheduled</h2>
        <p style="margin:0 0 16px;color:#334155">Hi ${escapeHtml(greetingName)}, your appointment has been rescheduled successfully.</p>
        <table style="width:100%;border-collapse:collapse;margin:8px 0 16px">
          <tr><td style="padding:6px 0;color:#64748b;width:38%">Doctor</td><td style="padding:6px 0"><strong>${escapeHtml(d.doctorName)}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Consultation</td><td style="padding:6px 0">${escapeHtml(d.consultationName)} · ${escapeHtml(modeLabel)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Previous time</td><td style="padding:6px 0;text-decoration:line-through;color:#64748b">${escapeHtml(d.previousDate)} · ${escapeHtml(d.previousStartTime)} – ${escapeHtml(d.previousEndTime)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">New time</td><td style="padding:6px 0"><strong>${escapeHtml(d.newDate)} · ${escapeHtml(d.newStartTime)} – ${escapeHtml(d.newEndTime)}</strong></td></tr>
          ${d.feeDisplay ? `<tr><td style="padding:6px 0;color:#64748b">Reschedule fee</td><td style="padding:6px 0">${escapeHtml(d.feeDisplay)}</td></tr>` : ""}
          ${d.appointmentId ? `<tr><td style="padding:6px 0;color:#64748b">Reference</td><td style="padding:6px 0;font-family:monospace;font-size:12px">${escapeHtml(d.appointmentId)}</td></tr>` : ""}
        </table>
        <p style="margin:16px 0 0;color:#475569;font-size:14px">See you at your new appointment time. You can manage this appointment anytime from the Visits tab in MediCure.</p>
        <p style="margin:20px 0 0;color:#94a3b8;font-size:12px">— The MediCure Team</p>
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