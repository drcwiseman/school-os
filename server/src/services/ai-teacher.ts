import { trackTenantUsage } from "./billing-usage";

export async function generateLessonPlan(opts: {
  tenantId: string;
  subject: string;
  className: string;
  topic: string;
  durationMinutes?: number;
}): Promise<{ title: string; content: string }> {
  await trackTenantUsage(opts.tenantId, "ai_credits", 1);
  const duration = opts.durationMinutes ?? 40;
  const content = `# ${opts.topic}

**Subject:** ${opts.subject} · **Class:** ${opts.className} · **Duration:** ${duration} minutes

## Learning objectives
- Students will explain key concepts related to ${opts.topic}.
- Students will apply knowledge through guided practice.

## Starter (5 min)
Brief recap and hook question about ${opts.topic}.

## Main activity (${Math.max(20, duration - 15)} min)
1. Teacher explanation with examples
2. Pair work or group discussion
3. Individual practice exercise

## Plenary (5 min)
Exit ticket: one thing learned, one question remaining.

## Homework
Short reading or worksheet reinforcing ${opts.topic}.`;

  return { title: opts.topic, content };
}

export async function generateReportComment(opts: {
  tenantId: string;
  studentName: string;
  averageScore: number;
  attendanceRate: number;
}): Promise<string> {
  await trackTenantUsage(opts.tenantId, "ai_credits", 1);
  const tone = opts.averageScore >= 70 ? "commend" : opts.averageScore >= 50 ? "encourage" : "support";
  const att = opts.attendanceRate >= 0.9 ? "excellent attendance" : opts.attendanceRate >= 0.75 ? "generally good attendance" : "attendance needs improvement";
  if (tone === "commend") {
    return `${opts.studentName} has shown strong progress this term with ${att}. They participate actively and demonstrate solid understanding. Continue to challenge them with extension tasks.`;
  }
  if (tone === "encourage") {
    return `${opts.studentName} is making steady progress with ${att}. Additional practice at home and focused support in class will help consolidate learning.`;
  }
  return `${opts.studentName} would benefit from closer support this term. With ${att}, a structured revision plan and regular check-ins are recommended. Parents are encouraged to partner with the school on catch-up work.`;
}
