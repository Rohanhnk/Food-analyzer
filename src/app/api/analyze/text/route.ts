import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { recognitionService } from "@/server";
import { badRequest, handleRouteError } from "@/server/errors";

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);

    const body = await req.json();
    if (!body || typeof body !== "object" || typeof body.text !== "string") {
      throw badRequest("Request body must contain a valid 'text' string.", "text");
    }

    const result = await recognitionService.analyzeText(body.text);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
