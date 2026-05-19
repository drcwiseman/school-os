import { db } from "../db";
import { announcements } from "../db/schema";
import { eq, and, lte, isNotNull } from "drizzle-orm";

/** Flip scheduled announcements to published once publish_at has passed. */
export async function promoteScheduledAnnouncements(tenantId: string) {
  await db.update(announcements).set({ published: true }).where(and(
    eq(announcements.tenantId, tenantId),
    eq(announcements.published, false),
    isNotNull(announcements.publishAt),
    lte(announcements.publishAt, new Date()),
  ));
}
