import { useEffect, useState } from "react";
import { Loader2, Phone, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/lib/supabase";
import { friendlyAuthError, normalizePhone } from "@/lib/auth-routing";

export function PhoneAuthDialog({
  open,
  onOpenChange,
  onVerified,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: (userId: string) => void | Promise<void>;
}) {
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!open) {
      setStep("phone");
      setCode("");
      setError(null);
      setBusy(false);
      setCooldown(0);
    }
  }, [open]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendOtp(target?: string) {
    const normalized = normalizePhone(target ?? phone);
    if (!normalized) {
      setError("Enter a valid mobile number (e.g. 98765 43210 or +919876543210).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({ phone: normalized });
      if (otpError) throw otpError;
      setSentTo(normalized);
      setStep("otp");
      setCode("");
      setCooldown(45);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(token: string) {
    setBusy(true);
    setError(null);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: sentTo,
        token,
        type: "sms",
      });
      if (verifyError) throw verifyError;
      const userId = data.user?.id;
      if (!userId) throw new Error("Verification failed. Please try again.");
      await onVerified(userId);
      onOpenChange(false);
    } catch (err) {
      setError(friendlyAuthError(err));
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
      </DialogContent>
    </Dialog>
  );
}