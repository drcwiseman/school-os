import { db } from "../db";
import { platformMedia, platformAdmins } from "../db/schema";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { NotFoundError } from "../middleware/error";
import { writePlatformFile, deletePlatformFile } from "../lib/platform-uploads";
import { validatePlatformUpload, isImageMime } from "../middleware/platform-upload";

export type PlatformMediaRow = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  altText: string | null;
  title: string | null;
  url: string;
  isImage: boolean;
  uploadedByName: string | null;
  createdAt: string;
};

function publicMediaUrl(id: string): string {
  return `/api/public/media/${id}/file`;
}

function mapRow(r: {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  altText: string | null;
  title: string | null;
  uploadedByName: string | null;
  createdAt: Date;
}): PlatformMediaRow {
  return {
    id: r.id,
    fileName: r.fileName,
    mimeType: r.mimeType,
    sizeBytes: r.sizeBytes,
    altText: r.altText,
    title: r.title,
    url: publicMediaUrl(r.id),
    isImage: isImageMime(r.mimeType),
    uploadedByName: r.uploadedByName,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : new Date(r.createdAt).toISOString(),
  };
}

export async function listPlatformMedia(opts?: {
  search?: string;
  type?: "all" | "images" | "documents";
  limit?: number;
}) {
  const limit = Math.min(opts?.limit ?? 500, 500);
  const conditions = [];
  if (opts?.search?.trim()) {
    const q = `%${opts.search.trim()}%`;
    conditions.push(or(
      ilike(platformMedia.fileName, q),
      ilike(platformMedia.altText, q),
      ilike(platformMedia.title, q),
    )!);
  }
  if (opts?.type === "images") {
    conditions.push(sql`${platformMedia.mimeType} LIKE 'image/%'`);
  } else if (opts?.type === "documents") {
    conditions.push(sql`${platformMedia.mimeType} NOT LIKE 'image/%'`);
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: platformMedia.id,
      fileName: platformMedia.fileName,
      mimeType: platformMedia.mimeType,
      sizeBytes: platformMedia.sizeBytes,
      altText: platformMedia.altText,
      title: platformMedia.title,
      uploadedByName: platformAdmins.name,
      createdAt: platformMedia.createdAt,
    })
    .from(platformMedia)
    .leftJoin(platformAdmins, eq(platformMedia.uploadedBy, platformAdmins.id))
    .where(where)
    .orderBy(desc(platformMedia.createdAt))
    .limit(limit);

  const items = rows.map(mapRow);
  return {
    summary: {
      total: items.length,
      images: items.filter((i) => i.isImage).length,
      documents: items.filter((i) => !i.isImage).length,
    },
    items,
  };
}

export async function getPlatformMediaById(id: string) {
  const [row] = await db
    .select({
      id: platformMedia.id,
      fileName: platformMedia.fileName,
      storedPath: platformMedia.storedPath,
      mimeType: platformMedia.mimeType,
      sizeBytes: platformMedia.sizeBytes,
      altText: platformMedia.altText,
      title: platformMedia.title,
      uploadedByName: platformAdmins.name,
      createdAt: platformMedia.createdAt,
    })
    .from(platformMedia)
    .leftJoin(platformAdmins, eq(platformMedia.uploadedBy, platformAdmins.id))
    .where(eq(platformMedia.id, id))
    .limit(1);
  if (!row) throw new NotFoundError("Media not found");
  return { ...mapRow(row), storedPath: row.storedPath };
}

export async function createPlatformMedia(
  adminId: string | undefined,
  body: {
    fileName: string;
    contentBase64: string;
    mimeType?: string;
    altText?: string;
    title?: string;
  },
) {
  const { safeName, size, mime } = validatePlatformUpload(
    body.fileName,
    body.mimeType,
    body.contentBase64,
  );
  const buffer = Buffer.from(body.contentBase64, "base64");
  if (buffer.length !== size) throw new Error("Invalid file payload");

  const diskName = `${Date.now()}_${safeName}`;
  const storedPath = writePlatformFile(diskName, buffer);

  const [row] = await db.insert(platformMedia).values({
    fileName: safeName,
    storedPath,
    mimeType: mime,
    sizeBytes: size,
    altText: body.altText?.trim() || null,
    title: body.title?.trim() || safeName,
    uploadedBy: adminId,
  }).returning();

  return getPlatformMediaById(row.id);
}

export async function updatePlatformMedia(
  id: string,
  patch: { altText?: string | null; title?: string | null },
) {
  const [existing] = await db.select().from(platformMedia).where(eq(platformMedia.id, id)).limit(1);
  if (!existing) throw new NotFoundError("Media not found");

  const updates: Record<string, unknown> = {};
  if (patch.altText !== undefined) updates.altText = patch.altText?.trim() || null;
  if (patch.title !== undefined) updates.title = patch.title?.trim() || null;

  if (Object.keys(updates).length > 0) {
    await db.update(platformMedia).set(updates).where(eq(platformMedia.id, id));
  }
  return getPlatformMediaById(id);
}

export async function deletePlatformMedia(id: string) {
  const row = await getPlatformMediaById(id);
  try {
    deletePlatformFile(row.storedPath);
  } catch {
    /* file may already be missing */
  }
  await db.delete(platformMedia).where(eq(platformMedia.id, id));
  return { deleted: true, id };
}

export async function servePlatformMediaFile(id: string) {
  const row = await getPlatformMediaById(id);
  const { resolvePlatformFile } = await import("../lib/platform-uploads");
  const absPath = resolvePlatformFile(row.storedPath);
  return {
    absPath,
    mimeType: row.mimeType,
    fileName: row.fileName,
    altText: row.altText,
  };
}
