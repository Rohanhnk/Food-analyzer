import { ConvexStorageRepository } from "./storage/convex-storage";
import { defaultStorage } from "./storage/in-memory";
import { NutritionService } from "./nutrition-service";
import { OrchestratedRecognitionService } from "./recognition-service";
import { PhotoPipeline } from "./photo-pipeline";

// Memory storage is reserved for explicitly isolated tests. Even demo-mode API
// requests use persistent storage; the browser demo has its own local adapter.
export const storage = process.env.NODE_ENV === "test" ? defaultStorage : new ConvexStorageRepository();
export const nutritionService = new NutritionService(storage);
export const recognitionService = new OrchestratedRecognitionService(storage);
export const photoPipeline = new PhotoPipeline(storage);

export * from "./errors";
export * from "./auth";
export * from "./logger";
export * from "./request-context";
export * from "./validation";
export * from "./rate-limiter";
export * from "./storage/interface";
