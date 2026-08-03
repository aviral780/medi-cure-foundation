import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Loader2, Plus, Trash2 } from "lucide-react";
import {
  NOTIFICATION_DEFAULTS, setNotificationSetting, useNotificationSettings,
  type NotificationSettingKey,
} from "@/lib/notification-settings";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import type { ClinicInfo } from "@/lib/clinic-constants";
import {
  clinicSettingsQueryKey, fetchClinicSettings, normalizeWebsite, saveClinicSettings,
  validateClinic, type ClinicValidationErrors,
} from "@/lib/clinic-settings";
import {
  fetchAdmins, inviteAdmin, removeAdmin, roleLabel, setAdminActive, setAdminRole,
  type AdminRole,
} from "@/lib/admins-api";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configure clinic information, admins and notifications.</p>
      </header>

      <Tabs defaultValue="clinic" className="space-y-4">
        <TabsList className="rounded-xl">
          <TabsTrigger value="clinic">Clinic Information</TabsTrigger>
          <TabsTrigger value="admins">Admin Users</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="clinic">
          <ClinicInformationTab />
        </TabsContent>

        <TabsContent value="admins">
          <AdminUsersTab />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationsTab />
        </TabsContent>

        <TabsContent value="integrations">
          <GoogleCalendarTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GoogleCalendarTab() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["google-calendar-status"],
    queryFn: async () => {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const res = await fetch("/api/public/google/status", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as {
        oauth_connected: boolean;
        google_email: string | null;
        connected_at: string | null;
      };
    },
  });

  const connected = Boolean(data?.oauth_connected);

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-start gap-3">
        <CalendarCheck className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Google Calendar &amp; Meet</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Online consultations automatically get a Google Calendar event with a Google Meet link
            once payment is confirmed. Rescheduling moves the event; cancelling removes it.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {isLoading ? (
              <span className="text-xs text-muted-foreground">Checking connection…</span>
            ) : connected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                Connected{data?.google_email ? ` · ${data.google_email}` : ""}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                Not connected
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild className="h-10 rounded-lg">
              <a href="/api/public/google/oauth-start">
                {connected ? "Reconnect Google account" : "Connect Google account"}
              </a>
            </Button>
            <Button
              variant="outline"
              className="h-10 rounded-lg"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              {isFetching ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Refresh status
            </Button>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Sign in with the clinic's Google account and approve calendar access. The connection is
            stored securely on the server and refreshes itself automatically.
          </p>
        </div>
      </div>
    </section>
  );
}

const NOTIFICATION_ROWS: Array<{
  key: NotificationSettingKey; title: string; desc: string; note?: string;
}> = [
  { key: "email_confirmations", title: "Email confirmations", desc: "Send booking, confirmation, reschedule and cancellation emails to patients." },
  { key: "reschedule_notifications", title: "Reschedule notifications", desc: "Notify patients whenever their appointment date or time changes." },
  { key: "cancellation_notifications", title: "Cancellation notifications", desc: "Notify patients whenever an appointment is cancelled." },
  { key: "daily_digest", title: "Daily digest to admins", desc: "Generate one concise daily summary of clinic activity for admins." },
  { key: "sms_reminders", title: "SMS reminders", desc: "Send a reminder SMS one hour before each appointment.", note: "Delivery provider not connected yet — schedule is prepared." },
];

