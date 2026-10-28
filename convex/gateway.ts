import { ConvexError } from "convex/values";
/** Only the authenticated Next.js server holds this capability. Never expose it to browsers. */
export function requireBackend(secret: string): void {
  const expected = process.env.NOURISH_BACKEND_SECRET;
  if (!expected || expected.length < 32 || secret !== expected) {
    throw new ConvexError("Unauthorized backend request");
  }
}
