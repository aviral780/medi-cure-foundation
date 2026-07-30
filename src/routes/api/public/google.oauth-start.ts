import { createFileRoute } from "@tanstack/react-router";
import { buildAuthUrl } from "@/lib/google/google.server";

// One-time admin step: open this URL in a browser and grant Calendar access
// with the clinic's Google account. Starting the flow is harmless; the
// callback verifies the signed state and (optionally) the allowed account.
export const Route = createFileRoute("/api/public/google/oauth-start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          return Response.redirect(buildAuthUrl(request), 302);
        } catch (err) {
          return new Response((err as Error).message, { status: 500 });
        }
      },
    },
  },
});