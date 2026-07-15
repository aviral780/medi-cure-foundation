// Reusable cancellation confirmation email template.

export type CancellationConfirmationData = {
  patientName?: string | null;
  doctorName: string;
  consultationName: string;
  mode: "online" | "in_person" | string;
  date: string;
  startTime: string;
  endTime: string;
  reason?: string | null;
  appointmentId?: string | null;
};

export function renderCancellationConfirmationEmail(d: CancellationConfirmationData): {
  subject: string;
  html: string;
} {
  const modeLabel = d.mode === "online" ? "Video consultation" : "In-person";
  const greetingName = d.patientName?.trim() ? d.patientName : "there";
  const subject = `Your MediCure appointment with ${d.doctorName} has been cancelled`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:24px">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;color:#0f172a;border:1px solid #e2e8f0">
        <h2 style="margin:0 0 8px;font-size:20px;color:#b91c1c">Appointment cancelled</h2>
        <p style="margin:0 0 16px;color:#334155">Hi ${escapeHtml(greetingName)}, this is a confirmation that the following appointment has been cancelled.</p>
        <table style="width:100%;border-collapse:collapse;margin:8px 0 16px">
          <tr><td style="padding:6px 0;color:#64748b;width:38%">Doctor</td><td style="padding:6px 0"><strong>${escapeHtml(d.doctorName)}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Consultation</td><td style="padding:6px 0">${escapeHtml(d.consultationName)} · ${escapeHtml(modeLabel)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Date</td><td style="padding:6px 0">${escapeHtml(d.date)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Time</td><td style="padding:6px 0">${escapeHtml(d.startTime)} – ${escapeHtml(d.endTime)}</td></tr>
          ${d.reason ? `<tr><td style="padding:6px 0;color:#64748b">Reason</td><td style="padding:6px 0">${escapeHtml(d.reason)}</td></tr>` : ""}
          ${d.appointmentId ? `<tr><td style="padding:6px 0;color:#64748b">Reference</td><td style="padding:6px 0;font-family:monospace;font-size:12px">${escapeHtml(d.appointmentId)}</td></tr>` : ""}
        </table>
        <p style="margin:16px 0 0;color:#475569;font-size:14px">The time slot has been released. If this was a mistake, you can book again anytime from the MediCure app.</p>
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