import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { photoPipeline } from "@/server";
import { handleRouteError } from "@/server/errors";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;

    await photoPipeline.deleteImage(user.userId, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
