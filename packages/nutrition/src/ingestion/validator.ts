import type { FoodBasis } from "../types";
import { ALLOWED_BASES, CatalogValidationReport, FoodValidationResult, ValidationIssue } from "./schema";

/**
 * Validates an individual candidate food record against schema, nutrient limits, and attribution.
 */
export function validateFoodRecord(input: unknown): FoodValidationResult {
  const issues: ValidationIssue[] = [];

  if (!input || typeof input !== "object") {
    return {
      valid: false,
      issues: [{ path: "root", message: "Record must be a non-null object.", severity: "error" }],
    };
  }

  const raw = input as Record<string, unknown>;
  const foodId = typeof raw.id === "string" ? raw.id.trim() : undefined;
  const foodName = typeof raw.name === "string" ? raw.name.trim() : undefined;

  // 1. Identification
  if (!foodId) {
    issues.push({ path: "id", message: "Food ID is required and must be a non-empty string.", severity: "error" });
  } else if (!/^[a-z0-9_-]+$/.test(foodId)) {
    issues.push({ path: "id", message: `Food ID "${foodId}" must contain only lowercase letters, digits, hyphens or underscores.`, severity: "error" });
  }

  if (!foodName) {
    issues.push({ path: "name", message: "Food name is required.", severity: "error" });
  }

  // 2. Aliases
  if (!Array.isArray(raw.aliases)) {
    issues.push({ path: "aliases", message: "Aliases must be an array of strings.", severity: "error" });
  } else if (raw.aliases.some(a => typeof a !== "string" || !a.trim())) {
    issues.push({ path: "aliases", message: "Aliases must not contain empty or non-string values.", severity: "error" });
  }

  // 3. Category & Basis
  if (typeof raw.category !== "string" || !raw.category.trim()) {
    issues.push({ path: "category", message: "Category is required.", severity: "error" });
  }

  if (!raw.basis || typeof raw.basis !== "string" || !ALLOWED_BASES.has(raw.basis as FoodBasis)) {
    issues.push({ path: "basis", message: `Basis must be one of: ${Array.from(ALLOWED_BASES).join(", ")}.`, severity: "error" });
  }

  // 4. Source & Attribution
  if (typeof raw.source !== "string" || !raw.source.trim()) {
    issues.push({ path: "source", message: "Authoritative source must be specified (e.g. IFCT 2017).", severity: "error" });
  }

  if (typeof raw.sourceVersion !== "string" || !raw.sourceVersion.trim()) {
    issues.push({ path: "sourceVersion", message: "Source version must be specified.", severity: "error" });
  }

  if (typeof raw.attribution !== "string" || !raw.attribution.trim()) {
    issues.push({ path: "attribution", message: "Attribution and copyright citation must be specified.", severity: "error" });
  }

  // 5. Nutrients per 100g
  if (!raw.per100g || typeof raw.per100g !== "object") {
    issues.push({ path: "per100g", message: "Nutrients per 100g is required.", severity: "error" });
  } else {
    const p100 = raw.per100g as Record<string, unknown>;
    const checkNutrient = (name: string, maxVal: number) => {
      const val = p100[name];
      if (typeof val !== "number" || !Number.isFinite(val)) {
        issues.push({ path: `per100g.${name}`, message: `Nutrient "${name}" must be a finite number.`, severity: "error" });
      } else if (val < 0) {
        issues.push({ path: `per100g.${name}`, message: `Nutrient "${name}" cannot be negative (${val}).`, severity: "error" });
      } else if (val > maxVal) {
        issues.push({ path: `per100g.${name}`, message: `Nutrient "${name}" exceeds physical maximum of ${maxVal} (${val}).`, severity: "error" });
      }
    };

    checkNutrient("kcal", 950);
    checkNutrient("protein", 100);
    checkNutrient("carbs", 100);
    checkNutrient("fat", 100);

    const protein = typeof p100.protein === "number" ? p100.protein : 0;
    const carbs = typeof p100.carbs === "number" ? p100.carbs : 0;
    const fat = typeof p100.fat === "number" ? p100.fat : 0;
    const macroSum = protein + carbs + fat;

    if (macroSum > 100.5) {
      issues.push({
        path: "per100g",
        message: `Sum of macronutrients (${macroSum.toFixed(1)}g) exceeds 100g per 100g sample.`,
        severity: "error",
      });
    }
  }

  // 6. Serving Definitions
  if (raw.standardServing !== undefined) {
    if (!raw.standardServing || typeof raw.standardServing !== "object") {
      issues.push({ path: "standardServing", message: "standardServing must be an object if present.", severity: "error" });
    } else {
      const s = raw.standardServing as Record<string, unknown>;
      if (typeof s.unit !== "string" || !s.unit.trim()) {
        issues.push({ path: "standardServing.unit", message: "Serving unit is required.", severity: "error" });
      }
      if (typeof s.grams !== "number" || !Number.isFinite(s.grams) || s.grams <= 0) {
        issues.push({ path: "standardServing.grams", message: "Serving grams must be a positive finite number.", severity: "error" });
      }
    }
  }

  const errors = issues.filter(i => i.severity === "error");
  return Object.freeze({
    valid: errors.length === 0,
    foodId,
    foodName,
    issues: Object.freeze(issues),
  });
}

