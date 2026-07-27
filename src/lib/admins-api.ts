import { supabase } from "@/lib/supabase";

export type AdminRole = "admin" | "super_admin";

export type AdminRow = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: AdminRole;
  is_active: boolean;
  created_at: string | null;
};

export function roleLabel(role: AdminRole): string {
  return role === "super_admin" ? "Super Admin" : "Admin";
}

function translate(message: string): string {
  if (message.includes("not_authorized")) return "Only a Super Admin can perform this action.";
  if (message.includes("user_not_found")) return "No account found with that email. Ask them to sign up first.";
  if (message.includes("invalid_role")) return "Invalid role.";
  if (message.includes("cannot_remove_self")) return "You cannot remove your own admin access.";
  if (message.includes("cannot_disable_self")) return "You cannot disable your own admin access.";
  return message;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) throw new Error(translate(error.message ?? "Request failed"));
  return data as T;
}

export async function fetchAdmins(): Promise<AdminRow[]> {
  const data = await rpc<AdminRow[]>("admin_list_admins", {});
  return (data ?? []) as AdminRow[];
}

export function inviteAdmin(email: string, role: AdminRole) {
  return rpc<string>("admin_upsert_admin_by_email", { p_email: email, p_role: role });
}

export function setAdminRole(adminId: string, role: AdminRole) {
  return rpc<null>("admin_set_admin_role", { p_admin_id: adminId, p_role: role });
}

export function setAdminActive(adminId: string, active: boolean) {
  return rpc<null>("admin_set_admin_active", { p_admin_id: adminId, p_active: active });
}

export function removeAdmin(adminId: string) {
  return rpc<null>("admin_remove_admin", { p_admin_id: adminId });
}