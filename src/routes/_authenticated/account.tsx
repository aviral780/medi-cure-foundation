import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/account")({
  component: AccountPage,
});

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email?: string | null;
};

function AccountPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });

  async function handleSignOut() {
    await signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <AppShell>
      <section className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Account</h1>
              <p className="mt-1 text-sm text-muted-foreground">Your MediCure profile</p>
            </div>
            <Button variant="outline" onClick={handleSignOut}>Sign out</Button>
          </div>

          <dl className="mt-8 space-y-4">
            <Row label="Email" value={user?.email ?? "—"} />
            <Row
              label="Full name"
              value={isLoading ? "Loading…" : profile?.full_name ?? "—"}
            />
            <Row
              label="Phone"
              value={isLoading ? "Loading…" : profile?.phone ?? "—"}
            />
            <Row label="User ID" value={user?.id ?? "—"} mono />
          </dl>

          {error && (
            <p className="mt-4 text-sm text-destructive">
              Could not load profile: {error instanceof Error ? error.message : "Unknown error"}
            </p>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 pb-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className={`text-sm text-foreground ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}