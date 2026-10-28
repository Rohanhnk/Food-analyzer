import { expect, it, vi } from "vitest";
import { HttpClient } from "@/lib/http-client";
it.each([true, false])("cleans up temporary photo uploads after analysis success=%s", async success => {
  const calls: string[] = [];
  const mock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, options) => {
    calls.push(`${options?.method} ${url}`);
    if (String(url) === "/api/uploads") {
      expect(options?.body).toBeInstanceOf(FormData);
      expect((options?.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
      return Response.json({ imageId: "photo" }, { status: 201 });
    }
    if (String(url) === "/api/analyze/image") return success ? Response.json({ foods: [], warnings: [] }) : Response.json({ error: { message: "Provider refused" } }, { status: 422 });
    return new Response(null, { status: 204 });
  });
  try {
    const promise = new HttpClient().analyzePhoto(new File(["fixture"], "photo.png", { type: "image/png" }));
    if (success) await expect(promise).resolves.toMatchObject({ foods: [] });
    else await expect(promise).rejects.toThrow("Provider refused");
    expect(calls).toEqual(["POST /api/uploads", "POST /api/analyze/image", "DELETE /api/uploads/photo"]);
  } finally { mock.mockRestore(); }
});
