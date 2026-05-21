import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db } from "../db";
import {
  tenantSettings, tenants, students, invoices, payments, receipts, reportCards, payslips, staff,
  examGroups, examAdmitCards, assessments, marks, classes, subjects, terms, studentClassHistory,
} from "../db/schema";
import { percentToGrade, scoreToPercent } from "./exam-grading";
import { eq, and, desc, isNull, inArray } from "drizzle-orm";
import { formatMoney } from "../utils/money";

export type PdfTemplate = "invoice" | "receipt" | "report_card" | "payslip";

interface Branding {
  schoolName: string;
  logoText?: string;
  primaryColor: { r: number; g: number; b: number };
  footer?: string;
}

async function loadBranding(tenantId: string): Promise<Branding> {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const [settings] = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenantId)).limit(1);
  const branding = (settings?.brandingJson ?? {}) as Record<string, string>;
  return {
    schoolName: tenant?.name ?? "School",
    logoText: branding.logoText ?? branding.name,
    primaryColor: { r: 0.1, g: 0.3, b: 0.6 },
    footer: branding.footer ?? "Official document — do not alter",
  };
}

async function basePage(branding: Branding, title: string) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { height } = page.getSize();

  page.drawText(branding.schoolName, { x: 50, y: height - 50, size: 18, font: bold, color: rgb(branding.primaryColor.r, branding.primaryColor.g, branding.primaryColor.b) });
  page.drawText(title, { x: 50, y: height - 75, size: 14, font: bold });
  if (branding.footer) {
    page.drawText(branding.footer, { x: 50, y: 30, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
  }
  return { doc, page, font, bold, height };
}

export async function generateInvoicePdf(tenantId: string, invoiceId: string): Promise<Uint8Array> {
  const branding = await loadBranding(tenantId);
  const [inv] = await db.select().from(invoices).where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId))).limit(1);
  if (!inv) throw new Error("Invoice not found");
  const [student] = await db.select().from(students).where(eq(students.id, inv.studentId)).limit(1);

  const { doc, page, font, bold, height } = await basePage(branding, `Invoice ${inv.invoiceNo}`);
  let y = height - 110;
  const lines = [
    `Student: ${student?.firstName ?? ""} ${student?.lastName ?? ""} (${student?.admissionNumber ?? ""})`,
    `Status: ${inv.status}`,
    `Total: ${formatMoney(inv.totalAmount)}`,
    `Paid: ${formatMoney(inv.paidAmount)}`,
    `Balance: ${formatMoney(inv.totalAmount - inv.paidAmount)}`,
    `Due: ${inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}`,
  ];
  for (const line of lines) {
    page.drawText(line, { x: 50, y, size: 11, font });
    y -= 18;
  }
  return doc.save();
}

export async function generateReceiptPdf(tenantId: string, receiptId: string): Promise<Uint8Array> {
  const branding = await loadBranding(tenantId);
  const [rec] = await db.select().from(receipts).where(and(eq(receipts.id, receiptId), eq(receipts.tenantId, tenantId))).limit(1);
  if (!rec) throw new Error("Receipt not found");

  const { doc, page, font, bold, height } = await basePage(branding, `Receipt ${rec.receiptNo}`);
  page.drawText(`Amount received: ${formatMoney(rec.amount)}`, { x: 50, y: height - 110, size: 12, font: bold });
  page.drawText(`Date: ${new Date(rec.issuedAt).toLocaleString()}`, { x: 50, y: height - 130, size: 11, font });
  return doc.save();
}

