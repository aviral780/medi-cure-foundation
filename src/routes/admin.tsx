import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopbar } from "@/components/admin/AdminTopbar";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: admin, error: adminError } = await supabase
      .from("admins" as never)
      .select("id, is_active")
      .eq("user_id", data.user.id)
      .eq("is_active", true)
      .maybeSingle();
    // Only demote to patient home when we have a definitive non-admin answer.
    // On transient/RLS errors, fall back to the cached admin flag written by
    // AuthProvider so a refresh doesn't kick a real admin out of /admin.
    if (!admin) {
      const cached =
        typeof window !== "undefined" &&
        window.localStorage.getItem("medicure:isAdmin") === "1";
      if (adminError && cached) return { user: data.user };
      throw redirect({ to: "/" });
    }
    return { user: data.user };
  },
  component: AdminLayout,
});

function AdminLayout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-[100dvh] bg-muted/30 text-foreground lg:flex">
      <AdminSidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar onOpenSidebar={() => setOpen(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}