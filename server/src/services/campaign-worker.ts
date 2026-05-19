import { db } from "../db";
import { campaigns, deliveryLogs, guardians, studentGuardians, students, studentClassHistory, users } from "../db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getMessagingProvider } from "./messaging";

export async function processCampaignJob(tenantId: string, payload: { campaignId: string }) {
  const provider = getMessagingProvider();
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
  } else if (campaign.audience === "staff") {
    const staffUsers = await db.select({ email: users.email, name: users.firstName }).from(users).where(eq(users.tenantId, tenantId));
    for (const u of staffUsers) {
      if (u.email) recipients.push({ to: u.email, name: u.name });
    }
  }

  const body = `Campaign: ${campaign.name}`;
  let sent = 0;
  for (const r of recipients) {
    const result = await provider.send({ to: r.to, body, channel: "sms" });
    await db.insert(deliveryLogs).values({
      tenantId,
      campaignId: campaign.id,
      recipient: r.to,
      channel: provider.name,
      status: result.success ? "sent" : "failed",
      providerRef: result.providerRef,
      error: result.error,
    });
    if (result.success) sent++;
  }

  await db.update(campaigns).set({ status: "sent", sentAt: new Date() }).where(eq(campaigns.id, campaign.id));
  return { sent, total: recipients.length };
}
