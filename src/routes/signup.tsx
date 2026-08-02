import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthDivider, AuthShell, PasswordField, SocialAuthButtons } from "@/components/auth/AuthPieces";
import { PhoneAuthDialog } from "@/components/auth/PhoneAuthDialog";
import { openOAuthUrl, signInWithProvider } from "@/lib/oauth";
import {
  authRedirectUrl,
  evaluatePassword,
  friendlyAuthError,
  isValidEmail,
  resolveLandingRoute,
} from "@/lib/auth-routing";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create account — Vardhman Medicare" },
      { name: "description", content: "Create your Vardhman Medicare account with Google, phone number, or email to book consultations." },
      { property: "og:title", content: "Create account — Vardhman Medicare" },
      { property: "og:description", content: "Join Vardhman Medicare to book in-person and online consultations." },
    ],
  }),
  component: SignUpPage,
});

function SignUpPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedUrl, setBlockedUrl] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);

  const strength = evaluatePassword(password);

  async function go(userId: string) {
    const to = await resolveLandingRoute(userId);
    router.invalidate();
    navigate({ to, replace: true });
  }

  useEffect(() => {
    if (!loading && user && !confirmationEmail) void go(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  async function onGoogle() {
    setGoogleLoading(true);
    setError(null);
    setBlockedUrl(null);
    const outcome = await signInWithProvider("google", "/account");
    if (outcome.status === "error") {
      setError(friendlyAuthError(new Error(outcome.message)));
      setGoogleLoading(false);
    } else if (outcome.status === "popup-blocked") {
      setBlockedUrl(outcome.url);
      setError("Your browser blocked the sign-in window.");
      setGoogleLoading(false);
    } else if (outcome.status === "new-tab") {
      setGoogleLoading(false);
      toast.success("Continue signing in with Google in the new tab.");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = fullName.trim();
    const normalizedEmail = email.trim();
    if (!name) return setError("Please enter your full name.");
    if (!isValidEmail(normalizedEmail)) return setError("Enter a valid email address.");
    if (strength.problems.length) return setError(`Password needs ${strength.problems.join(", ")}.`);
    if (password !== confirm) return setError("Passwords do not match.");

    setSubmitting(true);
    setError(null);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: authRedirectUrl("/account"),
          data: { full_name: name },
        },
      });
      if (signUpError) throw signUpError;

      if (!data.session) {
        setConfirmationEmail(normalizedEmail);
        toast.success("Check your email to confirm your account.");
        return;
      }
      toast.success("Account created.");
      await go(data.session.user.id);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmationEmail) {
    return (
      <AuthShell title="Check your email" subtitle={`We sent a confirmation link to ${confirmationEmail}.`}>
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MailCheck className="h-7 w-7" />
          </span>
          <p className="text-sm leading-6 text-muted-foreground">
            Confirm your account from that email, then sign in to continue.
          </p>
          <Button asChild className="h-11 w-full rounded-xl text-base">
            <Link to="/auth">Back to sign in</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Book doctors and manage every visit in one place."
      footer={
        <>
          <span>Already have an account? </span>
          <Link to="/auth" className="font-medium text-primary hover:underline">
            Sign In
          </Link>
        </>
      }
    >
      <SocialAuthButtons
        onGoogle={() => void onGoogle()}
        onPhone={() => setPhoneOpen(true)}
        googleLoading={googleLoading}
        disabled={submitting}
      />

      <AuthDivider />

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            autoComplete="name"
            placeholder="Your name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="h-11 rounded-xl"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 rounded-xl"
            required
          />
        </div>

        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          hint={
            password ? (
              <div className="space-y-1.5 pt-1">
                <div className="flex gap-1" aria-hidden>
                  {[1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        i <= strength.score ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {strength.label}
                  {strength.problems.length ? ` — needs ${strength.problems.join(", ")}` : ""}
                </p>
              </div>
            ) : null
          }
        />

        <PasswordField
          id="confirm"
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          placeholder="Re-enter password"
          hint={
            confirm && confirm === password ? (
              <p className="flex items-center gap-1 pt-1 text-xs text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" /> Passwords match
              </p>
            ) : null
          }
        />

        {error ? (
          <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {blockedUrl ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-xl"
            onClick={() => openOAuthUrl(blockedUrl)}
          >
            Continue in New Tab
          </Button>
        ) : null}

        <Button type="submit" disabled={submitting} className="h-12 w-full rounded-xl text-base">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitting ? "Creating account…" : "Create Account"}
        </Button>
      </form>

      <PhoneAuthDialog
        open={phoneOpen}
        onOpenChange={setPhoneOpen}
        fullName={fullName.trim() || undefined}
        onVerified={async (userId) => {
          toast.success("Phone verified.");
          await go(userId);
        }}
      />
    </AuthShell>
  );
}