import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { storage } from "@/server";
import { badRequest, handleRouteError } from "@/server/errors";
import { validateGoal, validateLocalDate } from "@/server/validation";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const { searchParams } = new URL(req.url);

    const dateParam = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    const date = validateLocalDate(dateParam, "date");

    const result = await storage.getEffectiveGoal(user.userId, date);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();

    if (!body || typeof body !== "object") {
      throw badRequest("Request body must be a valid JSON object.");
    }

    const validatedGoal = validateGoal(body.goal, "goal");
    const effectiveDate = validateLocalDate(body.effectiveDate, "effectiveDate");

    const result = await storage.saveGoal(user.userId, validatedGoal, effectiveDate);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