/**
 * Validates an entire catalog of food records.
 * Checks for duplicate IDs, alias collisions across different foods,
 * missing nutrients, and source citations.
 */
export function validateCatalog(records: readonly unknown[]): CatalogValidationReport {
  const allErrors: ValidationIssue[] = [];
  const allWarnings: ValidationIssue[] = [];
  const idCounts = new Map<string, number>();
  const aliasMap = new Map<string, Set<string>>(); // alias -> Set of food IDs

  let validCount = 0;
  let invalidCount = 0;

  for (let idx = 0; idx < records.length; idx++) {
    const item = records[idx];
    const result = validateFoodRecord(item);

    if (result.valid) {
      validCount++;
    } else {
      invalidCount++;
    }

    for (const issue of result.issues) {
      const enrichedIssue: ValidationIssue = {
        path: `records[${idx}](${result.foodId ?? "unknown"}).${issue.path}`,
        message: issue.message,
        severity: issue.severity,
      };
      if (issue.severity === "error") {
        allErrors.push(enrichedIssue);
      } else {
        allWarnings.push(enrichedIssue);
      }
    }

    if (result.foodId) {
      idCounts.set(result.foodId, (idCounts.get(result.foodId) ?? 0) + 1);

      if (item && typeof item === "object") {
        const rawAliases = (item as Record<string, unknown>).aliases;
        if (Array.isArray(rawAliases)) {
          for (const alias of rawAliases as unknown[]) {
            if (typeof alias === "string" && alias.trim()) {
              const cleanAlias = alias.trim().toLowerCase();
              if (!aliasMap.has(cleanAlias)) {
                aliasMap.set(cleanAlias, new Set());
              }
              aliasMap.get(cleanAlias)!.add(result.foodId);
            }
          }
        }
      }
    }
  }

  // Duplicate ID checks
  const duplicateIds: string[] = [];
  for (const [id, count] of idCounts.entries()) {
    if (count > 1) {
      duplicateIds.push(id);
      allErrors.push({
        path: `id:${id}`,
        message: `Duplicate food ID detected: "${id}" appears ${count} times in catalog.`,
        severity: "error",
      });
    }
  }

  // Alias collisions across distinct foods
  const aliasCollisions: { alias: string; foodIds: string[] }[] = [];
  for (const [alias, foodsSet] of aliasMap.entries()) {
    if (foodsSet.size > 1) {
      const foodIds = Array.from(foodsSet);
      aliasCollisions.push({ alias, foodIds });
      allWarnings.push({
        path: `alias:${alias}`,
        message: `Alias "${alias}" is shared by multiple distinct foods: [${foodIds.join(", ")}]. This will require disambiguation during search.`,
        severity: "warning",
      });
    }
  }

  return Object.freeze({
    totalRecords: records.length,
    validRecords: validCount,
    invalidRecords: invalidCount,
    errors: Object.freeze(allErrors),
    warnings: Object.freeze(allWarnings),
    duplicateIds: Object.freeze(duplicateIds),
    aliasCollisions: Object.freeze(aliasCollisions),
  });
}
