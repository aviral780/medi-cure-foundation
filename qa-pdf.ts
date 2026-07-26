import jsPDF from "jspdf";
import type { AppointmentReport, PatientReport, RevenueReport } from "./src/lib/reports-queries";

const CLINIC = {
  name: "MediCure",
  tagline: "Clinic consultation & appointment management",
};

const MARGIN = 48;

type Ctx = { doc: jsPDF; y: number; pageW: number; pageH: number };

function money(n: number, currency = "INR"): string {
  const sym = currency.toUpperCase() === "INR" ? "Rs. " : `${currency} `;
  return `${sym}${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
}

function generatedOn(): string {
  return new Date().toLocaleString(undefined, {
    dateStyle: "full",
    timeStyle: "short",
  });
}

function newCtx(): Ctx {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  return {
    doc,
    y: MARGIN,
    pageW: doc.internal.pageSize.getWidth(),
    pageH: doc.internal.pageSize.getHeight(),
  };
}

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y + needed <= ctx.pageH - MARGIN - 24) return;
  ctx.doc.addPage();
  ctx.y = MARGIN;
}

function header(ctx: Ctx, title: string, subtitle?: string) {
  const { doc, pageW } = ctx;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(20);
  doc.text(CLINIC.name, MARGIN, ctx.y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(130);
  doc.text(CLINIC.tagline, MARGIN, ctx.y + 14);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20);
  doc.text(title, pageW - MARGIN, ctx.y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(130);
  doc.text(`Generated: ${generatedOn()}`, pageW - MARGIN, ctx.y + 14, { align: "right" });
  if (subtitle) doc.text(subtitle, pageW - MARGIN, ctx.y + 27, { align: "right" });

  ctx.y += subtitle ? 44 : 32;
  doc.setDrawColor(215);
  doc.line(MARGIN, ctx.y, pageW - MARGIN, ctx.y);
  ctx.y += 26;
}

function sectionTitle(ctx: Ctx, text: string) {
  ensureSpace(ctx, 48);
  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.setFontSize(12);
  ctx.doc.setTextColor(20);
  ctx.doc.text(text, MARGIN, ctx.y);
  ctx.y += 16;
}

function summaryCards(ctx: Ctx, cards: Array<[string, string]>) {
  const { doc, pageW } = ctx;
  const perRow = 3;
  const gap = 12;
  const cardW = (pageW - MARGIN * 2 - gap * (perRow - 1)) / perRow;
  const cardH = 54;

  for (let i = 0; i < cards.length; i += perRow) {
    const row = cards.slice(i, i + perRow);
    ensureSpace(ctx, cardH + gap);
    row.forEach((c, j) => {
      const x = MARGIN + j * (cardW + gap);
      doc.setFillColor(246, 249, 250);
      doc.setDrawColor(224);
      doc.roundedRect(x, ctx.y, cardW, cardH, 8, 8, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(120);
      doc.text(c[0].toUpperCase(), x + 12, ctx.y + 19);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(20);
      doc.text(c[1], x + 12, ctx.y + 40);
    });
    ctx.y += cardH + gap;
  }
  ctx.y += 8;
}

function table(
  ctx: Ctx,
  columns: string[],
  rows: Array<Array<string>>,
  opts?: { totals?: string[]; widths?: number[] },
) {
  const { doc, pageW } = ctx;
  const tableW = pageW - MARGIN * 2;
  const widths =
    opts?.widths && opts.widths.length === columns.length
      ? opts.widths.map((w) => (w / opts.widths!.reduce((a, b) => a + b, 0)) * tableW)
      : columns.map(() => tableW / columns.length);
  const rowH = 20;

  const drawHead = () => {
    ensureSpace(ctx, rowH * 2);
    doc.setFillColor(238, 243, 245);
    doc.rect(MARGIN, ctx.y, tableW, rowH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(70);
    let x = MARGIN;
    columns.forEach((c, i) => {
      const right = i > 0;
      doc.text(c, right ? x + widths[i]! - 8 : x + 8, ctx.y + 13.5, {
        align: right ? "right" : "left",
      });
      x += widths[i]!;
    });
    ctx.y += rowH;
  };

  drawHead();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  rows.forEach((r, idx) => {
    if (ctx.y + rowH > ctx.pageH - MARGIN - 24) {
      doc.addPage();
      ctx.y = MARGIN;
      drawHead();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
    }
    if (idx % 2 === 1) {
      doc.setFillColor(250, 251, 252);
      doc.rect(MARGIN, ctx.y, tableW, rowH, "F");
    }
    doc.setTextColor(35);
    let x = MARGIN;
    r.forEach((cell, i) => {
      const right = i > 0;
      const maxW = widths[i]! - 16;
      const text = doc.splitTextToSize(String(cell ?? "—"), maxW)[0] ?? "";
      doc.text(text, right ? x + widths[i]! - 8 : x + 8, ctx.y + 13.5, {
        align: right ? "right" : "left",
      });
      x += widths[i]!;
    });
    ctx.y += rowH;
  });

  if (opts?.totals) {
    ensureSpace(ctx, rowH);
    doc.setFillColor(238, 243, 245);
    doc.rect(MARGIN, ctx.y, tableW, rowH, "F");
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20);
    let x = MARGIN;
    opts.totals.forEach((cell, i) => {
      const right = i > 0;
      doc.text(String(cell), right ? x + widths[i]! - 8 : x + 8, ctx.y + 13.5, {
        align: right ? "right" : "left",
      });
      x += widths[i]!;
    });
    ctx.y += rowH;
  }

  doc.setDrawColor(226);
  doc.rect(MARGIN, ctx.y, 0, 0);
  ctx.y += 22;
}

function paginate(ctx: Ctx) {
  const { doc, pageW, pageH } = ctx;
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(150);
    doc.text(`${CLINIC.name} — confidential`, MARGIN, pageH - 24);
    doc.text(`Page ${i} of ${total}`, pageW - MARGIN, pageH - 24, { align: "right" });
  }
}

function save(ctx: Ctx, name: string) {
  paginate(ctx);
  const stamp = new Date().toISOString().slice(0, 10);
  require("fs").writeFileSync("/tmp/qa/out.pdf", Buffer.from(ctx.doc.output("arraybuffer")));
}

function nonZero(buckets: Array<{ label: string; value: number }>) {
  const filtered = buckets.filter((b) => b.value > 0);
  return filtered.length > 0 ? filtered : buckets.slice(-7);
}

/* ---------- section builders (shared by single + combined exports) ---------- */

function revenueSection(ctx: Ctx, r: RevenueReport) {
  sectionTitle(ctx, "Revenue summary");
  summaryCards(ctx, [
    ["Total revenue", money(r.totalRevenue, r.currency)],
    ["Today's revenue", money(r.todaysRevenue, r.currency)],
    ["Paid appointments", String(r.totalPaidAppointments)],
    ["Avg. revenue / appointment", money(r.averageRevenue, r.currency)],
    ["Days with revenue", String(r.byDay.filter((d) => d.value > 0).length)],
    ["Active months", String(r.byMonth.filter((m) => m.value > 0).length)],
  ]);

  sectionTitle(ctx, "Revenue by day (last 30 days)");
  const days = nonZero(r.byDay);
  table(
    ctx,
    ["Date", "Revenue"],
    days.map((d) => [d.label, money(d.value, r.currency)]),
    {
      totals: ["Total", money(days.reduce((s, d) => s + d.value, 0), r.currency)],
      widths: [2, 1],
    },
  );

  sectionTitle(ctx, "Revenue by month (last 12 months)");
  const months = nonZero(r.byMonth);
  table(
    ctx,
    ["Month", "Revenue"],
    months.map((m) => [m.label, money(m.value, r.currency)]),
    {
      totals: ["Total", money(months.reduce((s, m) => s + m.value, 0), r.currency)],
      widths: [2, 1],
    },
  );
}

function appointmentSection(ctx: Ctx, a: AppointmentReport) {
  sectionTitle(ctx, "Appointment summary");
  summaryCards(ctx, [
    ["Total appointments", String(a.total)],
    ["Completed", String(a.completed)],
    ["Upcoming", String(a.upcoming)],
    ["Cancelled", String(a.cancelled)],
    ["No-show", String(a.noShow)],
    ["Doctors active", String(a.byDoctor.length)],
  ]);

  sectionTitle(ctx, "Doctor-wise appointments");
  table(
    ctx,
    ["Doctor", "Appointments"],
    a.byDoctor.map((d) => [d.name, String(d.count)]),
    { totals: ["Total", String(a.byDoctor.reduce((s, d) => s + d.count, 0))], widths: [2, 1] },
  );

  sectionTitle(ctx, "Consultation type breakdown");
  table(
    ctx,
    ["Consultation type", "Appointments"],
    a.byConsultationType.map((c) => [c.name, String(c.count)]),
    {
      totals: ["Total", String(a.byConsultationType.reduce((s, c) => s + c.count, 0))],
      widths: [2, 1],
    },
  );

  sectionTitle(ctx, "Daily appointment trend (last 30 days)");
  const days = nonZero(a.dailyTrend);
  table(
    ctx,
    ["Date", "Appointments"],
    days.map((d) => [d.label, String(d.value)]),
    { totals: ["Total", String(days.reduce((s, d) => s + d.value, 0))], widths: [2, 1] },
  );
}

function patientSection(ctx: Ctx, p: PatientReport) {
  sectionTitle(ctx, "Patient summary");
  summaryCards(ctx, [
    ["Total patients", String(p.totalPatients)],
    ["New patients (30d)", String(p.newPatients)],
    ["Returning patients", String(p.returningPatients)],
    ["Total visits", String(p.totalVisits)],
    ["Avg. visits / patient", p.totalPatients ? (p.totalVisits / p.totalPatients).toFixed(1) : "0"],
    ["Registrations listed", String(p.recentRegistrations.length)],
  ]);

  sectionTitle(ctx, "Top patients by visits");
  table(
    ctx,
    ["Patient", "Email", "Visits"],
    p.topPatients.map((t) => [t.name, t.email, String(t.visits)]),
    {
      totals: ["Total", "", String(p.topPatients.reduce((s, t) => s + t.visits, 0))],
      widths: [2, 3, 1],
    },
  );

  sectionTitle(ctx, "Recent registrations");
  table(
    ctx,
    ["Patient", "Email", "Joined"],
    p.recentRegistrations.map((r) => [
      r.name,
      r.email,
      r.joined ? new Date(r.joined).toLocaleDateString() : "—",
    ]),
    { widths: [2, 3, 1] },
  );
}

/* ---------------------------- public exports ---------------------------- */

export function downloadRevenueReportPdf(r: RevenueReport) {
  const ctx = newCtx();
  header(ctx, "Revenue Report", "Paid transactions only");
  revenueSection(ctx, r);
  save(ctx, "revenue-report");
}

export function downloadAppointmentReportPdf(a: AppointmentReport) {
  const ctx = newCtx();
  header(ctx, "Appointment Report");
  appointmentSection(ctx, a);
  save(ctx, "appointment-report");
}

export function downloadPatientReportPdf(p: PatientReport) {
  const ctx = newCtx();
  header(ctx, "Patient Report");
  patientSection(ctx, p);
  save(ctx, "patient-report");
}

export function downloadCombinedReportPdf(
  r: RevenueReport,
  a: AppointmentReport,
  p: PatientReport,
) {
  const ctx = newCtx();
  header(ctx, "Clinic Performance Report", "Revenue · Appointments · Patients");

  sectionTitle(ctx, "Clinic information");
  table(
    ctx,
    ["Detail", "Value"],
    [
      ["Clinic", CLINIC.name],
      ["Report generated", generatedOn()],
      ["Reporting currency", r.currency.toUpperCase()],
      ["Sections included", "Dashboard summary, Revenue, Appointments, Patients"],
    ],
    { widths: [1, 2] },
  );

  sectionTitle(ctx, "Dashboard summary");
  summaryCards(ctx, [
    ["Total revenue", money(r.totalRevenue, r.currency)],
    ["Today's revenue", money(r.todaysRevenue, r.currency)],
    ["Total appointments", String(a.total)],
    ["Completed", String(a.completed)],
    ["Upcoming", String(a.upcoming)],
    ["Total patients", String(p.totalPatients)],
  ]);

  ctx.doc.addPage();
  ctx.y = MARGIN;
  header(ctx, "Revenue Report", "Paid transactions only");
  revenueSection(ctx, r);

  ctx.doc.addPage();
  ctx.y = MARGIN;
  header(ctx, "Appointment Report");
  appointmentSection(ctx, a);

  ctx.doc.addPage();
  ctx.y = MARGIN;
  header(ctx, "Patient Report");
  patientSection(ctx, p);

  save(ctx, "clinic-report");
}