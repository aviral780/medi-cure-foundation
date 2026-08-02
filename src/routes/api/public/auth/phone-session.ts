import { createFileRoute } from "@tanstack/react-router";
import { jsonError, jsonOk } from "@/lib/razorpay.server";
import {
  phoneIdentityEmail,
  supabaseAuthAdmin,
  verifyFirebaseIdToken,
} from "@/lib/phone-auth.server";

/**
 * Firebase verifies the phone number; Supabase owns the application session.
 *
 * The client posts the Firebase ID token, we verify it server-side, then find
 * (or create) the matching Supabase user and hand back a one-time magic-link
 * token the browser exchanges for a real Supabase session.
 */
export const Route = createFileRoute("/api/public/auth/phone-session")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => null)) as
            | { idToken?: string; fullName?: string }
            | null;
          if (!body?.idToken) return jsonError(400, "Missing verification token.");

          const { phone } = await verifyFirebaseIdToken(body.idToken);
          const email = phoneIdentityEmail(phone);

          const db = supabaseAuthAdmin();
          if (!db) return jsonError(500, "Phone sign-in is not available right now.");

          const linkOptions = { type: "magiclink" as const, email };
          let { data, error } = await db.auth.admin.generateLink(linkOptions);

          if (error) {
            const msg = (error.message ?? "").toLowerCase();
            const missing =
              msg.includes("not found") || msg.includes("no user") || msg.includes("does not exist");
            if (!missing) return jsonError(500, "Could not complete sign in. Please try again.");

            const created = await db.auth.admin.createUser({
              email,
              phone,
              email_confirm: true,
              phone_confirm: true,
              user_metadata: {
                phone,
                signup_method: "phone",
                ...(body.fullName ? { full_name: body.fullName } : {}),
              },
            });
            if (created.error) {
              return jsonError(500, "Could not create your account. Please try again.");
            }
            ({ data, error } = await db.auth.admin.generateLink(linkOptions));
            if (error) return jsonError(500, "Could not complete sign in. Please try again.");
          }

          const tokenHash = (data as any)?.properties?.hashed_token;
          const userId = (data as any)?.user?.id;
          if (!tokenHash) return jsonError(500, "Could not complete sign in. Please try again.");

          // Best-effort: keep the profile phone in sync. Never blocks sign in.
          try {
            await db.from("profiles").update({ phone }).eq("id", userId);
          } catch {
            /* ignore */
          }

          return jsonOk({ token_hash: tokenHash, email, user_id: userId });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not verify your phone number.";
          return jsonError(400, message);
        }
      },
    },
  },
});
