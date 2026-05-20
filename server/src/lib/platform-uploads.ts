import path from "path";
import fs from "fs";
import { ForbiddenError, NotFoundError } from "../middleware/error";

const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads");
const PLATFORM_ROOT = path.resolve(UPLOAD_ROOT, "platform");

export function platformUploadDir(...segments: string[]): string {
  const safe = segments.map((s) => s.replace(/[^a-zA-Z0-9._-]/g, "_"));
  const dir = path.resolve(PLATFORM_ROOT, ...safe);
  if (!dir.startsWith(PLATFORM_ROOT + path.sep) && dir !== PLATFORM_ROOT) {
    throw new ForbiddenError("Invalid upload path");
  }
  return dir;
}

export function writePlatformFile(fileName: string, buffer: Buffer): string {
  fs.mkdirSync(PLATFORM_ROOT, { recursive: true });
  const filePath = path.join(PLATFORM_ROOT, fileName);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(PLATFORM_ROOT + path.sep)) {
    throw new ForbiddenError("Invalid file path");
  }
  fs.writeFileSync(resolved, buffer);
  return resolved;
}

export function resolvePlatformFile(storedPath: string): string {
  const resolved = path.resolve(storedPath);
  if (!resolved.startsWith(PLATFORM_ROOT + path.sep)) {
    throw new ForbiddenError("File access denied");
  }
  if (!fs.existsSync(resolved)) throw new NotFoundError("File not found");
  return resolved;
}

export function deletePlatformFile(storedPath: string): void {
  const resolved = resolvePlatformFile(storedPath);
  fs.unlinkSync(resolved);
}
