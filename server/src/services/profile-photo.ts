import fs from "fs";
import path from "path";
import { writeTenantFile, tenantUploadDir } from "../lib/uploads";

export type ProfilePhotoKind = "student" | "guardian" | "staff";

const PHOTO_NAME = "photo.jpg";

export function profilePhotoApiPath(slug: string, scope: "portal" | "staff") {
  return scope === "portal"
    ? `/s/${slug}/api/portal/profile/photo`
    : `/s/${slug}/api/auth/profile/photo`;
}

export function profilePhotoDiskPath(tenantId: string, kind: ProfilePhotoKind, entityId: string) {
  return path.join(tenantUploadDir(tenantId, "profiles", kind, entityId), PHOTO_NAME);
}

export function profilePhotoExists(tenantId: string, kind: ProfilePhotoKind, entityId: string) {
  return fs.existsSync(profilePhotoDiskPath(tenantId, kind, entityId));
}

export function writeProfilePhoto(
  tenantId: string,
  kind: ProfilePhotoKind,
  entityId: string,
  buffer: Buffer,
) {
  writeTenantFile(tenantId, ["profiles", kind, entityId], PHOTO_NAME, buffer);
}

export function readProfilePhotoFile(tenantId: string, kind: ProfilePhotoKind, entityId: string) {
  const p = profilePhotoDiskPath(tenantId, kind, entityId);
  if (!fs.existsSync(p)) return null;
  return p;
}
