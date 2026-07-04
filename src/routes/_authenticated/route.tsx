import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated")({
  // Client-only gate: the browser holds the Supabase session in localStorage,
  // so SSR cannot verify auth. Skip SSR for the protected subtree.
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="grid min-h-[100dvh] place-items-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return <Outlet />;
}