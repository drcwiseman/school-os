import { db } from "../db";
import { campaigns, guardians, studentGuardians, students, studentClassHistory, users, messageTemplates, studentAccounts } from "../db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { sendTenantMessage } from "./tenant-messaging";
import { incrementUsage, checkUsageAllowed } from "./usage-billing";

export async function processCampaignJob(tenantId: string, payload: { campaignId: string }) {
  const [campaign] = await db.select().from(campaigns).where(and(eq(campaigns.id, payload.campaignId), eq(campaigns.tenantId, tenantId))).limit(1);
  if (!campaign) throw new Error("Campaign not found");

  const recipients: { to: string; name: string }[] = [];
  const classId = (campaign.audienceFilter as Record<string, string> | null)?.classId;

  if (campaign.audience === "parents") {
    const links = await db.select({ phone: guardians.phone, email: guardians.email, name: guardians.firstName })
      .from(studentGuardians)
      .innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
      .where(eq(guardians.tenantId, tenantId));
    for (const l of links) {
      const to = l.phone || l.email;
      if (to) recipients.push({ to, name: l.name });
    }
  } else if (campaign.audience === "parents_of_class" && classId) {
    const links = await db
      .select({ phone: guardians.phone, email: guardians.email, name: guardians.firstName })
      .from(studentGuardians)
      .innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
      .innerJoin(students, eq(studentGuardians.studentId, students.id))
      .innerJoin(studentClassHistory, and(
        eq(studentClassHistory.studentId, students.id),
        eq(studentClassHistory.classId, classId),
        isNull(studentClassHistory.toDate),
      ))
      .where(eq(guardians.tenantId, tenantId));
    for (const l of links) {
      const to = l.phone || l.email;
      if (to) recipients.push({ to, name: l.name });
    }
  } else if (campaign.audience === "students") {
    const accs = await db.select({ email: studentAccounts.email }).from(studentAccounts).where(eq(studentAccounts.tenantId, tenantId));
    for (const a of accs) {
      if (a.email) recipients.push({ to: a.email, name: "Student" });
    }
  } else if (campaign.audience === "staff") {
    const staffUsers = await db.select({ email: users.email, name: users.firstName }).from(users).where(eq(users.tenantId, tenantId));
    for (const u of staffUsers) {
      if (u.email) recipients.push({ to: u.email, name: u.name });
    }
  }

  let body = campaign.name;
  let subject = campaign.name;
  let channel: "sms" | "email" | "whatsapp" = (campaign.channel as "sms" | "email" | "whatsapp") ?? "sms";

  if (campaign.templateId) {
    const [tpl] = await db.select().from(messageTemplates)
      .where(eq(messageTemplates.id, campaign.templateId)).limit(1);
    if (tpl) {
      body = tpl.body;
      subject = tpl.subject ?? campaign.name;
      channel = (tpl.channel as "sms" | "email" | "whatsapp") ?? channel;
    }
  }

  let sent = 0;
  for (const r of recipients) {
    const resolvedChannel = channel === "email" ? "email" : channel === "whatsapp" ? "whatsapp" : (r.to.includes("@") ? "email" : "sms");
    const gate = await checkUsageAllowed(tenantId, "sms_volume", 1);
    if (!gate.allowed) break;
    const result = await sendTenantMessage(tenantId, {
      to: r.to,
      body,
      channel: resolvedChannel,
      subject: resolvedChannel === "email" ? subject : undefined,
      campaignId: campaign.id,
    });
    if (result.success) {
      sent++;
      await incrementUsage(tenantId, "sms_volume", 1);
    }
  }

  await db.update(campaigns).set({ status: "sent", sentAt: new Date() }).where(eq(campaigns.id, campaign.id));
  return { sent, total: recipients.length };
}
