import { afterEach, expect, it, vi } from "vitest";
import sharp from "sharp";
import { MealInterpreter, RecognitionError } from "@nourish/recognition";
import { InMemoryStorageRepository } from "@/server/storage/in-memory";
import { OrchestratedRecognitionService } from "@/server/recognition-service";
import { prepareRecognitionImage } from "@/server/recognition-image";
import { POST as analyzeText } from "@/app/api/analyze/text/route";
import { NextRequest } from "next/server";
import { setRecognitionTestProvider } from "@/server/recognition-provider";
import { analysisRateLimiter } from "@/server/rate-limiter";
afterEach(() => vi.restoreAllMocks());
it("keeps unknown foods unresolved rather than replacing them with a sample", async () => {
  const service = new OrchestratedRecognitionService(new InMemoryStorageRepository(), () => new MealInterpreter({ async interpret() { return { foods: [{ name: "unknown dish xyz", quantity: null, unit: null, basis: null, warnings: [] }], warnings: [] }; } }));
  const result = await service.analyzeText("unknown dish xyz");
  expect(result.foods[0].name).toBe("unknown dish xyz");
  expect(result.foods[0].matches).toEqual([]);
  expect(result.foods[0].matchedFoodId).toBeUndefined();
});
it("checks image ownership before calling any provider", async () => {
  const factory = vi.fn();
  const service = new OrchestratedRecognitionService(new InMemoryStorageRepository(), factory);
  await expect(service.analyzeImage("alice", "bob-photo")).rejects.toMatchObject({ statusCode: 404 });
  expect(factory).not.toHaveBeenCalled();
});
it("strips metadata and sends decoded image bytes to the provider", async () => {
  const bytes = await sharp({ create: { width: 20, height: 20, channels: 3, background: "red" } }).jpeg().withMetadata().toBuffer();
  const prepared = await prepareRecognitionImage(bytes);
  const metadata = await sharp(prepared).metadata();
  expect(metadata.format).toBe("jpeg"); expect(metadata.exif).toBeUndefined();
  await expect(prepareRecognitionImage(new Uint8Array([1, 2, 3]))).rejects.toMatchObject({ code: "INVALID_INPUT" });
  const storage = new InMemoryStorageRepository();
  await storage.saveImageRecord({ id: "image", ownerId: "alice", storageId: "local", originalName: "food.jpg", mimeType: "image/jpeg", sizeBytes: bytes.length, status: "pending", createdAt: new Date().toISOString(), buffer: bytes });
  const provider = { interpret: vi.fn().mockResolvedValue({ foods: [], warnings: [] }) };
  const result = await new OrchestratedRecognitionService(storage, () => new MealInterpreter(provider)).analyzeImage("alice", "image");
  expect(provider.interpret.mock.calls[0][0].kind).toBe("image");
  expect(result.foods).toHaveLength(0);
});
it("returns a service error when AI is not configured", async () => {
  setRecognitionTestProvider({ async interpret() { throw new RecognitionError("NOT_CONFIGURED", "AI recognition is not configured."); } });
  const response = await analyzeText(new NextRequest("http://localhost/api/analyze/text", { method: "POST", headers: { authorization: "Bearer test-user-recognition" }, body: JSON.stringify({ text: "rice" }) }));
  expect(response.status).toBe(503);
});
it("rate limits authenticated analysis requests before the model call", async () => {
  const provider = { interpret: vi.fn() }; setRecognitionTestProvider(provider);
  analysisRateLimiter.consume("test-user-limited", 20);
  const response = await analyzeText(new NextRequest("http://localhost/api/analyze/text", { method: "POST", headers: { authorization: "Bearer test-user-limited" }, body: JSON.stringify({ text: "rice" }) }));
  expect(response.status).toBe(429); expect(provider.interpret).not.toHaveBeenCalled();
});
