import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
});

const admins = [
  { name: "Ananya Rao", email: "ananya@medicure.app", role: "Super Admin" },
  { name: "Vikram Shah", email: "vikram@medicure.app", role: "Admin" },
];

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
        </TabsList>

        <TabsContent value="clinic">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="clinicName">Clinic name</Label>
                <Input id="clinicName" defaultValue="MediCure Clinic" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="clinicPhone">Phone</Label>
                <Input id="clinicPhone" defaultValue="+91 98 0000 0000" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="clinicAddress">Address</Label>
                <Textarea id="clinicAddress" defaultValue="42 Wellness Avenue, Bandra West, Mumbai" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="clinicEmail">Email</Label>
                <Input id="clinicEmail" type="email" defaultValue="contact@medicure.app" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="clinicHours">Working hours</Label>
                <Input id="clinicHours" defaultValue="Mon-Sat 09:00-20:00" />
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button className="h-10 rounded-xl">Save changes</Button>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="admins">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Admin Users</h2>
              <Button className="h-10 rounded-xl"><Plus className="mr-2 h-4 w-4" /> Invite admin</Button>
            </div>
            <ul className="mt-4 divide-y divide-border">
              {admins.map((a) => (
                <li key={a.email} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <div className="text-sm font-medium">{a.name}</div>
                    <div className="text-xs text-muted-foreground">{a.email} - {a.role}</div>
                  </div>
                  <Button size="sm" variant="ghost" className="text-destructive"><Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove</Button>
                </li>
              ))}
            </ul>
          </section>
        </TabsContent>

        <TabsContent value="notifications">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
            <div className="space-y-4">
              <ToggleRow title="Email confirmations" desc="Send booking confirmation emails to patients." defaultChecked />
              <ToggleRow title="Reschedule notifications" desc="Notify patients when their appointment is moved." defaultChecked />
              <ToggleRow title="Cancellation notifications" desc="Notify patients when an appointment is cancelled." defaultChecked />
              <ToggleRow title="Daily digest to admins" desc="Send a summary of the day to admin users." />
              <ToggleRow title="SMS reminders" desc="Send SMS reminders 1 hour before appointment." />
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ToggleRow({ title, desc, defaultChecked }: { title: string; desc: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 p-4">
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}