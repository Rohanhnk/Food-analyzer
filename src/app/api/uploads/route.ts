import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { photoPipeline } from "@/server";
import { badRequest, handleRouteError } from "@/server/errors";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      throw badRequest("No file uploaded. Expected 'file' form field.", "file");
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || "application/octet-stream";
    const name = file instanceof File ? file.name : "upload.jpg";

    const result = await photoPipeline.processUpload(user.userId, buffer, name, mimeType);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
