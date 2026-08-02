import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://gvtjlfpzxyjbcaiyonnb.supabase.co";

function readEnv(name: string): string | undefined {
  const v = (globalThis as any)?.process?.env?.[name];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/** Service-role client that sends both apikey and Authorization (GoTrue admin needs both). */
export function supabaseAuthAdmin(): SupabaseClient | null {
  const key =
    readEnv("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? readEnv("SUPABASE_SERVICE_ROLE_KEY_EXTERNAL");
  if (!key) return null;
  return createClient(SUPABASE_URL, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("apikey", key);
        headers.set("Authorization", `Bearer ${key}`);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

function firebaseApiKey(): string | undefined {
  return (
    readEnv("FIREBASE_API_KEY") ??
    readEnv("VITE_FIREBASE_API_KEY") ??
    "AIzaSyAZ7KWWUhkaHFDy6cbWZ-ISMfzBv4KvUu0"
  );
}

/**
 * Verifies a Firebase ID token with Google's Identity Toolkit and returns the
 * verified phone number. Never trusts a phone number sent by the client.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<{ phone: string; uid: string }> {
  const key = firebaseApiKey();
  if (!key) throw new Error("Phone sign-in is not configured.");
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    },
  );
  const json = (await res.json().catch(() => null)) as any;
  if (!res.ok) throw new Error(json?.error?.message ?? "Could not verify that code.");
  const user = json?.users?.[0];
  const phone: string | undefined = user?.phoneNumber;
  if (!phone) throw new Error("That verification did not include a phone number.");
  return { phone, uid: user.localId as string };
}

/** Deterministic, email-safe identity for a verified phone number. */
export function phoneIdentityEmail(phone: string): string {
  return `p${phone.replace(/\D/g, "")}@phone.vardhmanmedicare.app`;
}
