import { db } from "../db";
import {
  tenants,
  users,
  platformAdmins,
  platformSupportTickets,
  invoices,
  students,
} from "../db/schema";
import { and, eq, ilike, isNull, or, sql } from "drizzle-orm";

export type PlatformSearchResult = {
  id: string;
  type: "school" | "platform_user" | "support_ticket" | "invoice";
  title: string;
  subtitle: string;
  href: string;
};

export type PlatformSearchResponse = {
  query: string;
  results: PlatformSearchResult[];
  counts: {
    schools: number;
    platformUsers: number;
    supportTickets: number;
    invoices: number;
  };
};

const PER_GROUP = 6;

export async function searchPlatform(query: string, limit = 20): Promise<PlatformSearchResponse> {
  const term = query.trim();
  if (term.length < 2) {
    return {
      query: term,
      results: [],
      counts: { schools: 0, platformUsers: 0, supportTickets: 0, invoices: 0 },
    };
  }

  const pattern = `%${term}%`;
  const max = Math.min(Math.max(limit, 1), 40);

  const [schoolRows, adminRows, ticketRows, invoiceRows] = await Promise.all([
    db
      .select({
        id: tenants.id,
        slug: tenants.slug,
        name: tenants.name,
        status: tenants.status,
        subdomain: tenants.subdomain,
        customDomain: tenants.customDomain,
      })
      .from(tenants)
      .where(
        or(
          ilike(tenants.name, pattern),
          ilike(tenants.slug, pattern),
          sql`coalesce(${tenants.subdomain}, '') ILIKE ${pattern}`,
          sql`coalesce(${tenants.customDomain}, '') ILIKE ${pattern}`,
        ),
      )
      .limit(PER_GROUP),

    db
      .select({
        id: platformAdmins.id,
        name: platformAdmins.name,
        email: platformAdmins.email,
        role: platformAdmins.role,
      })
      .from(platformAdmins)
      .where(or(ilike(platformAdmins.name, pattern), ilike(platformAdmins.email, pattern)))
      .limit(PER_GROUP),

    db
      .select({
        id: platformSupportTickets.id,
        subject: platformSupportTickets.subject,
        status: platformSupportTickets.status,
        requesterEmail: platformSupportTickets.requesterEmail,
      })
      .from(platformSupportTickets)
      .where(
        or(
          ilike(platformSupportTickets.subject, pattern),
          ilike(platformSupportTickets.description, pattern),
          sql`coalesce(${platformSupportTickets.requesterEmail}, '') ILIKE ${pattern}`,
          sql`coalesce(${platformSupportTickets.requesterName}, '') ILIKE ${pattern}`,
        ),
      )
      .limit(PER_GROUP),

    db
      .select({
        id: invoices.id,
        invoiceNo: invoices.invoiceNo,
        tenantSlug: tenants.slug,
        tenantName: tenants.name,
        studentFirst: students.firstName,
        studentLast: students.lastName,
      })
      .from(invoices)
      .innerJoin(tenants, eq(tenants.id, invoices.tenantId))
      .innerJoin(students, eq(students.id, invoices.studentId))
      .where(
        and(
          isNull(invoices.deletedAt),
          or(
            ilike(invoices.invoiceNo, pattern),
            ilike(tenants.name, pattern),
            ilike(tenants.slug, pattern),
            ilike(students.firstName, pattern),
            ilike(students.lastName, pattern),
          ),
        ),
      )
      .limit(PER_GROUP),
  ]);

  // Also match schools by admin email
  const adminEmailSchools = await db
    .select({
      id: tenants.id,
      slug: tenants.slug,
      name: tenants.name,
      status: tenants.status,
      email: users.email,
    })
    .from(users)
    .innerJoin(tenants, eq(tenants.id, users.tenantId))
    .where(ilike(users.email, pattern))
    .limit(PER_GROUP);

  const schoolMap = new Map<string, PlatformSearchResult>();
  for (const s of schoolRows) {
    schoolMap.set(s.id, {
      id: s.id,
      type: "school",
      title: s.name,
      subtitle: [s.slug, s.subdomain, s.customDomain].filter(Boolean).join(" · ") || s.status,
      href: `/platform/tenants/${s.slug}`,
    });
  }
  for (const s of adminEmailSchools) {
    if (!schoolMap.has(s.id)) {
      schoolMap.set(s.id, {
        id: s.id,
        type: "school",
        title: s.name,
        subtitle: `Admin: ${s.email}`,
        href: `/platform/tenants/${s.slug}`,
      });
    }
  }

  const results: PlatformSearchResult[] = [];

  for (const s of schoolMap.values()) {
    results.push(s);
    if (results.length >= max) break;
  }

  for (const a of adminRows) {
    if (results.length >= max) break;
    results.push({
      id: a.id,
      type: "platform_user",
      title: a.name,
      subtitle: `${a.email} · ${a.role}`,
      href: "/platform/users",
    });
  }

  for (const t of ticketRows) {
    if (results.length >= max) break;
    results.push({
      id: t.id,
      type: "support_ticket",
      title: t.subject,
      subtitle: [t.status, t.requesterEmail].filter(Boolean).join(" · "),
      href: "/platform/support",
    });
  }

  for (const inv of invoiceRows) {
    if (results.length >= max) break;
    results.push({
      id: inv.id,
      type: "invoice",
      title: inv.invoiceNo,
      subtitle: `${inv.tenantName} · ${inv.studentFirst} ${inv.studentLast}`.trim(),
      href: "/platform/invoices",
    });
  }

  return {
    query: term,
    results: results.slice(0, max),
    counts: {
      schools: schoolMap.size,
      platformUsers: adminRows.length,
      supportTickets: ticketRows.length,
      invoices: invoiceRows.length,
    },
  };
}
