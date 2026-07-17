import { createFileRoute } from "@tanstack/react-router";
import { Search, Filter, Eye, Check, CheckCheck, X, CalendarClock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge, PaymentBadge } from "@/components/appointments/StatusBadges";

export const Route = createFileRoute("/admin/appointments")({
  component: AppointmentsPage,
});

const rows = [
  { id: "APT-10241", patient: "Rahul Sharma", doctor: "Dr. Aditi Rao", date: "2026-07-18 10:30", type: "Online", status: "confirmed", payment: "paid" },
  { id: "APT-10242", patient: "Priya Kapoor", doctor: "Dr. Mehta", date: "2026-07-18 11:00", type: "In-Clinic", status: "pending", payment: "awaiting_payment" },
  { id: "APT-10243", patient: "Aman Verma", doctor: "Dr. Aditi Rao", date: "2026-07-18 12:15", type: "Online", status: "completed", payment: "paid" },
  { id: "APT-10244", patient: "Neha Iyer", doctor: "Dr. Sinha", date: "2026-07-19 09:00", type: "In-Clinic", status: "cancelled", payment: "refunded" },
  { id: "APT-10245", patient: "Karan Patel", doctor: "Dr. Mehta", date: "2026-07-19 14:00", type: "Online", status: "confirmed", payment: "paid" },
];

function AppointmentsPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Appointments</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage bookings, payments and status.</p>
        </div>
      </header>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by patient, doctor or ID" className="h-10 rounded-xl pl-9" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select>
              <SelectTrigger className="h-10 w-[140px] rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger className="h-10 w-[140px] rounded-xl"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="clinic">In-Clinic</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="h-10 rounded-xl"><Filter className="mr-2 h-4 w-4" /> More filters</Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Date & time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.id}</TableCell>
                  <TableCell className="font-medium">{r.patient}</TableCell>
                  <TableCell>{r.doctor}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.date}</TableCell>
                  <TableCell>{r.type}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell><PaymentBadge status={r.payment} /></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" title="View"><Eye className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" title="Confirm"><Check className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" title="Complete"><CheckCheck className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" title="Reschedule"><CalendarClock className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" title="Cancel" className="text-destructive"><X className="h-4 w-4" /></Button>
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