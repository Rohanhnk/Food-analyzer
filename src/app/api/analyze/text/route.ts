import { analysisRateLimiter } from "@/server/rate-limiter";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { recognitionService } from "@/server";
import { ApiError, badRequest, handleRouteError } from "@/server/errors";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    if (process.env.NODE_ENV !== "test" && process.env.ENABLE_AI !== "true") throw new ApiError("SERVICE_UNAVAILABLE", "AI is disabled. Log foods manually or enable AI in server settings.", 503);
    const body = await req.json();
    if (!body || typeof body !== "object" || typeof body.text !== "string") {
      throw badRequest("Request body must contain a valid 'text' string.", "text");
    }

    analysisRateLimiter.assertAllowed(user.userId, 1, "Meal recognition");
    const result = await recognitionService.analyzeText(body.text);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
