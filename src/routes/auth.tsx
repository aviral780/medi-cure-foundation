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

const PUBLIC_APP_URL = "https://medi-cure-foundation.lovable.app";

function getEmailRedirectUrl(): string {
  // Email confirmation links must land on the public MediCure app,
  // never on a preview/lovable.dev host.
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isPublicApp =
      host === "medi-cure-foundation.lovable.app" ||
      (!host.includes("lovable.dev") && !host.includes("lovable.app") && host !== "localhost");
    if (isPublicApp) return `${window.location.origin}/account`;
  }
  return `${PUBLIC_APP_URL}/account`;
}

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
    if (!loading && user) {
      void routeAfterLogin(user.id, navigate);
    }
  }, [loading, user, navigate]);

  async function routeAfterLogin(
    userId: string,
    nav: ReturnType<typeof useNavigate>,
  ) {
    try {
      const { data } = await supabase
        .from("admins" as never)
        .select("id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();
      if (data) {
        nav({ to: "/admin", replace: true });
        return;
      }
    } catch {
      // fall through to patient home
    }
    nav({ to: "/account", replace: true });
  }

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
            emailRedirectTo: getEmailRedirectUrl(),
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
        await routeAfterLogin(data.session.user.id, navigate);
      } else {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error) throw error;
        toast.success("Welcome back!");
        router.invalidate();
        if (signInData.user) {
          await routeAfterLogin(signInData.user.id, navigate);
        } else {
          navigate({ to: "/account", replace: true });
        }
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