import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { storage } from "@/server";
import { badRequest, handleRouteError, notFound } from "@/server/errors";
import { validateWeightGrams } from "@/server/validation";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;

    const recipe = await storage.findRecipeById(user.userId, id);
    if (!recipe) {
      throw notFound(`Recipe with ID "${id}" not found.`);
    }

    return NextResponse.json({ recipe });
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

    const existing = await storage.findRecipeById(user.userId, id);
    if (!existing) {
      throw notFound(`Recipe with ID "${id}" not found.`);
    }

    const body = await req.json();
    if (!body || typeof body !== "object") {
      throw badRequest("Request body must be a valid JSON object.");
    }

    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : existing.name;
    const cookedYieldGrams = body.cookedYieldGrams !== undefined ? validateWeightGrams(body.cookedYieldGrams, "cookedYieldGrams") : existing.cookedYieldGrams;

    const updated = {
      ...existing,
      name,
      cookedYieldGrams,
      ingredients: Array.isArray(body.ingredients) ? body.ingredients : existing.ingredients,
    };

    const saved = await storage.saveRecipe(user.userId, updated);
    return NextResponse.json({ recipe: saved });
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

    const existing = await storage.findRecipeById(user.userId, id);
    if (!existing) {
      throw notFound(`Recipe with ID "${id}" not found.`);
    }

    await storage.deleteRecipe(user.userId, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
