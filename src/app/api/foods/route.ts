import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { storage } from "@/server";
import { badRequest, handleRouteError } from "@/server/errors";
import { foodFromLabel } from "@/lib/food-input";
export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
    const input = await req.json();
    let food; try { food = foodFromLabel(input, `personal_${crypto.randomUUID()}`); } catch (error) { throw badRequest((error as Error).message); }
    await storage.importFoods([food]);
    return NextResponse.json({ food }, { status: 201 });
  } catch (error) { return handleRouteError(error); }
}