export async function generateReportCardPdf(tenantId: string, reportCardId: string): Promise<Uint8Array> {
  const branding = await loadBranding(tenantId);
  const [rc] = await db.select().from(reportCards).where(and(eq(reportCards.id, reportCardId), eq(reportCards.tenantId, tenantId))).limit(1);
  if (!rc) throw new Error("Report card not found");
  const [student] = await db.select().from(students).where(eq(students.id, rc.studentId)).limit(1);
  const data = rc.dataJson as Record<string, unknown>;

  const { doc, page, font, bold, height } = await basePage(branding, "Report Card");
  page.drawText(`${student?.firstName} ${student?.lastName}`, { x: 50, y: height - 110, size: 12, font: bold });
  page.drawText(`Admission: ${student?.admissionNumber ?? "—"}`, { x: 50, y: height - 128, size: 10, font });
  page.drawText(`Average: ${data.average ?? "—"}`, { x: 50, y: height - 146, size: 11, font });
  const marksList = (data.marks as Array<{ score?: number; grade?: string; remarks?: string }>) ?? [];
  let y = height - 170;
  for (const m of marksList.slice(0, 8)) {
    page.drawText(`  Score ${m.score ?? "—"} · ${m.grade ?? ""} · ${m.remarks ?? ""}`.slice(0, 70), { x: 50, y, size: 9, font });
    y -= 12;
  }
  page.drawText(rc.published ? "PUBLISHED" : "DRAFT", { x: 50, y: 60, size: 10, font });
  return doc.save();
}

export async function generatePayslipPdf(tenantId: string, payslipId: string): Promise<Uint8Array> {
  const branding = await loadBranding(tenantId);
  const [slip] = await db.select().from(payslips).where(and(eq(payslips.id, payslipId), eq(payslips.tenantId, tenantId))).limit(1);
  if (!slip) throw new Error("Payslip not found");
  const data = slip.dataJson as Record<string, unknown>;
  const [staffRow] = await db.select().from(staff).where(eq(staff.id, slip.staffId)).limit(1);
  const breakdown = (data.breakdown ?? []) as { name: string; amountMinor: number }[];

  const { doc, page, font, bold, height } = await basePage(branding, "Payslip");
  let y = height - 110;
  page.drawText(`${staffRow?.firstName ?? ""} ${staffRow?.lastName ?? ""} (${staffRow?.employeeNo ?? ""})`, { x: 50, y, size: 11, font });
  y -= 18;
  if (staffRow?.department) { page.drawText(String(staffRow.department), { x: 50, y, size: 10, font }); y -= 16; }
  page.drawText(`Period: ${data.period ?? "—"}`, { x: 50, y, size: 11, font });
  y -= 22;
  page.drawText(`Gross pay: ${formatMoney(Number(data.gross ?? 0))}`, { x: 50, y, size: 11, font });
  y -= 16;
  page.drawText("Deductions:", { x: 50, y, size: 10, font: bold });
  y -= 14;
  if (breakdown.length) {
    for (const line of breakdown.slice(0, 12)) {
      page.drawText(`  ${line.name}: ${formatMoney(line.amountMinor)}`, { x: 50, y, size: 9, font });
      y -= 12;
    }
  } else {
    page.drawText(`  Total: ${formatMoney(Number(data.deductions ?? 0))}`, { x: 50, y, size: 9, font });
    y -= 12;
  }
  y -= 8;
  page.drawText(`Net pay: ${formatMoney(Number(data.net ?? 0))}`, { x: 50, y, size: 12, font: bold });
  return doc.save();
}

export async function generateStaffIdCardPdf(tenantId: string, staffId: string): Promise<Uint8Array> {
  const branding = await loadBranding(tenantId);
  const [row] = await db.select().from(staff).where(and(eq(staff.id, staffId), eq(staff.tenantId, tenantId), isNull(staff.deletedAt))).limit(1);
  if (!row) throw new Error("Staff not found");

  const doc = await PDFDocument.create();
  const page = doc.addPage([242, 153]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.96, 0.97, 1), borderWidth: 0 });
  page.drawText(branding.schoolName, { x: 12, y: height - 18, size: 9, font: bold, color: rgb(branding.primaryColor.r, branding.primaryColor.g, branding.primaryColor.b) });
  page.drawText("STAFF ID", { x: 12, y: height - 30, size: 7, font });
  page.drawText(`${row.firstName} ${row.lastName}`, { x: 12, y: 52, size: 11, font: bold });
  page.drawText(row.employeeNo, { x: 12, y: 38, size: 9, font });
  if (row.jobTitle) page.drawText(row.jobTitle, { x: 12, y: 26, size: 8, font });
  else if (row.department) page.drawText(row.department, { x: 12, y: 26, size: 8, font });
  page.drawText("Valid while employed", { x: 12, y: 12, size: 6, font });
  return doc.save();
}

