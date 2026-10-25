import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server";
import { handleRouteError } from "@/server/errors";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") ?? "";

    const foods = await storage.searchFoods(query);
    return NextResponse.json({ foods });
  } catch (error) {
    return handleRouteError(error);
  }
}
