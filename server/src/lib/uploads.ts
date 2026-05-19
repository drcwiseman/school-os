import path from "path";
import fs from "fs";
import { ForbiddenError, NotFoundError } from "../middleware/error";

const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads");

/** Tenant-isolated upload directory: uploads/{tenantId}/... */
export function tenantUploadDir(tenantId: string, ...segments: string[]): string {
  const safe = segments.map((s) => s.replace(/[^a-zA-Z0-9._-]/g, "_"));
  const dir = path.resolve(UPLOAD_ROOT, tenantId, ...safe);
  const tenantRoot = path.resolve(UPLOAD_ROOT, tenantId);
  if (!dir.startsWith(tenantRoot + path.sep) && dir !== tenantRoot) {
    throw new ForbiddenError("Invalid upload path");
  }
  return dir;
}

export function writeTenantFile(
  tenantId: string,
  segments: string[],
  fileName: string,
  buffer: Buffer,
): string {
  const dir = tenantUploadDir(tenantId, ...segments);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

/** Resolve a stored file path and ensure it stays under uploads/{tenantId}/ */
export function resolveTenantFile(tenantId: string, storedPath: string): string {
  const resolved = path.resolve(storedPath);
  const tenantRoot = path.resolve(UPLOAD_ROOT, tenantId);
  if (!resolved.startsWith(tenantRoot + path.sep)) {
    throw new ForbiddenError("File access denied");
  }
  if (!fs.existsSync(resolved)) throw new NotFoundError("File not found");
  return resolved;
}
