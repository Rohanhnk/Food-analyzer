import { ApiError, forbidden } from "./errors";
export function requirePersonalAccount(userId: string, allowedUserId = process.env.PERSONAL_USER_ID): void {
  if (!allowedUserId?.trim()) throw new ApiError("SERVICE_UNAVAILABLE", "Private account access is not configured. Set PERSONAL_USER_ID on the server to your Clerk user ID.", 503);
  if (userId !== allowedUserId.trim()) throw forbidden("This tracker is private. Sign in with its owner's account.");
}
