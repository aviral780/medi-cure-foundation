import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthDivider, AuthShell, PasswordField, SocialAuthButtons } from "@/components/auth/AuthPieces";
import { PhoneAuthDialog } from "@/components/auth/PhoneAuthDialog";
import {
  authRedirectUrl,
  friendlyAuthError,
  isValidEmail,
  resolveLandingRoute,
} from "@/lib/auth-routing";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Vardhman Medicare" },
      { name: "description", content: "Sign in to Vardhman Medicare with Google, your phone number, or email to manage appointments." },
      { property: "og:title", content: "Sign in — Vardhman Medicare" },
      { property: "og:description", content: "Secure sign in for patients and clinic staff at Vardhman Medicare." },
    ],
  }),
  component: SignInPage,
});

function SignInPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go(userId: string) {
    const to = await resolveLandingRoute(userId);
    router.invalidate();
    navigate({ to, replace: true });
  }

  useEffect(() => {
    if (!loading && user) void go(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  async function onGoogle() {
    setGoogleLoading(true);
    setError(null);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: authRedirectUrl("/account") },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      setError(friendlyAuthError(err));
      setGoogleLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalizedEmail = email.trim();
    if (!isValidEmail(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (signInError) throw signInError;
      toast.success("Welcome back!");
      if (data.user) await go(data.user.id);
      else navigate({ to: "/account", replace: true });
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to book consultations and manage your visits."
      footer={
        <>
          <span>Don't have an account? </span>
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Create Account
          </Link>
          <div className="mt-3 text-xs">
            <Link to="/" className="hover:underline">← Back to home</Link>
          </div>
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
          autoComplete="current-password"
          placeholder="••••••••"
        />

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>

        {error ? (
          <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={submitting} className="h-12 w-full rounded-xl text-base">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitting ? "Signing in…" : "Sign In"}
        </Button>
      </form>

      <PhoneAuthDialog
        open={phoneOpen}
        onOpenChange={setPhoneOpen}
        onVerified={async (userId) => {
          toast.success("Phone verified.");
          await go(userId);
        }}
      />
    </AuthShell>
  );
}