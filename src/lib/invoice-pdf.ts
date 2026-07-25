import jsPDF from "jspdf";

export type InvoiceData = {
  invoiceNumber: string;
  paymentId: string;
  appointmentId: string;
  patientName: string;
  doctorName: string;
  consultationName: string;
  appointmentDateTime: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentStatus: string;
  transactionId: string | null;
  issuedOn: string;
};

function formatMoney(amount: number, currency: string): string {
  const sym = currency?.toUpperCase() === "INR" ? "Rs. " : `${currency} `;
  return `${sym}${Math.round(amount).toLocaleString("en-IN")}`;
}

export function downloadInvoicePdf(d: InvoiceData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = margin;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("MediCure", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("Clinic consultation receipt", margin, y + 16);

  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("INVOICE", pageW - margin, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`# ${d.invoiceNumber}`, pageW - margin, y + 16, { align: "right" });
  doc.text(`Issued: ${d.issuedOn}`, pageW - margin, y + 30, { align: "right" });

  y += 60;
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 24;

  const rows: Array<[string, string]> = [
    ["Payment ID", d.paymentId],
    ["Appointment ID", d.appointmentId],
    ["Transaction ID", d.transactionId ?? "—"],
    ["Patient", d.patientName],
    ["Doctor", d.doctorName],
    ["Consultation", d.consultationName],
    ["Appointment", d.appointmentDateTime],
    ["Payment method", d.paymentMethod],
    ["Payment status", d.paymentStatus.toUpperCase()],
  ];

  doc.setTextColor(20);
  doc.setFontSize(11);
  const labelX = margin;
  const valueX = margin + 160;
  for (const [label, value] of rows) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text(label, labelX, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20);
    const lines = doc.splitTextToSize(String(value ?? "—"), pageW - valueX - margin);
    doc.text(lines, valueX, y);
    y += 14 * Math.max(1, lines.length) + 6;
  }

  y += 12;
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 28;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20);
  doc.text("Amount paid", margin, y);
  doc.text(formatMoney(d.amount, d.currency), pageW - margin, y, { align: "right" });

  y += 40;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(140);
  doc.text(
    "This is a computer-generated receipt and does not require a signature.",
    pageW / 2,
    y,
    { align: "center" },
  );

  doc.save(`invoice-${d.invoiceNumber}.pdf`);
}