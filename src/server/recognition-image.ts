import sharp from "sharp";
import { LIMITS, RecognitionError } from "@nourish/recognition";
/** Decode, bound pixel count, orient and strip metadata before sending a photo upstream. */
export async function prepareRecognitionImage(bytes: Uint8Array): Promise<Uint8Array> {
  if (!bytes.length || bytes.length > LIMITS.imageBytes) throw new RecognitionError("INVALID_INPUT", "Photo must be no larger than 5 MB.");
  try {
    const image = sharp(bytes, { limitInputPixels: 16_000_000, animated: false });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? "")) throw new Error("Unsupported image format");
    return await image.rotate().resize({ width: 1536, height: 1536, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
  } catch { throw new RecognitionError("INVALID_INPUT", "The photo could not be decoded or exceeds the 16-megapixel limit. Try a smaller JPEG, PNG or WebP."); }
}