function NotificationsTab() {
  const settings = useNotificationSettings();

  function onToggle(key: NotificationSettingKey, title: string, value: boolean) {
    setNotificationSetting(key, value);
    toast.success(`${title} ${value ? "enabled" : "disabled"}`);
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="mb-5">
        <h2 className="text-base font-semibold">Notifications</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Changes save automatically. Defaults:{" "}
          {Object.values(NOTIFICATION_DEFAULTS).filter(Boolean).length} of{" "}
          {Object.keys(NOTIFICATION_DEFAULTS).length} enabled.
        </p>
      </div>
      <div className="space-y-3">
        {NOTIFICATION_ROWS.map((row) => {
          const on = settings[row.key];
          return (
            <div
              key={row.key}
              className="flex items-start justify-between gap-4 rounded-2xl border border-border/60 p-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{row.title}</span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                      on
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
                    {on ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{row.desc}</p>
                {row.note && <p className="mt-1 text-[11px] text-muted-foreground/80">{row.note}</p>}
              </div>
              <Switch
                checked={on}
                aria-label={row.title}
                onCheckedChange={(v) => onToggle(row.key, row.title, v)}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

const EMPTY_CLINIC: ClinicInfo = {
  name: "", phone: "", email: "", website: "", address: "", working_hours: "",
};

function ClinicInformationTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: clinicSettingsQueryKey, queryFn: fetchClinicSettings });
  const [form, setForm] = useState<ClinicInfo>(EMPTY_CLINIC);
  const [errors, setErrors] = useState<ClinicValidationErrors>({});

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: (input: ClinicInfo) => saveClinicSettings(input),
    onSuccess: (info) => {
      qc.setQueryData(clinicSettingsQueryKey, info);
      qc.invalidateQueries({ queryKey: clinicSettingsQueryKey });
      toast.success("Clinic information saved");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save clinic information"),
  });

  function set<K extends keyof ClinicInfo>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function onSave() {
    const next: ClinicInfo = { ...form, website: normalizeWebsite(form.website) };
    const found = validateClinic(next);
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    save.mutate(next);
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="clinicName" label="Clinic name" value={form.name} error={errors.name}
          onChange={(v) => set("name", v)} disabled={isLoading} />
        <Field id="clinicPhone" label="Phone" value={form.phone} error={errors.phone}
          onChange={(v) => set("phone", v)} disabled={isLoading} />
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="clinicAddress">Address</Label>
          <Textarea id="clinicAddress" value={form.address} disabled={isLoading}
            onChange={(e) => set("address", e.target.value)} />
          {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
        </div>
        <Field id="clinicEmail" label="Email" type="email" value={form.email} error={errors.email}
          onChange={(v) => set("email", v)} disabled={isLoading} />
        <Field id="clinicWebsite" label="Website" value={form.website} error={errors.website}
          onChange={(v) => set("website", v)} disabled={isLoading} />
        <Field id="clinicHours" label="Working hours" value={form.working_hours} error={errors.working_hours}
          onChange={(v) => set("working_hours", v)} disabled={isLoading} />
      </div>
      <div className="mt-6 flex justify-end">
        <Button className="h-10 rounded-xl" onClick={onSave} disabled={isLoading || save.isPending}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </div>
    </section>
  );
}

function Field({
  id, label, value, onChange, error, type, disabled,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  error?: string; type?: string; disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function AdminUsersTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const admins = useQuery({ queryKey: ["admin", "admins"], queryFn: fetchAdmins });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AdminRole>("admin");

  const isSuperAdmin = useMemo(
    () => (admins.data ?? []).some((a) => a.user_id === user?.id && a.is_active && a.role === "super_admin"),
    [admins.data, user?.id],
  );

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "admins"] });
  const onError = (e: any) => toast.error(e?.message ?? "Action failed");

  const invite = useMutation({
    mutationFn: () => inviteAdmin(inviteEmail.trim(), inviteRole),
    onSuccess: () => {
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("admin");
      refresh();
      toast.success("Admin access granted");
    },
    onError,
  });
  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: AdminRole }) => setAdminRole(id, role),
    onSuccess: () => { refresh(); toast.success("Role updated"); },
    onError,
  });
  const changeActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setAdminActive(id, active),
    onSuccess: () => { refresh(); toast.success("Status updated"); },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeAdmin(id),
    onSuccess: () => { refresh(); toast.success("Admin removed"); },
    onError,
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Admin Users</h2>
        <Button
          className="h-10 rounded-xl"
          disabled={!isSuperAdmin}
          title={isSuperAdmin ? undefined : "Only a Super Admin can invite admins"}
          onClick={() => setInviteOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" /> Invite admin
        </Button>
      </div>

      {admins.isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading admins…</p>}
      {admins.error && (
        <p className="mt-4 text-sm text-destructive">{(admins.error as Error).message}</p>
      )}

      <ul className="mt-4 divide-y divide-border">
        {(admins.data ?? []).map((a) => {
          const isSelf = a.user_id === user?.id;
          // A normal admin can never manage a Super Admin or change permissions.
          const canManage = isSuperAdmin && !isSelf;
          return (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">{a.full_name ?? a.email ?? "Admin"}</div>
                <div className="text-xs text-muted-foreground">
                  {a.email ?? "—"} - {roleLabel(a.role)} - {a.is_active ? "Active" : "Disabled"}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={a.role}
                  disabled={!canManage || changeRole.isPending}
                  onValueChange={(v) => changeRole.mutate({ id: a.id, role: v as AdminRole })}
                >
                  <SelectTrigger className="h-9 w-[150px] rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Switch
                  checked={a.is_active}
                  disabled={!canManage || changeActive.isPending}
                  aria-label="Enable admin"
                  onCheckedChange={(checked) => changeActive.mutate({ id: a.id, active: checked })}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={!canManage || remove.isPending}
                  onClick={() => remove.mutate(a.id)}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
                </Button>
              </div>
            </li>
          );
        })}
        {!admins.isLoading && (admins.data ?? []).length === 0 && (
          <li className="py-3 text-sm text-muted-foreground">No admins found.</li>
        )}
      </ul>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite admin</DialogTitle>
            <DialogDescription>
              Enter the email of an existing account to promote it to admin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="inviteEmail">Email</Label>
              <Input id="inviteEmail" type="email" value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)} placeholder="person@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inviteRole">Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AdminRole)}>
                <SelectTrigger id="inviteRole" className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button
              disabled={invite.isPending || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(inviteEmail.trim())}
              onClick={() => invite.mutate()}
            >
              {invite.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Grant access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}