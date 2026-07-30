// Server-only Google OAuth + Supabase service-role helpers.
// Filename ends in `.server.ts` so it can never reach a client bundle.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";

const SUPABASE_URL = "https://gvtjlfpzxyjbcaiyonnb.supabase.co";

/** Minimum scopes: create/update/cancel events + know which account connected. */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
];

export const OAUTH_CALLBACK_PATH = "/api/public/google/oauth-callback";

function readEnv(name: string): string | undefined {
  const g = globalThis as unknown as {
    process?: { env?: Record<string, string | undefined> };
    __env__?: Record<string, string | undefined>;
  };
  return (
    (typeof process !== "undefined" && process.env && process.env[name]) ||
    g.process?.env?.[name] ||
    g.__env__?.[name] ||
    undefined
  );
}

export function googleCreds(): { clientId: string; clientSecret: string } {
  const clientId = readEnv("GOOGLE_CLIENT_ID");
  const clientSecret = readEnv("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Google is not configured: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing.");
  }
  return { clientId, clientSecret };
}

/** Exact redirect URI registered in Google Cloud Console. */
export function redirectUri(request: Request): string {
  const configured = readEnv("GOOGLE_REDIRECT_URI");
  if (configured) return configured;
  return new URL(OAUTH_CALLBACK_PATH, new URL(request.url).origin).toString();
}

/** Optional guard: only this Google account may be connected as the clinic. */
export function allowedClinicEmail(): string | undefined {
  return readEnv("GOOGLE_CLINIC_EMAIL")?.toLowerCase();
}

/** Service-role Supabase client for the external project (server only). */
export function supabaseService(): SupabaseClient | null {
  const key =
    readEnv("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? readEnv("SUPABASE_SERVICE_ROLE_KEY_EXTERNAL");
  if (!key) return null;
  return createClient(SUPABASE_URL, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

// ---------- CSRF state signing (HMAC over the client secret) ----------

export function signState(nonce: string): string {
  const { clientSecret } = googleCreds();
  const sig = createHmac("sha256", clientSecret).update(nonce).digest("hex");
  return `${nonce}.${sig}`;
}

export function verifyState(state: string | null): boolean {
  if (!state || !state.includes(".")) return false;
  const [nonce, sig] = state.split(".");
  try {
    const expected = signState(nonce).split(".")[1];
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(sig, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------- Authorization URL ----------

export function buildAuthUrl(request: Request): string {
  const { clientId } = googleCreds();
  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(request),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: GOOGLE_SCOPES.join(" "),
    state: signState(nonce),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// ---------- Token exchange / refresh ----------

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok) {
    throw new Error(json.error_description || json.error || `Google token request failed (${res.status})`);
  }
  return json;
}

export async function exchangeCodeForTokens(code: string, request: Request): Promise<TokenResponse> {
  const { clientId, clientSecret } = googleCreds();
  return tokenRequest({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri(request),
    grant_type: "authorization_code",
  });
}

export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { email?: string };
    return json.email ?? null;
  } catch {
    return null;
  }
}

export type StoredToken = {
  refresh_token: string;
  access_token: string | null;
  expires_at: string | null;
  google_email: string | null;
};

export async function saveTokens(input: {
  refreshToken: string;
  accessToken?: string | null;
  expiresIn?: number | null;
  scope?: string | null;
  email?: string | null;
}): Promise<void> {
  const db = supabaseService();
  if (!db) throw new Error("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY is not configured.");
  const expiresAt = input.expiresIn
    ? new Date(Date.now() + (input.expiresIn - 60) * 1000).toISOString()
    : null;
  const { error } = await db.from("google_oauth_tokens").upsert(
    {
      id: 1,
      refresh_token: input.refreshToken,
      access_token: input.accessToken ?? null,
      expires_at: expiresAt,
      scope: input.scope ?? null,
      google_email: input.email ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(error.message);
}

export class GoogleNotConnectedError extends Error {}
export class GoogleAuthExpiredError extends Error {}

/**
 * Returns a valid access token for the clinic account, refreshing (and caching)
 * it when needed. Throws GoogleNotConnectedError / GoogleAuthExpiredError so
 * callers can degrade gracefully instead of failing the payment flow.
 */
export async function getAccessToken(): Promise<string> {
  const db = supabaseService();
  if (!db) throw new GoogleNotConnectedError("Service role key not configured");
  const { data, error } = await db
    .from("google_oauth_tokens")
    .select("refresh_token, access_token, expires_at, google_email")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as StoredToken | null;
  if (!row?.refresh_token) throw new GoogleNotConnectedError("Google account not authorized yet");

  if (row.access_token && row.expires_at && new Date(row.expires_at).getTime() > Date.now()) {
    return row.access_token;
  }

  const { clientId, clientSecret } = googleCreds();
  let refreshed: TokenResponse;
  try {
    refreshed = await tokenRequest({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: row.refresh_token,
      grant_type: "refresh_token",
    });
  } catch (err) {
    const msg = (err as Error).message || "";
    if (/invalid_grant|expired|revoked/i.test(msg)) {
      throw new GoogleAuthExpiredError("Google authorization expired — reconnect the clinic account.");
    }
    throw err;
  }
  if (!refreshed.access_token) throw new GoogleAuthExpiredError("Google returned no access token");

  await db
    .from("google_oauth_tokens")
    .update({
      access_token: refreshed.access_token,
      expires_at: new Date(Date.now() + ((refreshed.expires_in ?? 3600) - 60) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  return refreshed.access_token;
}