export async function generateStaffIdCardsBulkPdf(tenantId: string, staffIds?: string[]): Promise<Uint8Array> {
  const conditions = [eq(staff.tenantId, tenantId), isNull(staff.deletedAt), eq(staff.status, "active")];
  const rows = staffIds?.length
    ? await db.select().from(staff).where(and(...conditions, inArray(staff.id, staffIds)))
    : await db.select().from(staff).where(and(...conditions)).orderBy(staff.employeeNo);

  const branding = await loadBranding(tenantId);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  for (const row of rows) {
    const page = doc.addPage([242, 153]);
    const { width, height } = page.getSize();
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.96, 0.97, 1), borderWidth: 0 });
    page.drawText(branding.schoolName, { x: 12, y: height - 18, size: 9, font: bold, color: rgb(branding.primaryColor.r, branding.primaryColor.g, branding.primaryColor.b) });
    page.drawText("STAFF ID", { x: 12, y: height - 30, size: 7, font });
    page.drawText(`${row.firstName} ${row.lastName}`, { x: 12, y: 52, size: 11, font: bold });
    page.drawText(row.employeeNo, { x: 12, y: 38, size: 9, font });
    if (row.jobTitle) page.drawText(row.jobTitle, { x: 12, y: 26, size: 8, font });
    else if (row.department) page.drawText(row.department, { x: 12, y: 26, size: 8, font });
  }

  if (rows.length === 0) {
    const page = doc.addPage([400, 200]);
    const f = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText("No active staff found", { x: 50, y: 100, size: 14, font: f });
  }
  return doc.save();
}

async function loadStudentContext(tenantId: string, studentId: string) {
  const branding = await loadBranding(tenantId);
  const [student] = await db.select().from(students).where(and(eq(students.id, studentId), eq(students.tenantId, tenantId))).limit(1);
  if (!student) throw new Error("Student not found");
  const [settings] = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenantId)).limit(1);
  const ext = (settings?.brandingExtendedJson ?? {}) as Record<string, string>;
  return { branding, student, idCardTemplate: ext.idCardTemplate ?? "default", certificateTemplate: ext.certificateTemplate ?? "default" };
}

export async function generateStudentIdCardPdf(tenantId: string, studentId: string): Promise<Uint8Array> {
  const { branding, student } = await loadStudentContext(tenantId, studentId);
  const doc = await PDFDocument.create();
  const page = doc.addPage([242, 153]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.95, 0.97, 1), borderWidth: 0 });
  page.drawText(branding.schoolName, { x: 12, y: height - 18, size: 9, font: bold, color: rgb(branding.primaryColor.r, branding.primaryColor.g, branding.primaryColor.b) });
  page.drawText("STUDENT ID", { x: 12, y: height - 30, size: 7, font });
  page.drawText(`${student.firstName} ${student.lastName}`, { x: 12, y: 50, size: 11, font: bold });
  page.drawText(student.admissionNumber, { x: 12, y: 36, size: 9, font });
  if (student.gender) page.drawText(String(student.gender), { x: 12, y: 24, size: 8, font });
  return doc.save();
}

export async function generateTransferCertificatePdf(tenantId: string, studentId: string, transferId?: string): Promise<Uint8Array> {
  const { branding, student } = await loadStudentContext(tenantId, studentId);
  const { doc, page, font, bold, height } = await basePage(branding, "Transfer Certificate");
  let y = height - 110;
  const lines = [
    `This is to certify that ${student.firstName} ${student.lastName}`,
    `Admission No: ${student.admissionNumber}`,
    `has been a bonafide student of ${branding.schoolName}.`,
    transferId ? `Transfer record: ${transferId.slice(0, 8)}` : "",
    `Date of issue: ${new Date().toLocaleDateString()}`,
    "Character and conduct: Good",
    "Reason for leaving: As per school records",
  ].filter(Boolean);
  for (const line of lines) {
    page.drawText(line, { x: 50, y, size: 11, font: line.startsWith("This") ? bold : font });
    y -= 20;
  }
  page.drawText("Principal", { x: 50, y: 120, size: 11, font: bold });
  return doc.save();
}

