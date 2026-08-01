import { supabase } from "@/lib/supabase";

const PUBLIC_APP_URL = "https://medi-cure-foundation.lovable.app";

/** Absolute URL that auth redirects (OAuth, email confirm, reset) must land on. */
export function authRedirectUrl(path: string): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isPublicApp =
      host === "medi-cure-foundation.lovable.app" ||
      host === "localhost" ||
      (!host.includes("lovable.dev") && !host.includes("lovable.app"));
    if (isPublicApp) return `${window.location.origin}${path}`;
  }
  return `${PUBLIC_APP_URL}${path}`;
}

/** Role-aware destination after a successful sign in. */
export async function resolveLandingRoute(userId: string): Promise<"/admin" | "/account"> {
  try {
    const { data } = await supabase
      .from("admins" as never)
      .select("id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (data) return "/admin";
  } catch {
    // fall through to the patient landing page
  }
  return "/account";
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export type PasswordStrength = { score: number; label: string; problems: string[] };

export function evaluatePassword(password: string): PasswordStrength {
  const problems: string[] = [];
  if (password.length < 8) problems.push("at least 8 characters");
  if (!/[A-Z]/.test(password)) problems.push("an uppercase letter");
  if (!/[a-z]/.test(password)) problems.push("a lowercase letter");
  if (!/[0-9]/.test(password)) problems.push("a number");
  const score = 4 - problems.length;
  const label = ["Too weak", "Weak", "Fair", "Good", "Strong"][Math.max(0, score)] ?? "Weak";
  return { score: Math.max(0, score), label, problems };
}

/** E.164 normalisation, defaulting bare 10-digit numbers to India (+91). */
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.replace(/[\s()-]/g, "");
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return null;
}

export function friendlyAuthError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err ?? "");
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "That email or password is incorrect.";
  if (m.includes("email not confirmed")) return "Please confirm your email before signing in.";
  if (m.includes("user already registered")) return "An account with this email already exists. Try signing in.";
  if (m.includes("token has expired") || m.includes("invalid otp") || m.includes("expired"))
    return "That code is invalid or has expired. Request a new one.";
  if (m.includes("unsupported phone provider") || m.includes("phone provider") || m.includes("sms"))
    return "Phone sign-in isn't enabled yet. Please use Google or email for now.";
  if (m.includes("unsupported provider") || m.includes("provider is not enabled"))
    return "Google sign-in isn't enabled yet. Please use email for now.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many attempts. Please wait a moment and try again.";
  if (m.includes("failed to fetch")) return "Network problem — check your connection and try again.";
  return message || "Something went wrong. Please try again.";
}