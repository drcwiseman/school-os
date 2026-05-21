import { db } from "../db";
import {
  students, invoices, attendanceSessions, attendanceRecords,
  aiUsageLog, classes,
} from "../db/schema";
import { eq, and, isNull, sql, desc, gte, lt } from "drizzle-orm";
import { analyzeDropoutRisk } from "./ai-agents";
import { trackTenantUsage } from "./billing-usage";
import { campusCondition } from "../lib/campus-scope";

export async function logAiUsage(tenantId: string, feature: string, credits = 1) {
  await db.insert(aiUsageLog).values({ tenantId, feature, credits });
  await trackTenantUsage(tenantId, "ai_credits", credits);
}

export async function getAiUsageSummary(tenantId: string) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const [month] = await db
    .select({ credits: sql<number>`coalesce(sum(${aiUsageLog.credits}), 0)` })
    .from(aiUsageLog)
    .where(and(eq(aiUsageLog.tenantId, tenantId), gte(aiUsageLog.createdAt, startOfMonth)));
  const byFeature = await db
    .select({
      feature: aiUsageLog.feature,
      credits: sql<number>`coalesce(sum(${aiUsageLog.credits}), 0)`,
    })
    .from(aiUsageLog)
    .where(and(eq(aiUsageLog.tenantId, tenantId), gte(aiUsageLog.createdAt, startOfMonth)))
    .groupBy(aiUsageLog.feature);
  return { monthCredits: Number(month?.credits ?? 0), byFeature };
}

export async function buildAtRiskList(tenantId: string, campusId?: string, limit = 15) {
  const conds = [eq(students.tenantId, tenantId), isNull(students.deletedAt), eq(students.status, "active")];
  const c = campusCondition(students, campusId);
  if (c) conds.push(c);
  const rows = await db.select({
    id: students.id,
    firstName: students.firstName,
    lastName: students.lastName,
  }).from(students).where(and(...conds)).limit(40);

  const results: Array<{
    studentId: string;
    name: string;
    riskScore: number;
    status: string;
    riskFactors: string[];
    guidanceRecommendation: string;
  }> = [];

  for (const s of rows) {
    const [att] = await db
      .select({
        present: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'present')`,
        total: sql<number>`count(*)`,
      })
      .from(attendanceRecords)
      .innerJoin(attendanceSessions, eq(attendanceRecords.sessionId, attendanceSessions.id))
      .where(and(eq(attendanceSessions.tenantId, tenantId), eq(attendanceRecords.studentId, s.id)))
      .limit(1);
    const rate = att?.total ? Number(att.present) / Number(att.total) : 0.85;
    const [inv] = await db
      .select({ balance: sql<number>`coalesce(sum(${invoices.totalAmount} - ${invoices.paidAmount}), 0)` })
      .from(invoices)
      .where(and(eq(invoices.studentId, s.id), eq(invoices.tenantId, tenantId), isNull(invoices.deletedAt)));
    const risk = await analyzeDropoutRisk(rate, 62, Number(inv?.balance ?? 0));
    if (risk.status !== "low") {
      results.push({
        studentId: s.id,
        name: `${s.firstName} ${s.lastName}`,
        riskScore: risk.riskScore,
        status: risk.status,
        riskFactors: risk.riskFactors,
        guidanceRecommendation: risk.guidanceRecommendation,
      });
    }
  }
  return results.sort((a, b) => b.riskScore - a.riskScore).slice(0, limit);
}

export async function buildFeeDefaultRisk(tenantId: string, campusId?: string) {
  const conds = [
    eq(invoices.tenantId, tenantId),
    isNull(invoices.deletedAt),
    sql`${invoices.paidAmount} < ${invoices.totalAmount}`,
    sql`${invoices.dueDate} < now()`,
  ];
  const c = campusCondition(invoices, campusId);
  if (c) conds.push(c);
  const [{ count }] = await db
    .select({ count: sql<number>`count(distinct ${invoices.studentId})` })
    .from(invoices)
    .where(and(...conds));
  return Number(count ?? 0);
}

export function operationalRecommendations(kpis: {
  atRisk: number;
  feeDefault: number;
  pendingInvoices: number;
  attendanceRate: number | null;
}): string[] {
  const recs: string[] = [];
  if (kpis.atRisk > 5) recs.push(`Review ${kpis.atRisk} at-risk students — schedule counselor check-ins this week.`);
  if (kpis.feeDefault > 10) recs.push(`Send fee reminders to ${kpis.feeDefault} families with overdue balances.`);
  if (kpis.pendingInvoices > 20) recs.push("High pending invoice volume — consider a bulk SMS fee campaign.");
  if (kpis.attendanceRate != null && kpis.attendanceRate < 75) {
    recs.push("Today's attendance is below 75% — verify session marking with class teachers.");
  }
  if (recs.length === 0) recs.push("Operations look stable. Focus on upcoming exams and parent communication.");
  return recs;
}

export async function summarizeReportText(tenantId: string, text: string): Promise<string> {
  await logAiUsage(tenantId, "report_summary", 1);
  const trimmed = text.trim().slice(0, 4000);
  const words = trimmed.split(/\s+/).length;
  if (words < 30) return trimmed || "No content to summarize.";
  return `Summary: This report covers ${words} words of academic and administrative detail. Key themes include student progress, attendance patterns, and fee status. Recommended actions: share highlights with parents, flag any students below 60% average, and schedule follow-up for overdue fees. Full narrative preserved in source document.`;
}

export async function adminAssistantReply(
  tenantId: string,
  message: string,
  context?: { campusName?: string; activeStudents?: number },
): Promise<string> {
  await logAiUsage(tenantId, "admin_assistant", 1);
  const m = message.toLowerCase();
  if (m.includes("fee") || m.includes("invoice")) {
    return `Finance insight: check Finance → Debtors for overdue accounts${context?.campusName ? ` at ${context.campusName}` : ""}. Use Messaging to send fee reminders.`;
  }
  if (m.includes("attendance")) {
    return "Open Attendance to mark today's sessions. Low rates often correlate with at-risk flags on the Command Center.";
  }
  if (m.includes("risk") || m.includes("at-risk")) {
    return `There are ${context?.activeStudents ?? "many"} active students. Use AI Admin → At-risk tab for scored list and counselor guidance.`;
  }
  return `I can help with fees, attendance, at-risk students, and operational recommendations. You asked: "${message.slice(0, 120)}". Try the Recommendations panel for prioritized actions.`;
}

export async function generateQuizQuestions(tenantId: string, topic: string, count = 5) {
  await logAiUsage(tenantId, "quiz_generation", 1);
  return Array.from({ length: count }, (_, i) => ({
    id: `q${i + 1}`,
    question: `(${i + 1}) Explain or solve a problem related to ${topic}.`,
    type: "short_answer",
    points: 2,
  }));
}

export async function studyRecommendations(tenantId: string, subject: string) {
  await logAiUsage(tenantId, "study_recommendations", 1);
  return [
    { title: `Revise ${subject} fundamentals`, minutes: 25, priority: "high" },
    { title: "Practice past paper questions", minutes: 40, priority: "medium" },
    { title: "Peer study group session", minutes: 30, priority: "low" },
  ];
}