export async function generateAchievementCertificatePdf(
  tenantId: string,
  studentId: string,
  payload: { title: string; body?: string },
): Promise<Uint8Array> {
  const { branding, student } = await loadStudentContext(tenantId, studentId);
  const { doc, page, font, bold, height } = await basePage(branding, payload.title);
  page.drawText("Certificate of Achievement", { x: 50, y: height - 95, size: 12, font });
  page.drawText(`Presented to ${student.firstName} ${student.lastName}`, { x: 50, y: height - 125, size: 14, font: bold });
  if (payload.body) {
    let y = height - 155;
    for (const chunk of payload.body.match(/.{1,70}/g) ?? []) {
      page.drawText(chunk, { x: 50, y, size: 11, font });
      y -= 16;
    }
  }
  page.drawText(`Date: ${new Date().toLocaleDateString()}`, { x: 50, y: 100, size: 10, font });
  return doc.save();
}

export async function generateStudentFeeReportPdf(tenantId: string, studentId: string): Promise<Uint8Array> {
  const { branding, student } = await loadStudentContext(tenantId, studentId);
  const invs = await db.select().from(invoices).where(and(
    eq(invoices.studentId, studentId), eq(invoices.tenantId, tenantId), isNull(invoices.deletedAt),
  )).orderBy(desc(invoices.createdAt)).limit(30);
  const pays = await db.select().from(payments).where(and(
    eq(payments.studentId, studentId), eq(payments.tenantId, tenantId), isNull(payments.deletedAt),
  )).orderBy(desc(payments.paidAt)).limit(20);

  const totalBilled = invs.reduce((s, i) => s + i.totalAmount, 0);
  const totalPaid = invs.reduce((s, i) => s + i.paidAmount, 0);
  const balance = totalBilled - totalPaid;

  const { doc, page, font, bold, height } = await basePage(branding, "Fee & Payment Report");
  let y = height - 110;
  const header = [
    `Student: ${student.firstName} ${student.lastName} (${student.admissionNumber})`,
    `Total billed: ${formatMoney(totalBilled)}`,
    `Total paid: ${formatMoney(totalPaid)}`,
    `Outstanding: ${formatMoney(balance)}`,
    "",
    "Recent invoices:",
  ];
  for (const line of header) {
    page.drawText(line, { x: 50, y, size: 11, font: line.includes("Outstanding") ? bold : font });
    y -= 16;
  }
  for (const inv of invs.slice(0, 12)) {
    page.drawText(`  ${inv.invoiceNo} — ${inv.status} — ${formatMoney(inv.totalAmount - inv.paidAmount)} due`, { x: 50, y, size: 9, font });
    y -= 14;
    if (y < 80) break;
  }
  y -= 10;
  page.drawText("Recent payments:", { x: 50, y, size: 11, font: bold });
  y -= 16;
  for (const p of pays.slice(0, 8)) {
    page.drawText(`  ${formatMoney(p.amount)} — ${p.paidAt ? new Date(p.paidAt).toLocaleDateString() : "—"}`, { x: 50, y, size: 9, font });
    y -= 14;
    if (y < 60) break;
  }
  return doc.save();
}

export async function generateAdmitCardPdf(tenantId: string, examGroupId: string, studentId: string): Promise<Uint8Array> {
  const branding = await loadBranding(tenantId);
  const [group] = await db.select().from(examGroups).where(and(eq(examGroups.id, examGroupId), eq(examGroups.tenantId, tenantId))).limit(1);
  const [student] = await db.select().from(students).where(and(eq(students.id, studentId), eq(students.tenantId, tenantId))).limit(1);
  const [card] = await db.select().from(examAdmitCards).where(and(
    eq(examAdmitCards.examGroupId, examGroupId), eq(examAdmitCards.studentId, studentId), eq(examAdmitCards.tenantId, tenantId),
  )).limit(1);
  if (!student) throw new Error("Student not found");
  const { doc, page, font, bold, height } = await basePage(branding, "Examination Admit Card");
  page.drawText(group?.name ?? "Examination", { x: 50, y: height - 95, size: 12, font });
  page.drawText(`${student.firstName} ${student.lastName}`, { x: 50, y: height - 120, size: 14, font: bold });
  page.drawText(`Admission No: ${student.admissionNumber}`, { x: 50, y: height - 140, size: 11, font });
  if (card) {
    page.drawText(`Hall: ${card.hall ?? "—"}`, { x: 50, y: height - 160, size: 11, font });
    page.drawText(`Seat: ${card.seatNo ?? "—"}`, { x: 50, y: height - 178, size: 11, font });
  }
  page.drawText(`Issued: ${new Date().toLocaleDateString()}`, { x: 50, y: 100, size: 10, font });
  return doc.save();
}

