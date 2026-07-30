import { createFileRoute } from "@tanstack/react-router";
import {
  allowedClinicEmail,
  exchangeCodeForTokens,
  fetchGoogleEmail,
  saveTokens,
  verifyState,
} from "@/lib/google/google.server";

function page(title: string, message: string, ok: boolean): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:system-ui,sans-serif;background:#f6f8fb;margin:0;display:grid;place-items:center;height:100vh">
<div style="max-width:420px;background:#fff;border-radius:16px;padding:32px;box-shadow:0 10px 30px rgba(0,0,0,.08);text-align:center">
<div style="font-size:40px">${ok ? "✅" : "⚠️"}</div>
<h1 style="font-size:18px;margin:12px 0 8px">${title}</h1>
<p style="color:#5b6472;font-size:14px;line-height:1.5;margin:0">${message}</p>
<a href="/admin/settings" style="display:inline-block;margin-top:20px;color:#0f766e;font-size:14px">Back to settings</a>
</div></body></html>`,
    { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/api/public/google/oauth-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const error = url.searchParams.get("error");
        if (error) return page("Authorization cancelled", `Google returned: ${error}`, false);

        const code = url.searchParams.get("code");
        if (!code) return page("Missing authorization code", "Please start the flow again.", false);
        if (!verifyState(url.searchParams.get("state"))) {
          return page("Invalid request", "The authorization state could not be verified.", false);
        }

        try {
          const tokens = await exchangeCodeForTokens(code, request);
          if (!tokens.refresh_token) {
            return page(
              "No refresh token received",
              "Remove MediCure from your Google account permissions and authorize again so Google issues offline access.",
              false,
            );
          }

          const email = tokens.access_token ? await fetchGoogleEmail(tokens.access_token) : null;
          const allowed = allowedClinicEmail();
          if (allowed && email && email.toLowerCase() !== allowed) {
            return page(
              "Account not allowed",
              `Only ${allowed} can be connected as the clinic calendar.`,
              false,
            );
          }

          await saveTokens({
            refreshToken: tokens.refresh_token,
            accessToken: tokens.access_token ?? null,
            expiresIn: tokens.expires_in ?? null,
            scope: tokens.scope ?? null,
            email,
          });

          return page(
            "Google Calendar connected",
            `${email ?? "The clinic account"} is now authorized. Online consultations will get a Google Meet link automatically.`,
            true,
          );
        } catch (err) {
          return page("Could not connect Google", (err as Error).message, false);
        }
      },
    },
  },
});