import { createFileRoute } from "@tanstack/react-router";
import { requireUserId, supabaseWithUserToken } from "@/lib/razorpay.server";
import { OAUTH_CALLBACK_PATH } from "@/lib/google/google.server";

// Admin-only, token-free connection status for the Settings page.
export const Route = createFileRoute("/api/public/google/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { userId, token } = await requireUserId(request);
          const db = supabaseWithUserToken(token);
          const { data: admin } = await db
            .from("admins")
            .select("id")
            .eq("user_id", userId)
            .eq("is_active", true)
            .maybeSingle();
          if (!admin) return new Response("Forbidden", { status: 403 });

          const { data, error } = await db.rpc("google_oauth_status");
          if (error) return Response.json({ oauth_connected: false, error: error.message });
          const row = Array.isArray(data) ? data[0] : data;
          return Response.json({
            oauth_connected: Boolean(row?.oauth_connected),
            google_email: row?.google_email ?? null,
            connected_at: row?.connected_at ?? null,
            callback_path: OAUTH_CALLBACK_PATH,
          });
        } catch (err) {
          return new Response((err as Error).message, { status: 401 });
        }
      },
    },
  },
});