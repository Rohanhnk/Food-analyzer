import { prepareRecognitionImage } from "./recognition-image";
import type { AnalysisResult } from "@/lib/contracts";
import type { StorageRepository } from "./storage/interface";
import { ApiError, notFound } from "./errors";
import { searchFoods, InMemoryFoodRepository } from "@nourish/nutrition";
import { MealInterpreter, RecognitionError, validateInput, type RecognitionResult } from "@nourish/recognition";
import { getInterpreter } from "./recognition-provider";
export interface RecognitionService {
  analyzeText(text: string): Promise<AnalysisResult>;
  analyzeImage(ownerId: string, imageId: string): Promise<AnalysisResult>;
}
export class OrchestratedRecognitionService implements RecognitionService {
  constructor(private readonly storage: StorageRepository, private readonly interpreter: () => MealInterpreter = getInterpreter) {}
  private async enrich(result: RecognitionResult): Promise<AnalysisResult> {
    const foods = await this.storage.listAllFoods();
    const repository = new InMemoryFoodRepository(foods.map(f => ({ ...f, attribution: f.source })));
    return { warnings: result.warnings, foods: await Promise.all(result.foods.map(async food => {
      const allMatches = await searchFoods(food.name, repository);
      const matches = allMatches.filter(match => !food.basis || match.food.basis === food.basis).slice(0, 5);
      const warnings = [...food.warnings];
      if (!matches.length) warnings.push("No matching food with this preparation basis. Search and select manually.");
      if (matches[0]?.isAmbiguous) warnings.push("Several preparations match. Select the specific dish manually.");
      if (food.unit !== "g") warnings.push("Serving weights vary. Enter grams or confirm a matching serving definition.");
      return { ...food, warnings, matches: matches.map(m => ({ id: m.food.id, name: m.food.name, basis: m.food.basis })),
        matchedFoodId: matches[0] && !matches[0].isAmbiguous ? matches[0].food.id : undefined };
    })) };
  }
  private async run(operation: () => Promise<RecognitionResult>): Promise<AnalysisResult> {
    try { return await this.enrich(await operation()); }
    catch (error) {
      if (!(error instanceof RecognitionError)) throw error;
      const code = error.code === "INVALID_INPUT" ? "INVALID_INPUT" : error.code === "NOT_CONFIGURED" ? "SERVICE_UNAVAILABLE" : error.code === "RATE_LIMITED" ? "RATE_LIMITED" : "PROVIDER_FAILURE";
      const status = error.code === "INVALID_INPUT" ? 400 : error.code === "NOT_CONFIGURED" ? 503 : error.code === "RATE_LIMITED" ? 429 : error.code === "TIMEOUT" ? 504 : error.code === "REFUSAL" ? 422 : 502;
      throw new ApiError(code, error.message, status);
    }
  }
  analyzeText(text: string) { return this.run(() => { validateInput({ kind: "text", text }); return this.interpreter().interpretText(text); }); }
  async analyzeImage(ownerId: string, imageId: string) {
    const image = await this.storage.findImageById(ownerId, imageId);
    if (!image || image.status === "deleted") throw notFound("Image not found or unauthorized.");
    if (!image.buffer) throw new ApiError("SERVICE_UNAVAILABLE", "Image bytes are unavailable. Upload the image again.", 503);
    return this.run(async () => this.interpreter().interpretImage(await prepareRecognitionImage(image.buffer!), "image/jpeg"));
  }
}
