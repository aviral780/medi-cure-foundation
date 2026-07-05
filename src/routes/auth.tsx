import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/account", replace: true });
  }, [loading, user, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalizedEmail = email.trim();
    const normalizedFullName = fullName.trim();
    const normalizedPhone = phone.trim();

    if (!normalizedEmail || !password || (mode === "signup" && (!normalizedFullName || !normalizedPhone))) {
      toast.error("Please complete all required fields.");
      return;
    }

    setSubmitting(true);
    setConfirmationEmail(null);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/account`,
            data: {
              full_name: normalizedFullName,
              phone: normalizedPhone,
            },
          },
        });
        if (error) throw error;

        if (!data.session) {
          setConfirmationEmail(normalizedEmail);
          toast.success("Check your email to confirm your account.");
          return;
        }

        toast.success("Account created.");
        router.invalidate();
        navigate({ to: "/account", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error) throw error;
        toast.success("Welcome back!");
        router.invalidate();
        navigate({ to: "/account", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <section className="mx-auto max-w-md px-4 py-10 sm:px-6 sm:py-16">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] sm:p-8">
          {confirmationEmail ? (
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Check your email
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                We sent a confirmation link to {confirmationEmail}. Confirm your account, then sign in to continue.
              </p>
              <Button className="mt-6 h-11 w-full rounded-xl text-base" onClick={() => setConfirmationEmail(null)}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {mode === "login"
              ? "Sign in to manage appointments and profile."
              : "Book doctors and manage visits in one place."}
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            <Button type="submit" disabled={submitting} className="h-11 w-full rounded-xl text-base">
              {submitting ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "login" ? "New to MediCure?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setConfirmationEmail(null);
              }}
            >
              {mode === "login" ? "Create account" : "Sign in"}
            </button>
          </p>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:underline">← Back to home</Link>
          </p>
            </>
          )}
        </div>
      </section>
    </AppShell>
  );
}