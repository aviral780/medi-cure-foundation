// Server-only invoice PDF generator (pdf-lib, Cloudflare Workers compatible).
// Returns a base64-encoded PDF suitable for Resend's `attachments` API.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type InvoiceData = {
  clinicName: string;
  invoiceNumber: string;
  invoiceDate: string;
  appointmentId: string;
  patientName: string;
  doctorName: string;
  consultationType: string;
  dateTime: string;
  paymentId: string;
  amountPaid: string;
  paymentStatus: string;
};

export async function generateInvoicePdf(d: InvoiceData): Promise<{
  filename: string;
  contentBase64: string;
}> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const teal = rgb(0.04, 0.65, 0.63);
  const dark = rgb(0.06, 0.09, 0.16);
  const muted = rgb(0.4, 0.45, 0.53);
  const line = rgb(0.88, 0.9, 0.93);

  // Header band
  page.drawRectangle({ x: 0, y: 771, width: 595.28, height: 70, color: teal });
  page.drawText(d.clinicName, { x: 40, y: 805, size: 22, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Payment Invoice", { x: 40, y: 785, size: 11, font, color: rgb(1, 1, 1) });

  // Invoice meta (top right)
  const metaRight = (label: string, value: string, y: number) => {
    page.drawText(label, { x: 380, y, size: 9, font, color: muted });
    page.drawText(value, { x: 460, y, size: 10, font: bold, color: dark });
  };
  metaRight("Invoice #", d.invoiceNumber, 740);
  metaRight("Invoice Date", d.invoiceDate, 724);
  metaRight("Status", d.paymentStatus.toUpperCase(), 708);

  // Billed To
  page.drawText("BILLED TO", { x: 40, y: 740, size: 9, font: bold, color: muted });
  page.drawText(d.patientName || "Patient", { x: 40, y: 722, size: 12, font: bold, color: dark });

  // Divider
  page.drawLine({ start: { x: 40, y: 690 }, end: { x: 555, y: 690 }, thickness: 1, color: line });

  // Details table
  const rows: Array<[string, string]> = [
    ["Appointment ID", d.appointmentId],
    ["Doctor", d.doctorName],
    ["Consultation Type", d.consultationType],
    ["Date & Time", d.dateTime],
    ["Payment ID", d.paymentId],
    ["Payment Status", d.paymentStatus],
  ];

  let y = 660;
  const rowH = 26;
  for (const [k, v] of rows) {
    page.drawText(k, { x: 40, y, size: 10, font, color: muted });
    page.drawText(String(v || "—"), {
      x: 220,
      y,
      size: 10,
      font: bold,
      color: dark,
      maxWidth: 335,
    });
    y -= rowH;
    page.drawLine({ start: { x: 40, y: y + 10 }, end: { x: 555, y: y + 10 }, thickness: 0.5, color: line });
  }

  // Total block
  y -= 20;
  page.drawRectangle({ x: 40, y: y - 40, width: 515, height: 60, color: rgb(0.96, 0.99, 0.99) });
  page.drawText("Amount Paid", { x: 60, y: y - 12, size: 11, font, color: muted });
  page.drawText(d.amountPaid, { x: 60, y: y - 30, size: 20, font: bold, color: teal });

  // Footer
  page.drawText(
    "This is a computer-generated invoice. Thank you for choosing " + d.clinicName + ".",
    { x: 40, y: 50, size: 9, font, color: muted },
  );

  const bytes = await pdf.save();
  return {
    filename: `invoice-${d.invoiceNumber}.pdf`,
    contentBase64: uint8ToBase64(bytes),
  };
}

function uint8ToBase64(bytes: Uint8Array): string {
  // Chunked conversion so we don't blow the call-stack on larger PDFs.
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  // btoa is available in both Workers and Node 18+.
  return btoa(binary);
}