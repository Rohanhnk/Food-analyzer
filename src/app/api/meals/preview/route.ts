import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { nutritionService } from "@/server";
import { badRequest, handleRouteError } from "@/server/errors";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    const body = await req.json();
    if (!body || typeof body !== "object" || !Array.isArray(body.items)) {
      throw badRequest("Request body must contain an 'items' array.", "items");
    }

    const result = await nutritionService.calculateMealItems(user.userId, body.items);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
