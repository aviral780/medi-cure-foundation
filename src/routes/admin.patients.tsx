import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, History } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatFullDate, initialsOf } from "@/lib/booking-queries";
import { PatientDetailsDrawer } from "@/components/admin/PatientDetailsDrawer";

export const Route = createFileRoute("/admin/patients")({
  component: PatientsPage,
});

type PatientRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  visits: number;
  last: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
};

type ApptRow = {
  patient_id: string;
  appointment_status: string | null;
  appointment_date: string | null;
};

async function fetchPatientsWithVisits(): Promise<PatientRow[]> {
  const [profilesRes, apptsRes] = await Promise.all([
    (supabase as any).from("profiles").select("id, full_name, phone, email"),
    (supabase as any)
      .from("appointments")
      .select("patient_id, appointment_status, appointment_date"),
  ]);
  if (profilesRes.error) throw profilesRes.error;
  if (apptsRes.error) throw apptsRes.error;
  const profiles = (profilesRes.data ?? []) as ProfileRow[];
  const appts = (apptsRes.data ?? []) as ApptRow[];

  const stats = new Map<string, { visits: number; last: string | null }>();
  for (const a of appts) {
    const s = (a.appointment_status ?? "").toLowerCase();
    if (s === "cancelled" || s === "canceled") continue;
    const cur = stats.get(a.patient_id) ?? { visits: 0, last: null };
    cur.visits += 1;
    if (a.appointment_date && (!cur.last || a.appointment_date > cur.last)) {
      cur.last = a.appointment_date;
    }
    stats.set(a.patient_id, cur);
  }

  const patientIds = new Set<string>([
    ...profiles.map((p) => p.id),
    ...Array.from(stats.keys()),
  ]);

  const rows: PatientRow[] = Array.from(patientIds).map((id) => {
    const p = profiles.find((x) => x.id === id);
    const st = stats.get(id);
    return {
      id,
      name: p?.full_name ?? "Unknown patient",
      phone: p?.phone ?? "—",
      email: p?.email ?? "—",
      visits: st?.visits ?? 0,
      last: st?.last ?? null,
    };
  });

  rows.sort((a, b) => {
    if (a.last && b.last) return a.last < b.last ? 1 : -1;
    if (a.last) return -1;
    if (b.last) return 1;
    return a.name.localeCompare(b.name);
  });

  // Only surface patients who actually have activity or an existing profile row.
  return rows.filter((r) => r.visits > 0 || r.name !== "Unknown patient");
}

function PatientsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-patients", user?.id],
    enabled: !!user?.id,
    queryFn: fetchPatientsWithVisits,
  });

  // Realtime: any change to appointments or payments refreshes the list.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`admin-patients-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-patients"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-patients"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-patient-payments"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const rows = data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.phone, r.email].join(" ").toLowerCase().includes(q),
    );
  }, [rows, search]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Patients</h1>
        <p className="mt-1 text-sm text-muted-foreground">Browse and manage registered patients.</p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search patients by name, phone or email"
            className="h-10 rounded-xl pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Visits</TableHead>
                <TableHead>Last visit</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    Loading patients…
                  </TableCell>
                </TableRow>
              )}
              {error && !isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-destructive">
                    {(error as Error).message}
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !error && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No patients found.
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !error && filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary-soft text-primary text-xs font-semibold">
                          {initialsOf(p.name) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{p.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{p.phone}</TableCell>
                  <TableCell className="text-muted-foreground">{p.email}</TableCell>
                  <TableCell>{p.visits}</TableCell>
                  <TableCell>{p.last ? formatFullDate(p.last) : "—"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8"
                        onClick={() => setSelected(p.id)}
                      >
                        <History className="mr-1.5 h-3.5 w-3.5" /> History
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <PatientDetailsDrawer
        patientId={selected}
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
      />
    </div>
  );
}