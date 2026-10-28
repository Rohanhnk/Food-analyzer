import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { storage } from "@/server";
import { badRequest, handleRouteError, notFound } from "@/server/errors";
import { foodFromLabel } from "@/lib/food-input";
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req); const { id } = await params;
    if (!id.startsWith("personal_") || !await storage.findFoodById(id)) throw notFound("Personal food not found.");
    const input = await req.json();
    let food; try { food = foodFromLabel(input, id); } catch (error) { throw badRequest((error as Error).message); }
    await storage.importFoods([food]); return NextResponse.json({ food });
  } catch (error) { return handleRouteError(error); }
}
