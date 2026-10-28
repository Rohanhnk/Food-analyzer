import { requireAuth } from "@/server/auth";
import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server";
import { handleRouteError } from "@/server/errors";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") ?? "";

    const foods = (query.trim() ? await storage.searchFoods(query) : await storage.listAllFoods());
    return NextResponse.json({ foods });
  } catch (error) {
    return handleRouteError(error);
  }
}
