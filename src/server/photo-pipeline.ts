import { badRequest, forbidden, notFound, payloadTooLarge } from "./errors";
import { uploadRateLimiter } from "./rate-limiter";
import type { StorageRepository } from "./storage/interface";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB limit
export const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Validates image magic bytes to prevent MIME spoofing */
export function validateImageMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 12) return false;

  // JPEG: FF D8 FF
  if (mimeType === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (mimeType === "image/png") {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  // WebP: RIFF .... WEBP
  if (mimeType === "image/webp") {
    const isRiff = buffer.toString("ascii", 0, 4) === "RIFF";
    const isWebp = buffer.toString("ascii", 8, 12) === "WEBP";
    return isRiff && isWebp;
  }

  return false;
}

export class PhotoPipeline {
  constructor(private readonly storage: StorageRepository) {}

  async processUpload(
    ownerId: string,
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string
  ): Promise<{ imageId: string }> {
    // 1. Rate limiting
    uploadRateLimiter.assertAllowed(ownerId, 1, "Image upload");

    // 2. Size check
    if (fileBuffer.length > MAX_UPLOAD_BYTES) {
      throw payloadTooLarge(`Image exceeds maximum allowed size of 10 MB (${fileBuffer.length} bytes).`);
    }

    if (fileBuffer.length === 0) {
      throw badRequest("Uploaded file is empty.", "file");
    }

    // 3. MIME type check
    const normalizedMime = mimeType.toLowerCase().trim();
    if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
      throw badRequest(`Unsupported media type "${mimeType}". Allowed types: image/jpeg, image/png, image/webp.`, "mimeType");
    }

    // 4. Magic bytes validation
    if (!validateImageMagicBytes(fileBuffer, normalizedMime)) {
      throw badRequest("File content does not match the specified image media type.", "file");
    }

    const imageId = `img_${crypto.randomUUID()}`;
    const storageId = `storage_${crypto.randomUUID()}`;

    await this.storage.saveImageRecord({
      id: imageId,
      ownerId,
      storageId,
      originalName,
      mimeType: normalizedMime,
      sizeBytes: fileBuffer.length,
      status: "pending",
      createdAt: new Date().toISOString(),
      buffer: fileBuffer,
    });

    return { imageId };
  }

  async deleteImage(ownerId: string, imageId: string): Promise<void> {
    const img = await this.storage.findImageById(ownerId, imageId);
    if (!img) {
      throw notFound(`Image "${imageId}" not found or unauthorized.`);
    }

    if (img.ownerId !== ownerId) {
      throw forbidden("You are not authorized to delete this image.");
    }

    await this.storage.deleteImageRecord(ownerId, imageId);
  }
}
