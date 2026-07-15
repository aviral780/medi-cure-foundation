// Reusable server-side Resend email service.
// Uses the RESEND_API_KEY from Cloud Secrets. Never import this from client code.

export const DEFAULT_FROM = "Resend <onboarding@resend.dev>";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
};

export type SendEmailResult =
  | { ok: true; sent: true; id?: string }
  | { ok: true; sent: false; reason: string; detail?: string };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const resendKey = readResendApiKey();
  if (!resendKey) {
    return { ok: true, sent: false, reason: "email_not_configured" };
  }
  const recipients = Array.isArray(input.to) ? input.to : [input.to];
  if (recipients.length === 0 || recipients.some((r) => !r)) {
    return { ok: true, sent: false, reason: "no_recipient" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: input.from ?? DEFAULT_FROM,
        to: recipients,
        subject: input.subject,
        html: input.html,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: true,
        sent: false,
        reason: `resend_${res.status}`,
        detail: text.slice(0, 300),
      };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, sent: true, id: data?.id };
  } catch (err) {
    return {
      ok: true,
      sent: false,
      reason: "exception",
      detail: (err as Error).message,
    };
  }
}