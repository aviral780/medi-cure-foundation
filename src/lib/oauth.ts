import type { Provider } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { authRedirectUrl } from "@/lib/auth-routing";

/** True when the app is rendered inside an iframe (Lovable preview, embeds). */
export function isEmbedded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export type OAuthOutcome =
  | { status: "redirecting" }
  | { status: "new-tab" }
  | { status: "popup-blocked"; url: string }
  | { status: "error"; message: string };

/**
 * Provider-agnostic Supabase OAuth entry point.
 * Works for google, facebook, github, azure, apple and any future provider —
 * no provider-specific code required.
 *
 * Inside an iframe/embedded preview the provider consent screen is opened in a
 * top-level browser tab (embedded OAuth is rejected by most providers), so the
 * flow completes on the real app origin and Supabase persists the session there.
 */
export async function signInWithProvider(
  provider: Provider,
  redirectPath = "/account",
): Promise<OAuthOutcome> {
  const redirectTo = authRedirectUrl(redirectPath);
  const embedded = isEmbedded();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: embedded },
  });

  if (error) return { status: "error", message: error.message };
  if (!embedded) return { status: "redirecting" };

  const url = data?.url;
  if (!url) return { status: "error", message: "Could not start sign in. Please try again." };

  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) return { status: "popup-blocked", url };
  return { status: "new-tab" };
}

/** Manual escape hatch used by the "Continue in New Tab" button. */
export function openOAuthUrl(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}