export async function generateBulkAdmitCardsPdf(tenantId: string, examGroupId: string, classId?: string): Promise<Uint8Array> {
  let studentIds: string[] = [];
  if (classId) {
    const enrolled = await db.select({ studentId: students.id }).from(studentClassHistory)
      .innerJoin(students, eq(students.id, studentClassHistory.studentId))
      .where(and(eq(studentClassHistory.tenantId, tenantId), eq(studentClassHistory.classId, classId), isNull(studentClassHistory.toDate)));
    studentIds = enrolled.map((e) => e.studentId);
  } else {
    const cards = await db.select({ studentId: examAdmitCards.studentId }).from(examAdmitCards)
      .where(and(eq(examAdmitCards.tenantId, tenantId), eq(examAdmitCards.examGroupId, examGroupId)));
    studentIds = cards.map((c) => c.studentId);
  }
  const doc = await PDFDocument.create();
  for (const sid of studentIds) {
    const single = await generateAdmitCardPdf(tenantId, examGroupId, sid);
    const loaded = await PDFDocument.load(single);
    const pages = await doc.copyPages(loaded, loaded.getPageIndices());
    pages.forEach((p) => doc.addPage(p));
  }
  if (doc.getPageCount() === 0) {
    const branding = await loadBranding(tenantId);
    const { doc: empty } = await basePage(branding, "No admit cards");
    return empty.save();
  }
  return doc.save();
}

export async function generateMarkSheetPdf(tenantId: string, assessmentId: string): Promise<Uint8Array> {
  const branding = await loadBranding(tenantId);
  const [a] = await db.select().from(assessments).where(and(eq(assessments.id, assessmentId), eq(assessments.tenantId, tenantId))).limit(1);
  if (!a) throw new Error("Assessment not found");
  const [cls] = await db.select().from(classes).where(eq(classes.id, a.classId)).limit(1);
  const [sub] = await db.select().from(subjects).where(eq(subjects.id, a.subjectId)).limit(1);
  const markRows = await db.select({
    firstName: students.firstName, lastName: students.lastName, admissionNumber: students.admissionNumber,
    score: marks.score, grade: marks.grade, remarks: marks.remarks,
  }).from(marks)
    .innerJoin(students, eq(marks.studentId, students.id))
    .where(and(eq(marks.assessmentId, a.id), eq(marks.tenantId, tenantId), isNull(marks.deletedAt)))
    .orderBy(students.lastName);

  const { doc, page, font, bold, height } = await basePage(branding, `Mark Sheet — ${a.name}`);
  page.drawText(`${cls?.name ?? ""} · ${sub?.name ?? ""} · Max ${a.maxScore}`, { x: 50, y: height - 95, size: 10, font });
  let y = height - 120;
  for (const r of markRows) {
    const pct = r.score != null ? scoreToPercent(r.score, a.maxScore) : null;
    page.drawText(`${r.admissionNumber} ${r.firstName} ${r.lastName} — ${r.score ?? "—"}/${a.maxScore} ${r.grade ?? (pct != null ? percentToGrade(pct) : "")} ${r.remarks ?? ""}`.slice(0, 90), { x: 50, y, size: 9, font });
    y -= 14;
    if (y < 60) break;
  }
  return doc.save();
}

