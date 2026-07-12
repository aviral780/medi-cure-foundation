// Server-only Razorpay + external-Supabase helpers.
// Never imported from client code — filename ends in `.server.ts`.

import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// MediCure connects to an external Supabase project directly (not Lovable Cloud).
// Matches src/lib/supabase.ts.
const SUPABASE_URL = "https://gvtjlfpzxyjbcaiyonnb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_U3WXZUCeEL8fFbPNj0bqcg_jFoCUUAn";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function supabaseFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    if (isNewSupabaseApiKey(key) && headers.get("Authorization") === `Bearer ${key}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

export function supabaseWithUserToken(userToken: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: supabaseFetch(SUPABASE_PUBLISHABLE_KEY),
      headers: { Authorization: `Bearer ${userToken}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export async function requireUserId(request: Request): Promise<{ userId: string; token: string }> {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) {
    throw new HttpError(401, "Missing bearer token");
  }
  const token = auth.slice(7).trim();
  if (!token) throw new HttpError(401, "Missing bearer token");
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY },
  });
  if (!res.ok) throw new HttpError(401, "Invalid session");
  const data = (await res.json()) as { id?: string };
  if (!data?.id) throw new HttpError(401, "Invalid session");
  return { userId: data.id, token };
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function jsonOk(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

// ---------- Razorpay REST helpers ----------

function razorpayCreds(): { keyId: string; keySecret: string } {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new HttpError(
      503,
      "Razorpay is not configured yet. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable payments.",
    );
  }
  return { keyId, keySecret };
}

function basicAuth(keyId: string, keySecret: string): string {
  const enc = typeof Buffer !== "undefined"
    ? Buffer.from(`${keyId}:${keySecret}`).toString("base64")
    : btoa(`${keyId}:${keySecret}`);
  return `Basic ${enc}`;
}

export async function razorpayCreateOrder(input: {
  amountPaise: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<{ id: string; amount: number; currency: string; keyId: string }> {
  const { keyId, keySecret } = razorpayCreds();
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: basicAuth(keyId, keySecret) },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes ?? {},
      payment_capture: 1,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    throw new HttpError(502, json?.error?.description || "Razorpay order creation failed");
  }
  return { id: json.id, amount: json.amount, currency: json.currency, keyId };
}

export async function razorpayFetchPayment(paymentId: string): Promise<{ method: string | null; status: string }> {
  const { keyId, keySecret } = razorpayCreds();
  const res = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { authorization: basicAuth(keyId, keySecret) },
  });
  if (!res.ok) return { method: null, status: "unknown" };
  const json = (await res.json().catch(() => ({}))) as any;
  return { method: json?.method ?? null, status: json?.status ?? "unknown" };
}

export function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean {
  const { keySecret } = razorpayCreds();
  const expected = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}