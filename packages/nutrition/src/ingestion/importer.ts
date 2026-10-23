import type { FoodRecord } from "../types";
import type { FoodRepository } from "../repository/interface";
import type { CatalogValidationReport } from "./schema";
import { validateCatalog } from "./validator";

export type ImportOptions = {
  readonly allowPartial?: boolean;
};

export type CatalogImportResult = {
  readonly success: boolean;
  readonly importedCount: number;
  readonly report: CatalogValidationReport;
  readonly importedFoods: readonly FoodRecord[];
};

/**
 * Repeatable catalog importer interface designed for backend/platform handoff (Person 2).
 * Validates datasets before ingestion and does not require Convex or external databases to run.
 */
export class CatalogImporter {
  async importCatalog(
    records: readonly unknown[],
    targetRepository?: FoodRepository,
    options?: ImportOptions
  ): Promise<CatalogImportResult> {
    const report = validateCatalog(records);

    if (report.errors.length > 0 && !options?.allowPartial) {
      return Object.freeze({
        success: false,
        importedCount: 0,
        report,
        importedFoods: Object.freeze([]),
      });
    }

    const validFoods: FoodRecord[] = [];
    for (const raw of records) {
      const record = raw as FoodRecord;
      if (
        record &&
        typeof record.id === "string" &&
        !report.duplicateIds.includes(record.id) &&
        record.per100g &&
        typeof record.per100g.kcal === "number"
      ) {
        const frozen = Object.freeze({
          ...record,
          aliases: Object.freeze([...record.aliases]),
          per100g: Object.freeze({ ...record.per100g }),
          standardServing: record.standardServing ? Object.freeze({ ...record.standardServing }) : undefined,
          alternateServings: record.alternateServings ? Object.freeze(record.alternateServings.map(s => Object.freeze({ ...s }))) : undefined,
        });

        validFoods.push(frozen);

        if (targetRepository && targetRepository.addFood) {
          await targetRepository.addFood(frozen);
        }
      }
    }

    return Object.freeze({
      success: report.errors.length === 0,
      importedCount: validFoods.length,
      report,
      importedFoods: Object.freeze(validFoods),
    });
  }
}