export async function generateBulkResultSheetsPdf(
  tenantId: string,
  opts: { termId: string; classId: string; examGroupId?: string; academicGroupId?: string },
): Promise<Uint8Array> {
  const { getAcademicGroupStudentIds } = await import("./academic-group-filter");
  const doc = await PDFDocument.create();
  const cards = await db.select().from(reportCards).where(and(eq(reportCards.tenantId, tenantId), eq(reportCards.termId, opts.termId)));
  const enrolled = await db.select({ id: students.id }).from(studentClassHistory)
    .innerJoin(students, eq(students.id, studentClassHistory.studentId))
    .where(and(eq(studentClassHistory.tenantId, tenantId), eq(studentClassHistory.classId, opts.classId), isNull(studentClassHistory.toDate)));
  let enrolledIds = new Set(enrolled.map((e) => e.id));
  if (opts.academicGroupId) {
    const groupIds = await getAcademicGroupStudentIds(tenantId, opts.academicGroupId);
    enrolledIds = new Set([...enrolledIds].filter((id) => groupIds.has(id)));
  }
  for (const rc of cards.filter((c) => enrolledIds.has(c.studentId))) {
    const bytes = await generateReportCardPdf(tenantId, rc.id);
    const loaded = await PDFDocument.load(bytes);
    const pages = await doc.copyPages(loaded, loaded.getPageIndices());
    pages.forEach((p) => doc.addPage(p));
  }
  if (doc.getPageCount() === 0) {
    const branding = await loadBranding(tenantId);
    const { doc: empty } = await basePage(branding, "No results");
    return empty.save();
  }
  return doc.save();
}

export async function generateAcademicPerformanceReportPdf(
  tenantId: string,
  termId: string,
  classId: string,
  academicGroupId?: string,
): Promise<Uint8Array> {
  const { getAcademicGroupStudentIds } = await import("./academic-group-filter");
  const branding = await loadBranding(tenantId);
  const [term] = await db.select().from(terms).where(and(eq(terms.id, termId), eq(terms.tenantId, tenantId))).limit(1);
  const [cls] = await db.select().from(classes).where(and(eq(classes.id, classId), eq(classes.tenantId, tenantId))).limit(1);
  const classAssessments = await db.select().from(assessments).where(and(
    eq(assessments.tenantId, tenantId), eq(assessments.classId, classId), eq(assessments.termId, termId), isNull(assessments.deletedAt),
  ));
  let enrolled = await db.select({ studentId: students.id, firstName: students.firstName, lastName: students.lastName })
    .from(studentClassHistory).innerJoin(students, eq(students.id, studentClassHistory.studentId))
    .where(and(eq(studentClassHistory.tenantId, tenantId), eq(studentClassHistory.classId, classId), isNull(studentClassHistory.toDate)));
  if (academicGroupId) {
    const groupIds = await getAcademicGroupStudentIds(tenantId, academicGroupId);
    enrolled = enrolled.filter((s) => groupIds.has(s.studentId));
  }

  const { doc, page, font, bold, height } = await basePage(branding, "Academic Performance Report");
  page.drawText(`${cls?.name ?? "Class"} — ${term?.name ?? "Term"}${academicGroupId ? " (group filter)" : ""}`, { x: 50, y: height - 95, size: 12, font: bold });
  let y = height - 120;
  const summary: { pass: number; fail: number; total: number } = { pass: 0, fail: 0, total: 0 };
  for (const s of enrolled) {
    const stuMarks = await db.select({ score: marks.score, max: assessments.maxScore }).from(marks)
      .innerJoin(assessments, eq(marks.assessmentId, assessments.id))
      .where(and(eq(marks.studentId, s.studentId), inArray(marks.assessmentId, classAssessments.map((a) => a.id))));
    const avg = stuMarks.length
      ? stuMarks.reduce((sum, m) => sum + (m.score != null && m.max ? (m.score / m.max) * 100 : 0), 0) / stuMarks.length
      : 0;
    summary.total++;
    if (avg >= 50) summary.pass++; else summary.fail++;
    page.drawText(`${s.firstName} ${s.lastName}: ${avg.toFixed(1)}%`.slice(0, 70), { x: 50, y, size: 9, font });
    y -= 12;
    if (y < 100) break;
  }
  page.drawText(`Pass rate: ${summary.total ? Math.round((summary.pass / summary.total) * 100) : 0}% (${summary.pass}/${summary.total})`, { x: 50, y: 80, size: 11, font: bold });
  return doc.save();
}

/** Deterministic structure check for tests */
export async function pdfStructureCheck(pdfBytes: Uint8Array): Promise<{ pageCount: number; hasContent: boolean }> {
  const doc = await PDFDocument.load(pdfBytes);
  return { pageCount: doc.getPageCount(), hasContent: pdfBytes.length > 500 };
}
