import jsPDF from "jspdf";
import { getCachedClinic } from "@/lib/clinic-settings";
import { websiteHost } from "@/lib/clinic-constants";
import type { Prescription } from "@/lib/prescriptions-api";

export type PrescriptionPdfData = {
  prescription: Prescription;
  doctorName: string;
  doctorQualifications: string;
  doctorSpecialization: string;
  patientName: string;
  patientAge: string;
  patientGender: string;
  patientPhone: string;
  appointmentDate: string | null;
  consultationType: string;
  appointmentId: string;
};

const TEAL: [number, number, number] = [13, 110, 108];
const INK: [number, number, number] = [28, 33, 40];
const MUTED: [number, number, number] = [118, 128, 140];
const LINE: [number, number, number] = [222, 228, 232];

function prettyDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function downloadPrescriptionPdf(d: PrescriptionPdfData) {
  const clinic = getCachedClinic();
  const p = d.prescription;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 44;
  const contentW = pageW - margin * 2;

  const ensureSpace = (needed: number, y: number): number => {
    if (y + needed < pageH - 120) return y;
    doc.addPage();
    return margin;
  };

  // ---- Letterhead ------------------------------------------------------
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, pageW, 96, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(clinic.name, margin, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(clinic.address || "", margin, 58);
  doc.text(
    [clinic.phone, clinic.email, websiteHost(clinic.website)].filter(Boolean).join("  ·  "),
    margin,
    72,
  );
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("PRESCRIPTION", pageW - margin, 42, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `Issued: ${prettyDate(p.published_at ?? p.created_at)}`,
    pageW - margin,
    58,
    { align: "right" },
  );
  doc.text(`Ref: ${d.appointmentId.slice(0, 8).toUpperCase()}`, pageW - margin, 72, {
    align: "right",
  });

  let y = 126;

  // ---- Doctor & patient block -----------------------------------------
  doc.setDrawColor(...LINE);
  doc.setFillColor(248, 250, 250);
  doc.roundedRect(margin, y - 18, contentW, 92, 8, 8, "FD");

  const colW = contentW / 2 - 12;
  const label = (text: string, x: number, yy: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(text.toUpperCase(), x, yy);
  };
  const value = (text: string, x: number, yy: number, w: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(doc.splitTextToSize(text || "—", w), x, yy);
  };

  label("Doctor", margin + 14, y);
  value(d.doctorName, margin + 14, y + 14, colW);
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(
    doc.splitTextToSize(
      [d.doctorQualifications, d.doctorSpecialization].filter(Boolean).join(" · "),
      colW,
    ),
    margin + 14,
    y + 28,
  );
  doc.setTextColor(...INK);
  doc.setFontSize(8.5);
  doc.text(`Consultation: ${d.consultationType}`, margin + 14, y + 46);
  doc.text(`Appointment: ${prettyDate(d.appointmentDate)}`, margin + 14, y + 60);

  const rx = margin + contentW / 2 + 6;
  label("Patient", rx, y);
  value(d.patientName, rx, y + 14, colW);
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(`${d.patientAge}  ·  ${d.patientGender}`, rx, y + 28);
  doc.setTextColor(...INK);
  doc.text(`Phone: ${d.patientPhone}`, rx, y + 46);
  doc.text(`Appointment ID: ${d.appointmentId.slice(0, 8)}`, rx, y + 60);

  y += 100;

  // ---- Text sections ---------------------------------------------------
  const section = (title: string, body: string | null) => {
    const text = body?.trim() ? body.trim() : "Not specified.";
    const lines = doc.splitTextToSize(text, contentW - 16);
    y = ensureSpace(34 + lines.length * 13, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...TEAL);
    doc.text(title.toUpperCase(), margin, y);
    y += 6;
    doc.setDrawColor(...LINE);
    doc.line(margin, y, pageW - margin, y);
    y += 15;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(lines, margin, y);
    y += lines.length * 13 + 16;
  };

  section("Chief complaint", p.chief_complaint);
  section("Diagnosis", p.diagnosis);

  // ---- Medicines table -------------------------------------------------
  y = ensureSpace(90, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...TEAL);
  doc.text("Rx  ·  MEDICATION", margin, y);
  y += 12;

  const cols = [
    { title: "#", w: 24 },
    { title: "Medicine", w: contentW * 0.28 },
    { title: "Dosage", w: contentW * 0.16 },
    { title: "Frequency", w: contentW * 0.18 },
    { title: "Duration", w: contentW * 0.15 },
    { title: "Instructions", w: contentW * 0.23 - 24 },
  ];

  const drawHeader = () => {
    doc.setFillColor(...TEAL);
    doc.rect(margin, y, contentW, 22, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    let x = margin + 8;
    for (const c of cols) {
      doc.text(c.title, x, y + 14);
      x += c.w;
    }
    y += 22;
  };
  drawHeader();

  const meds = p.medicines ?? [];
  if (meds.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    doc.text("No medicines prescribed.", margin + 8, y + 15);
    y += 30;
  } else {
    meds.forEach((m, i) => {
      const cells = [
        String(i + 1),
        m.name || "—",
        m.dosage || "—",
        m.frequency || "—",
        m.duration || "—",
        m.instructions || "—",
      ];
      const wrapped = cells.map((text, idx) =>
        doc.splitTextToSize(text, cols[idx]!.w - 12),
      );
      const rowH = Math.max(22, Math.max(...wrapped.map((w) => w.length)) * 11 + 12);
      if (y + rowH > pageH - 130) {
        doc.addPage();
        y = margin;
        drawHeader();
      }
      if (i % 2 === 1) {
        doc.setFillColor(247, 250, 250);
        doc.rect(margin, y, contentW, rowH, "F");
      }
      doc.setDrawColor(...LINE);
      doc.line(margin, y + rowH, pageW - margin, y + rowH);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      let x = margin + 8;
      wrapped.forEach((lines, idx) => {
        if (idx === 1) doc.setFont("helvetica", "bold");
        else doc.setFont("helvetica", "normal");
        doc.text(lines, x, y + 14);
        x += cols[idx]!.w;
      });
      y += rowH;
    });
    y += 18;
  }

  section("Tests & investigations", p.investigations);
  section("Advice", p.advice);
  section(
    "Follow-up",
    [
      p.follow_up_date ? prettyDate(p.follow_up_date) : null,
      p.additional_notes?.trim() || null,
    ]
      .filter(Boolean)
      .join("\n") || null,
  );

  // ---- Signature + QR placeholder -------------------------------------
  y = ensureSpace(120, y);
  const footerY = Math.max(y + 20, pageH - 150);

  doc.setDrawColor(...LINE);
  doc.roundedRect(margin, footerY, 74, 74, 8, 8, "S");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text("QR CODE", margin + 37, footerY + 34, { align: "center" });
  doc.text("verification", margin + 37, footerY + 46, { align: "center" });

  doc.setDrawColor(...INK);
  doc.line(pageW - margin - 170, footerY + 52, pageW - margin, footerY + 52);
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.text(d.doctorName, pageW - margin, footerY + 66, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    [d.doctorQualifications, d.doctorSpecialization].filter(Boolean).join(" · "),
    pageW - margin,
    footerY + 78,
    { align: "right" },
  );

  // ---- Page footers ----------------------------------------------------
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINE);
    doc.line(margin, pageH - 52, pageW - margin, pageH - 52);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(
      `${clinic.name} · Digitally issued prescription · Not valid for medico-legal purposes without clinic seal.`,
      margin,
      pageH - 36,
    );
    doc.text(`Page ${i} of ${pages}`, pageW - margin, pageH - 36, { align: "right" });
  }

  doc.save(`prescription-${d.appointmentId.slice(0, 8)}.pdf`);
}