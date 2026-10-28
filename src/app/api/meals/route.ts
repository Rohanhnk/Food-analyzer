import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { nutritionService, storage } from "@/server";
import { badRequest, handleRouteError } from "@/server/errors";
import {
  validateInputType,
  validateLocalDate,
  validateMealType,
  validateTimezone,
} from "@/server/validation";
import type { Meal } from "@/lib/contracts";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    // Check Idempotency-Key header for repeated submission deduplication
    const idempotencyKey = req.headers.get("idempotency-key") || req.headers.get("x-idempotency-key");
    if (idempotencyKey) {
      const cached = await storage.getIdempotencyRecord(user.userId, idempotencyKey);
      if (cached) {
        return new NextResponse(cached.responseBody, {
          status: cached.statusCode,
          headers: {
            "Content-Type": "application/json",
            "X-Idempotent-Replay": "true",
          },
        });
      }
    }

    const body = await req.json();
    if (!body || typeof body !== "object") {
      throw badRequest("Request body must be a valid JSON object.");
    }

    const date = validateLocalDate(body.date, "date");
    const timezone = validateTimezone(body.timezone, "timezone");
    const type = validateMealType(body.type, "type");
    const inputType = validateInputType(body.inputType, "inputType");

    if (typeof body.title !== "string" || !body.title.trim()) {
      throw badRequest("Field 'title' is required.", "title");
    }
    const title = body.title.trim();

    if (!Array.isArray(body.items) || body.items.length === 0) {
      throw badRequest("Field 'items' must be a non-empty array.", "items");
    }

    if (body.items.some((item: { confirmed?: unknown }) => !item || item.confirmed !== true)) throw badRequest("Confirm every portion before saving.");
    // Recompute authoritative nutrition on server
    const calculated = await nutritionService.calculateMealItems(user.userId, body.items);

    const meal: Meal = {
      id: idempotencyKey ? createHash("sha256").update(JSON.stringify([user.userId, idempotencyKey])).digest("hex") : crypto.randomUUID(),
      date,
      timezone,
      type,
      title,
      inputType,
      imageId: typeof body.imageId === "string" ? body.imageId : undefined,
      items: calculated.items,
      createdAt: new Date().toISOString(),
    };

    const savedMeal = await storage.saveMeal(user.userId, meal);
    const responsePayload = JSON.stringify({ meal: savedMeal });

    if (idempotencyKey) {
      await storage.saveIdempotencyRecord(user.userId, idempotencyKey, 201, responsePayload);
    }

    return new NextResponse(responsePayload, {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const { searchParams } = new URL(req.url);

    const dateParam = searchParams.get("date");
    if (dateParam) {
      const date = validateLocalDate(dateParam, "date");
      const meals = await storage.listMealsByDate(user.userId, date);
      return NextResponse.json({ meals });
    }

    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;
    const cursor = searchParams.get("cursor") ?? undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;

    if (from) validateLocalDate(from, "from");
    if (to) validateLocalDate(to, "to");
    if (from && to && from > to) throw badRequest("from must not be after to.");
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw badRequest("limit must be between 1 and 100.");
    const result = await storage.listMealsRange(user.userId, from, to, cursor, limit);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
