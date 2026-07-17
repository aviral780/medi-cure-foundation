import { createFileRoute } from "@tanstack/react-router";
import { FileText, RotateCcw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PaymentBadge } from "@/components/appointments/StatusBadges";

export const Route = createFileRoute("/admin/payments")({
  component: PaymentsPage,
});

const payments = [
  { id: "PAY-88231", patient: "Rahul Sharma", amount: "₹600", method: "Razorpay", date: "2026-07-17", status: "paid" },
  { id: "PAY-88232", patient: "Priya Kapoor", amount: "₹800", method: "Razorpay", date: "2026-07-17", status: "awaiting_payment" },
  { id: "PAY-88233", patient: "Aman Verma", amount: "₹600", method: "Razorpay", date: "2026-07-16", status: "paid" },
  { id: "PAY-88234", patient: "Neha Iyer", amount: "₹800", method: "Razorpay", date: "2026-07-15", status: "refunded" },
  { id: "PAY-88235", patient: "Karan Patel", amount: "₹600", method: "Razorpay", date: "2026-07-15", status: "failed" },
];

function PaymentsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">Track transactions, download invoices and process refunds.</p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by payment ID or patient" className="h-10 rounded-xl pl-9" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment ID</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.id}</TableCell>
                  <TableCell className="font-medium">{p.patient}</TableCell>
                  <TableCell>{p.amount}</TableCell>
                  <TableCell>{p.method}</TableCell>
                  <TableCell>{p.date}</TableCell>
                  <TableCell><PaymentBadge status={p.status} /></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-8"><FileText className="mr-1.5 h-3.5 w-3.5" /> Invoice</Button>
                      <Button size="sm" variant="ghost" className="h-8 text-destructive"><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Refund</Button>
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