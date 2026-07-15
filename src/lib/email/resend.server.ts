// Reusable server-side Resend email service.
// Uses the RESEND_API_KEY from Cloud Secrets. Never import this from client code.

export const DEFAULT_FROM = "Resend <onboarding@resend.dev>";

// Read RESEND_API_KEY from every runtime shape this app can encounter.
//
// On the modern TanStack Start stack we execute in two different runtimes:
//   1. Vite dev SSR (Node) — secrets are on `process.env` inherited from the
//      sandbox OS environment.
//   2. Cloudflare Workers (published + preview) — Cloud Secrets are bound onto
//      the per-request `env` object; nodejs_compat mirrors them onto
//      `process.env`, but only after Nitro's request hook copies them in.
//      Anything read at module scope is empty, and depending on bundling
//      order a handler-time `process.env.X` lookup can still miss.
//
// We therefore probe process.env, globalThis.process.env, and any Nitro-exposed
// Cloudflare env binding, in that order, so the key resolves in every runtime
// where a Cloud Secret named RESEND_API_KEY is available.
function readResendApiKey(): string | undefined {
  const g = globalThis as unknown as {
    process?: { env?: Record<string, string | undefined> };
    __env__?: Record<string, string | undefined>;
  };
  const fromProcess =
    (typeof process !== "undefined" && process.env && process.env.RESEND_API_KEY) ||
    g.process?.env?.RESEND_API_KEY;
  if (fromProcess) return fromProcess;

  // Nitro exposes the Cloudflare per-request env under a few well-known names
  // depending on preset version. Check them defensively.
  const nitroEnv = g.__env__?.RESEND_API_KEY;
  if (nitroEnv) return nitroEnv;

  return undefined;
}

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