import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { platformAdmins, platformEmailCampaigns } from "../db/schema";
import { sendPlatformEmail } from "./platform-email";
import { getPlatformGeneralSettings } from "./platform-general-settings";

export type CampaignAudience = "operators" | "custom";

export type PlatformEmailCampaign = {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  audience: CampaignAudience;
  recipientEmails: string[];
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  stats: { sent?: number; failed?: number; total?: number };
  createdAt: string;
  updatedAt: string;
};

function rowToCampaign(r: typeof platformEmailCampaigns.$inferSelect): PlatformEmailCampaign {
  const stats = (r.stats ?? {}) as PlatformEmailCampaign["stats"];
  const emails = Array.isArray(r.recipientEmails) ? (r.recipientEmails as string[]) : [];
  return {
    id: r.id,
    name: r.name,
    subject: r.subject,
    bodyHtml: r.bodyHtml,
    bodyText: r.bodyText,
    audience: (r.audience as CampaignAudience) || "operators",
    recipientEmails: emails,
    status: r.status,
    scheduledAt: r.scheduledAt?.toISOString() ?? null,
    sentAt: r.sentAt?.toISOString() ?? null,
    stats,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

async function resolveRecipients(campaign: typeof platformEmailCampaigns.$inferSelect): Promise<string[]> {
  if (campaign.audience === "custom") {
    const emails = Array.isArray(campaign.recipientEmails) ? (campaign.recipientEmails as string[]) : [];
    return emails.map((e) => e.trim().toLowerCase()).filter(Boolean);
  }
  const admins = await db.select({ email: platformAdmins.email }).from(platformAdmins);
  return admins.map((a) => a.email.trim().toLowerCase()).filter(Boolean);
}

export async function listPlatformEmailCampaigns(): Promise<PlatformEmailCampaign[]> {
  const rows = await db
    .select()
    .from(platformEmailCampaigns)
    .orderBy(desc(platformEmailCampaigns.createdAt))
    .limit(100);
  return rows.map(rowToCampaign);
}

export async function createPlatformEmailCampaign(input: {
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  audience: CampaignAudience;
  recipientEmails?: string[];
  createdBy?: string;
}) {
  const [row] = await db
    .insert(platformEmailCampaigns)
    .values({
      name: input.name,
      subject: input.subject,
      bodyHtml: input.bodyHtml,
      bodyText: input.bodyText,
      audience: input.audience,
      recipientEmails: input.recipientEmails ?? [],
      status: "draft",
      createdBy: input.createdBy,
    })
    .returning();
  return rowToCampaign(row);
}

export async function updatePlatformEmailCampaign(
  id: string,
  patch: Partial<{
    name: string;
    subject: string;
    bodyHtml: string;
    bodyText: string;
    audience: CampaignAudience;
    recipientEmails: string[];
  }>,
) {
  const [existing] = await db
    .select()
    .from(platformEmailCampaigns)
    .where(eq(platformEmailCampaigns.id, id))
    .limit(1);
  if (!existing) throw new Error("Campaign not found");
  if (existing.status === "sent") throw new Error("Cannot edit a sent campaign");

  const [row] = await db
    .update(platformEmailCampaigns)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(platformEmailCampaigns.id, id))
    .returning();
  return rowToCampaign(row);
}

export async function runPlatformEmailCampaignJob(campaignId: string) {
  const [campaign] = await db
    .select()
    .from(platformEmailCampaigns)
    .where(eq(platformEmailCampaigns.id, campaignId))
    .limit(1);
  if (!campaign) throw new Error("Campaign not found");

  await db
    .update(platformEmailCampaigns)
    .set({ status: "sending", updatedAt: new Date() })
    .where(eq(platformEmailCampaigns.id, campaignId));

  const general = await getPlatformGeneralSettings();
  const recipients = [...new Set(await resolveRecipients(campaign))];
  let sent = 0;
  let failed = 0;

  const text =
    campaign.bodyText?.trim() ||
    campaign.bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  for (const to of recipients) {
    try {
      await sendPlatformEmail({
        to,
        subject: campaign.subject,
        text,
        html: campaign.bodyHtml,
        templateCode: "campaign",
      });
      sent++;
    } catch {
      failed++;
    }
  }

  const stats = { sent, failed, total: recipients.length };
  await db
    .update(platformEmailCampaigns)
    .set({
      status: "sent",
      sentAt: new Date(),
      stats,
      updatedAt: new Date(),
    })
    .where(eq(platformEmailCampaigns.id, campaignId));

  return { ...stats, platformName: general.platformName };
}

export async function sendPlatformEmailCampaignNow(campaignId: string) {
  const { enqueueJob } = await import("./queue");
  await enqueueJob(null, "platform.email_campaign", { campaignId });
  return { queued: true, campaignId };
}
