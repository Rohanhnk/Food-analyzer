import { defaultStorage } from "./storage/in-memory";
import { NutritionService } from "./nutrition-service";
import { OrchestratedRecognitionService } from "./recognition-service";
import { PhotoPipeline } from "./photo-pipeline";

export const storage = defaultStorage;
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
