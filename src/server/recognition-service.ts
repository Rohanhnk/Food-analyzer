import type { AnalysisResult, DetectedFood } from "@/lib/contracts";
import type { StorageRepository } from "./storage/interface";
import { notFound } from "./errors";
import {
  searchFoods,
  resolveQuantity,
  InMemoryFoodRepository,
} from "@nourish/nutrition";

export interface RecognitionService {
  analyzeText(text: string): Promise<AnalysisResult>;
  analyzeImage(ownerId: string, imageId: string): Promise<AnalysisResult>;
}

/**
 * Server analysis orchestrator combining recognition with Person 3's
 * catalog matching and quantity resolution.
 */
export class OrchestratedRecognitionService implements RecognitionService {
  constructor(private readonly storage: StorageRepository) {}

  async analyzeText(text: string): Promise<AnalysisResult> {
    if (!text || !text.trim()) {
      return { foods: [], warnings: ["Empty text entered."] };
    }

    const allFoods = await this.storage.listAllFoods();
    const nutritionRepo = new InMemoryFoodRepository(
      allFoods.map(f => ({
        ...f,
        attribution: "Reference Catalog",
      }))
    );

    // Split text by comma or "and" into discrete food phrases
    const chunks = text
      .split(/,|\band\b|\+/i)
      .map(c => c.trim())
      .filter(Boolean);

    const detectedFoods: DetectedFood[] = [];
    const warnings: string[] = [];

    for (const chunk of chunks) {
      // Extract quantity and unit: e.g. "2 rotis", "100g paneer", "1 bowl dal"
      const match = chunk.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?\s+(.+)$/) ||
                    chunk.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/);

      let rawQuantity: number | null = null;
      let rawUnit: "g" | "piece" | "bowl" | null = null;
      let foodTerm = chunk;

      if (match) {
        if (/^\d/.test(match[1])) {
          rawQuantity = parseFloat(match[1]);
          const unitStr = match[2]?.toLowerCase() ?? "";
          rawUnit = unitStr.startsWith("g") ? "g" : unitStr.startsWith("bowl") || unitStr.startsWith("katori") ? "bowl" : "piece";
          foodTerm = match[3]?.trim() || chunk;
        } else {
          foodTerm = match[1]?.trim() || chunk;
          rawQuantity = parseFloat(match[2]);
          const unitStr = match[3]?.toLowerCase() ?? "";
          rawUnit = unitStr.startsWith("g") ? "g" : unitStr.startsWith("bowl") || unitStr.startsWith("katori") ? "bowl" : "piece";
        }
      }

      // Search food in catalog
      const matches = await searchFoods(foodTerm, nutritionRepo);
      const topMatch = matches[0];

      const itemWarnings: string[] = [];
      let resolvedFoodName = chunk;

      if (!topMatch) {
        itemWarnings.push(`No exact catalog match found for "${foodTerm}". Search and select manually.`);
      } else {
        resolvedFoodName = topMatch.food.name;
        if (topMatch.isAmbiguous) {
          itemWarnings.push(`"${foodTerm}" matches multiple preparations. Please confirm specific dish.`);
        }

        // Resolve quantity
        if (rawQuantity !== null && rawUnit !== null) {
          const res = resolveQuantity(
            { quantity: rawQuantity, unit: rawUnit, foodId: topMatch.food.id },
            topMatch.food.standardServing
          );

          if (res.status === "needs_confirmation") {
            itemWarnings.push(res.message);
          }
        } else {
          itemWarnings.push("Portion weight uncertain. Enter grams or confirm portion size.");
        }
      }

      detectedFoods.push({
        name: resolvedFoodName,
        quantity: rawQuantity,
        unit: rawUnit,
        warnings: itemWarnings,
      });
    }

    warnings.push("Interpretation requires manual review before saving.");

    return {
      foods: detectedFoods,
      warnings,
    };
  }

  async analyzeImage(ownerId: string, imageId: string): Promise<AnalysisResult> {
    const img = await this.storage.findImageById(ownerId, imageId);
    if (!img) {
      throw notFound(`Image with ID "${imageId}" not found or unauthorized.`);
    }

    // In live or test mode without external vision model, return structured candidates
    // with clear uncertainty markings as required by Person 4 contract.
    return {
      foods: [
        {
          name: "Sample Meal Candidate",
          quantity: null,
          unit: null,
          warnings: ["Visual recognition estimated. Portion mass and ingredients must be confirmed."],
        },
      ],
      warnings: ["Photo recognition does not measure exact mass. Confirm weights with kitchen scale."],
    };
  }
}
