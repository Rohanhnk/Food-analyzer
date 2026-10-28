import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { handleRouteError } from "@/server/errors";
export async function GET(req: NextRequest) {
  try { const user = await requireAuth(req); return NextResponse.json({ userId: user.userId, privateAccount: true }); }
  catch (error) { return handleRouteError(error); }
}
