import type { FoodBasis } from "../types";

export const ALLOWED_BASES: ReadonlySet<FoodBasis> = new Set(["raw", "cooked", "as-served"]);

export type ValidationIssue = {
  readonly path: string;
  readonly message: string;
  readonly severity: "error" | "warning";
};

export type FoodValidationResult = {
  readonly valid: boolean;
  readonly foodId?: string;
  readonly foodName?: string;
  readonly issues: readonly ValidationIssue[];
};

export type CatalogValidationReport = {
  readonly totalRecords: number;
  readonly validRecords: number;
  readonly invalidRecords: number;
  readonly errors: readonly ValidationIssue[];
  readonly warnings: readonly ValidationIssue[];
  readonly duplicateIds: readonly string[];
  readonly aliasCollisions: readonly {
    readonly alias: string;
    readonly foodIds: readonly string[];
  }[];
};
