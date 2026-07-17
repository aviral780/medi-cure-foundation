import { createFileRoute } from "@tanstack/react-router";
import { Plus, Pencil, Trash2, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/admin/doctors")({
  component: DoctorsPage,
});

const doctors = [
  { name: "Dr. Aditi Rao", spec: "General Physician", exp: "8 yrs", fee: "₹600", status: "Active" },
  { name: "Dr. Rajiv Mehta", spec: "Cardiologist", exp: "14 yrs", fee: "₹1,200", status: "Active" },
  { name: "Dr. Sinha", spec: "Dermatologist", exp: "6 yrs", fee: "₹800", status: "On leave" },
  { name: "Dr. Neha Kulkarni", spec: "Pediatrician", exp: "10 yrs", fee: "₹900", status: "Active" },
];

const consultationTypes = [
  { name: "Online Consultation", duration: "20 min", fee: "₹600" },
  { name: "In-Clinic Visit", duration: "30 min", fee: "₹800" },
  { name: "Follow-up", duration: "15 min", fee: "₹300" },
];

function DoctorsPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Doctors</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage clinic doctors and consultation types.</p>
        </div>
        <Button className="h-10 rounded-xl"><Plus className="mr-2 h-4 w-4" /> Add Doctor</Button>
      </header>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doctor</TableHead>
                <TableHead>Specialty</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doctors.map((d) => (
                <TableRow key={d.name}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary-soft text-primary text-xs font-semibold">
                          {d.name.split(" ").slice(-1)[0].slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{d.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{d.spec}</TableCell>
                  <TableCell>{d.exp}</TableCell>
                  <TableCell>{d.fee}</TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      d.status === "Active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                    }`}>{d.status}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" title="Edit"><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" title="Delete" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Consultation Types</h2>
          </div>
          <Button variant="outline" className="rounded-xl"><Plus className="mr-2 h-4 w-4" /> Add type</Button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {consultationTypes.map((c) => (
            <div key={c.name} className="rounded-xl border border-border/70 p-4">
              <div className="text-sm font-medium">{c.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">{c.duration} · {c.fee}</div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="ghost" className="h-8"><Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit</Button>
                <Button size="sm" variant="ghost" className="h-8 text-destructive"><Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete</Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}