import { createFileRoute } from "@tanstack/react-router";
import { Search, Eye, History } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/admin/patients")({
  component: PatientsPage,
});

const patients = [
  { name: "Rahul Sharma", phone: "+91 98xxxxxx01", email: "rahul@example.com", visits: 4, last: "2026-07-10" },
  { name: "Priya Kapoor", phone: "+91 98xxxxxx22", email: "priya@example.com", visits: 2, last: "2026-06-28" },
  { name: "Aman Verma", phone: "+91 98xxxxxx45", email: "aman@example.com", visits: 7, last: "2026-07-14" },
  { name: "Neha Iyer", phone: "+91 98xxxxxx77", email: "neha@example.com", visits: 1, last: "2026-05-30" },
];

function PatientsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Patients</h1>
        <p className="mt-1 text-sm text-muted-foreground">Browse and manage registered patients.</p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search patients by name, phone or email" className="h-10 rounded-xl pl-9" />
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
              {patients.map((p) => (
                <TableRow key={p.email}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary-soft text-primary text-xs font-semibold">
                          {p.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{p.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{p.phone}</TableCell>
                  <TableCell className="text-muted-foreground">{p.email}</TableCell>
                  <TableCell>{p.visits}</TableCell>
                  <TableCell>{p.last}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-8"><Eye className="mr-1.5 h-3.5 w-3.5" /> Profile</Button>
                      <Button size="sm" variant="ghost" className="h-8"><History className="mr-1.5 h-3.5 w-3.5" /> History</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}