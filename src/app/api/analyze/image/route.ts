import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { recognitionService } from "@/server";
import { badRequest, handleRouteError } from "@/server/errors";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    const body = await req.json();
    if (!body || typeof body !== "object" || typeof body.imageId !== "string") {
      throw badRequest("Request body must contain 'imageId'.", "imageId");
    }

    const result = await recognitionService.analyzeImage(user.userId, body.imageId);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
