import { BadRequestError } from "./error";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "text/csv",
]);

const MAX_BASE64_BYTES = 5 * 1024 * 1024;

export function validateUpload(fileName: string, mimeType: string | undefined, base64: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!safeName || safeName.length > 200) throw new BadRequestError("Invalid file name");
  if (mimeType && !ALLOWED_MIME.has(mimeType)) {
    throw new BadRequestError(`File type not allowed: ${mimeType}`);
  }
  const size = Buffer.byteLength(base64, "base64");
  if (size > MAX_BASE64_BYTES) throw new BadRequestError("File exceeds 5MB limit");
  return { safeName, size };
}
