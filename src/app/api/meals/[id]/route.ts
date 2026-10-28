import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { nutritionService, storage } from "@/server";
import { badRequest, handleRouteError, notFound } from "@/server/errors";
import {
  validateInputType,
  validateLocalDate,
  validateMealType,
  validateTimezone,
} from "@/server/validation";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;

    const meal = await storage.findMealById(user.userId, id);
    if (!meal) {
      throw notFound(`Meal with ID "${id}" not found.`);
    }

    return NextResponse.json({ meal });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;

    const existing = await storage.findMealById(user.userId, id);
    if (!existing) {
      throw notFound(`Meal with ID "${id}" not found.`);
    }

    const body = await req.json();
    if (!body || typeof body !== "object") {
      throw badRequest("Request body must be a valid JSON object.");
    }

    const date = body.date !== undefined ? validateLocalDate(body.date, "date") : existing.date;
    const timezone = body.timezone !== undefined ? validateTimezone(body.timezone, "timezone") : (existing.timezone ?? "UTC");
    const type = body.type !== undefined ? validateMealType(body.type, "type") : existing.type;
    const inputType = body.inputType !== undefined ? validateInputType(body.inputType, "inputType") : existing.inputType;
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : existing.title;
    const imageId = body.imageId !== undefined ? (typeof body.imageId === "string" ? body.imageId : undefined) : existing.imageId;

    let items = existing.items;
    if (Array.isArray(body.items)) {
      if (body.items.length === 0) {
        throw badRequest("Field 'items' cannot be empty.", "items");
      }
      if (body.items.some((item: { confirmed?: unknown }) => !item || item.confirmed !== true)) throw badRequest("Confirm every portion before saving.");
      const calculated = await nutritionService.calculateMealItems(user.userId, body.items);
      items = calculated.items;
    }

    const updatedMeal = {
      ...existing,
      date,
      timezone,
      type,
      title,
      inputType,
      imageId,
      items,
    };

    const saved = await storage.saveMeal(user.userId, updatedMeal);
    return NextResponse.json({ meal: saved });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;

    const existing = await storage.findMealById(user.userId, id);
    if (!existing) {
      throw notFound(`Meal with ID "${id}" not found.`);
    }

    await storage.deleteMeal(user.userId, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
