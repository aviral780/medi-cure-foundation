import { useEffect, useRef, useState } from "react";
import { Loader2, Phone, ShieldCheck } from "lucide-react";
import type { ConfirmationResult, RecaptchaVerifier } from "firebase/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/lib/supabase";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { normalizePhone } from "@/lib/auth-routing";

function friendlyFirebaseError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  const message = err instanceof Error ? err.message : String(err ?? "");
  switch (code) {
    case "auth/invalid-phone-number":
      return "That mobile number looks invalid. Check it and try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "auth/quota-exceeded":
      return "SMS limit reached for now. Please try again later.";
    case "auth/invalid-verification-code":
      return "That code is incorrect. Please re-enter it.";
    case "auth/code-expired":
      return "That code has expired. Request a new one.";
    case "auth/captcha-check-failed":
    case "auth/missing-app-credential":
      return "Verification check failed. Reload the page and try again.";
    case "auth/network-request-failed":
      return "Network problem — check your connection and try again.";
    case "auth/operation-not-allowed":
      return "Phone sign-in isn't enabled yet. Please use Google or email for now.";
    default:
      return message || "Something went wrong. Please try again.";
  }
}

export function PhoneAuthDialog({
  open,
  onOpenChange,
  onVerified,
  fullName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: (userId: string) => void | Promise<void>;
  fullName?: string;
}) {
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const containerId = "medicure-recaptcha-container";

  useEffect(() => {
    if (!open) {
      setStep("phone");
      setCode("");
      setError(null);
      setBusy(false);
      setCooldown(0);
      confirmationRef.current = null;
      try {
        recaptchaRef.current?.clear();
      } catch {
        /* ignore */
      }
      recaptchaRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function getVerifier(): Promise<RecaptchaVerifier> {
    if (recaptchaRef.current) return recaptchaRef.current;
    const { RecaptchaVerifier } = await import("firebase/auth");
    const verifier = new RecaptchaVerifier(getFirebaseAuth(), containerId, { size: "invisible" });
    await verifier.render();
    recaptchaRef.current = verifier;
    return verifier;
  }

  async function sendOtp(target?: string) {
    if (busy || cooldown > 0) return; // guards duplicate OTP requests
    const normalized = normalizePhone(target ?? phone);
    if (!normalized) {
      setError("Enter a valid mobile number (e.g. 98765 43210 or +919876543210).");
      return;
    }
    if (!isFirebaseConfigured) {
      setError("Phone sign-in isn't available right now. Please use Google or email.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { signInWithPhoneNumber } = await import("firebase/auth");
      const verifier = await getVerifier();
      confirmationRef.current = await signInWithPhoneNumber(getFirebaseAuth(), normalized, verifier);
      setSentTo(normalized);
      setStep("otp");
      setCode("");
      setCooldown(45);
    } catch (err) {
      try {
        recaptchaRef.current?.clear();
      } catch {
        /* ignore */
      }
      recaptchaRef.current = null;
      setError(friendlyFirebaseError(err));
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(token: string) {
    if (busy) return;
    if (!confirmationRef.current) {
      setError("Please request a new code.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const credential = await confirmationRef.current.confirm(token);
      const idToken = await credential.user.getIdToken();

      // Firebase verified the number — Supabase owns the app session.
      const res = await fetch("/api/public/auth/phone-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, fullName }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { token_hash?: string; email?: string; error?: string }
        | null;
      if (!res.ok || !payload?.token_hash) {
        throw new Error(payload?.error ?? "Could not complete sign in. Please try again.");
      }

      const { data, error: sessionError } = await supabase.auth.verifyOtp({
        token_hash: payload.token_hash,
        type: "magiclink",
      });
      if (sessionError) throw sessionError;
      const userId = data.user?.id;
      if (!userId) throw new Error("Could not start your session. Please try again.");

      await onVerified(userId);
      onOpenChange(false);
    } catch (err) {
      setError(friendlyFirebaseError(err));
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {step === "phone" ? <Phone className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
          </div>
          <DialogTitle className="text-center text-xl">
            {step === "phone" ? "Continue with phone" : "Verify your number"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {step === "phone"
              ? "We'll text you a 6-digit verification code."
              : `Enter the 6-digit code sent to ${sentTo}.`}
          </DialogDescription>
        </DialogHeader>

        {step === "phone" ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void sendOtp();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="auth-phone">Mobile number</Label>
              <Input
                id="auth-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-11 rounded-xl"
                required
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" disabled={busy} className="h-11 w-full rounded-xl text-base">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy ? "Sending code…" : "Send OTP"}
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(v) => {
                  setCode(v);
                  if (v.length === 6) void verifyOtp(v);
                }}
                disabled={busy}
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} className="h-12 w-11 text-lg" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}
            <Button
              type="button"
              onClick={() => void verifyOtp(code)}
              disabled={busy || code.length !== 6}
              className="h-11 w-full rounded-xl text-base"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy ? "Verifying…" : "Verify & continue"}
            </Button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                className="font-medium text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => {
                  setStep("phone");
                  setError(null);
                  confirmationRef.current = null;
                }}
              >
                Change number
              </button>
              <button
                type="button"
                disabled={cooldown > 0 || busy}
                className="font-medium text-primary transition-opacity hover:underline disabled:opacity-50 disabled:hover:no-underline"
                onClick={() => void sendOtp(sentTo)}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
              </button>
            </div>
          </div>
        )}

        {/* Invisible reCAPTCHA host required by Firebase phone auth. */}
        <div id={containerId} />
      </DialogContent>
    </Dialog>
  );
}
