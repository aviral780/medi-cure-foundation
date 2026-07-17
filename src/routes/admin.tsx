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
    const meta = (data.user.app_metadata ?? {}) as { role?: string; roles?: string[] };
    const userMeta = (data.user.user_metadata ?? {}) as { role?: string };
    const role = meta.role ?? userMeta.role;
    const isAdmin = role === "admin" || (Array.isArray(meta.roles) && meta.roles.includes("admin"));
    if (!isAdmin) throw redirect({ to: "/" });
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