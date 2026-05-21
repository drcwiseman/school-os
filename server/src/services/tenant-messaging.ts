import { db } from "../db";
import {
  guardians, studentGuardians, students, studentClassHistory, users,
  parentAccounts, studentAccounts, tenantSettings,
} from "../db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getMessagingProvider } from "./messaging";
import { sendTenantEmail } from "./tenant-email";
import type { TenantSmtpSettings } from "../db/schema";
import { deliveryLogs, systemNotifications } from "../db/schema";

export type MessageAudience =
  | "parents"
  | "staff"
  | "students"
  | "parents_of_class"
  | "all_portal";

export async function resolveMessageRecipients(
  tenantId: string,
  audience: MessageAudience,
  filter?: { classId?: string },
): Promise<Array<{ to: string; name: string; channel: "sms" | "email" }>> {
  const seen = new Set<string>();
  const out: Array<{ to: string; name: string; channel: "sms" | "email" }> = [];

  const push = (to: string | null | undefined, name: string, prefer: "sms" | "email") => {
    if (!to || seen.has(to)) return;
    seen.add(to);
    const channel = to.includes("@") ? "email" : prefer;
    out.push({ to, name, channel });
  };

  if (audience === "staff") {
    const staffUsers = await db.select({ email: users.email, name: users.firstName })
      .from(users).where(eq(users.tenantId, tenantId));
    for (const u of staffUsers) {
      push(u.email, u.name ?? "Staff", "email");
    }
    return out;
  }

  if (audience === "students") {
    const accs = await db.select({ email: studentAccounts.email, phone: students.phone, name: students.firstName })
      .from(studentAccounts)
      .innerJoin(students, eq(studentAccounts.studentId, students.id))
      .where(eq(studentAccounts.tenantId, tenantId));
    for (const a of accs) {
      push(a.phone, a.name ?? "Student", "sms");
      push(a.email, a.name ?? "Student", "email");
    }
    const activeStudents = await db.select({ phone: students.phone, email: students.email, name: students.firstName })
      .from(students).where(and(eq(students.tenantId, tenantId), eq(students.status, "active"), isNull(students.deletedAt)));
    for (const s of activeStudents) {
      push(s.phone, s.name ?? "Student", "sms");
      push(s.email, s.name ?? "Student", "email");
    }
    return out;
  }

  if (audience === "parents" || audience === "parents_of_class" || audience === "all_portal") {
    let links;
    if (audience === "parents_of_class" && filter?.classId) {
      links = await db.select({ phone: guardians.phone, email: guardians.email, name: guardians.firstName })
        .from(studentGuardians)
        .innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
        .innerJoin(students, eq(studentGuardians.studentId, students.id))
        .innerJoin(studentClassHistory, and(
          eq(studentClassHistory.studentId, students.id),
          eq(studentClassHistory.classId, filter.classId),
          isNull(studentClassHistory.toDate),
        ))
        .where(eq(guardians.tenantId, tenantId));
    } else {
      links = await db.select({ phone: guardians.phone, email: guardians.email, name: guardians.firstName })
        .from(studentGuardians)
        .innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
        .where(eq(guardians.tenantId, tenantId));
      const parentAccs = await db.select({ email: parentAccounts.email })
        .from(parentAccounts).where(eq(parentAccounts.tenantId, tenantId));
      for (const p of parentAccs) push(p.email, "Parent", "email");
    }
    for (const l of links ?? []) {
      push(l.phone, l.name ?? "Parent", "sms");
      push(l.email, l.name ?? "Parent", "email");
    }
  }

  return out;
}

export async function sendTenantMessage(
  tenantId: string,
  input: {
    to: string;
    subject?: string;
    body: string;
    channel: "sms" | "email" | "whatsapp";
    campaignId?: string;
    announcementId?: string;
  },
): Promise<{ success: boolean; providerRef?: string; error?: string }> {
  if (input.channel === "email") {
    const [settings] = await db.select({ smtp: tenantSettings.smtpSettingsJson })
      .from(tenantSettings).where(eq(tenantSettings.tenantId, tenantId)).limit(1);
    const smtp = (settings?.smtp ?? {}) as TenantSmtpSettings;
    if (smtp.enabled && smtp.host) {
      try {
        await sendTenantEmail(tenantId, smtp, {
          to: input.to,
          subject: input.subject ?? "School notification",
          text: input.body,
        });
        await logDelivery(tenantId, { ...input, success: true, channel: "email" });
        return { success: true, providerRef: `smtp-${Date.now()}` };
      } catch (err) {
        const msg = (err as Error).message;
        await logDelivery(tenantId, { ...input, success: false, channel: "email", error: msg });
        return { success: false, error: msg };
      }
    }
  }

  const provider = getMessagingProvider();
  const result = await provider.send({
    to: input.to,
    body: input.body,
    subject: input.subject,
    channel: input.channel,
  });
  await logDelivery(tenantId, {
    ...input,
    success: result.success,
    channel: input.channel,
    error: result.error,
    providerRef: result.providerRef,
  });
  return result;
}

async function logDelivery(
  tenantId: string,
  opts: {
    to: string;
    channel: string;
    success: boolean;
    error?: string;
    providerRef?: string;
    campaignId?: string;
    announcementId?: string;
  },
) {
  await db.insert(deliveryLogs).values({
    tenantId,
    campaignId: opts.campaignId,
    announcementId: opts.announcementId,
    recipient: opts.to,
    channel: opts.channel,
    status: opts.success ? "sent" : "failed",
    providerRef: opts.providerRef,
    error: opts.error,
  });
}

export async function broadcastAnnouncement(
  tenantId: string,
  announcement: { id: string; title: string; body: string; audience: string },
  channels: Array<"sms" | "email" | "in_app">,
  audienceFilter?: { classId?: string },
): Promise<{ sent: number; failed: number; inApp: number }> {
  let sent = 0;
  let failed = 0;
  let inApp = 0;

  const audienceMap: Record<string, MessageAudience> = {
    all: "all_portal",
    parents: "parents",
    staff: "staff",
    students: "students",
  };
  const aud = audienceMap[announcement.audience] ?? "parents";

  if (channels.includes("in_app")) {
    const staffUsers = await db.select({ id: users.id }).from(users).where(eq(users.tenantId, tenantId));
    for (const u of staffUsers) {
      await db.insert(systemNotifications).values({
        tenantId,
        userId: u.id,
        title: announcement.title,
        body: announcement.body.slice(0, 500),
        category: "announcement",
        link: `/messaging`,
      });
      inApp++;
    }
  }

  const needsExternal = channels.some((c) => c === "sms" || c === "email");
  if (needsExternal) {
    const recipients = await resolveMessageRecipients(tenantId, aud, audienceFilter);
    for (const r of recipients) {
      for (const ch of channels) {
        if (ch !== "sms" && ch !== "email") continue;
        if (ch === "email" && r.channel !== "email") continue;
        if (ch === "sms" && r.channel !== "sms") continue;
        const result = await sendTenantMessage(tenantId, {
          to: r.to,
          subject: announcement.title,
          body: `${announcement.title}\n\n${announcement.body}`,
          channel: ch,
          announcementId: announcement.id,
        });
        if (result.success) sent++;
        else failed++;
      }
    }
  }

  return { sent, failed, inApp };
}
