import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { AuthShell, PasswordField } from "@/components/auth/AuthPieces";
import { evaluatePassword, friendlyAuthError } from "@/lib/auth-routing";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set a new password — Vardhman Medicare" },
      { name: "description", content: "Choose a new password for your Vardhman Medicare account." },
      { property: "og:title", content: "Set a new password — Vardhman Medicare" },
      { property: "og:description", content: "Choose a new password for your Vardhman Medicare account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const strength = evaluatePassword(password);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (strength.problems.length) return setError(`Password needs ${strength.problems.join(", ")}.`);
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      toast.success("Password updated.");
      navigate({ to: "/account", replace: true });
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Set a new password" subtitle="Choose a strong password you haven't used before.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <PasswordField
          id="new-password"
          label="New password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          hint={
            password ? (
              <p className="pt-1 text-xs text-muted-foreground">
                {strength.label}
                {strength.problems.length ? ` — needs ${strength.problems.join(", ")}` : ""}
              </p>
            ) : null
          }
        />
        <PasswordField
          id="confirm-password"
          label="Confirm new password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          placeholder="Re-enter password"
        />
        {error ? (
          <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl text-base">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {busy ? "Updating…" : "Update password"}
        </Button>
      </form>
    </AuthShell>
  );
}