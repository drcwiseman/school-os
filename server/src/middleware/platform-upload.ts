import { BadRequestError } from "./error";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "text/plain",
  "text/csv",
]);

const MAX_BYTES = 10 * 1024 * 1024;

export function validatePlatformUpload(fileName: string, mimeType: string | undefined, base64: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!safeName || safeName.length > 200) throw new BadRequestError("Invalid file name");
  const mime = mimeType?.toLowerCase() || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) {
    throw new BadRequestError(`File type not allowed: ${mime}`);
  }
  const size = Buffer.byteLength(base64, "base64");
  if (size > MAX_BYTES) throw new BadRequestError("File exceeds 10MB limit");
  if (size === 0) throw new BadRequestError("Empty file");
  return { safeName, size, mime };
}

export function isImageMime(mime: string) {
  return mime.startsWith("image/");
}
