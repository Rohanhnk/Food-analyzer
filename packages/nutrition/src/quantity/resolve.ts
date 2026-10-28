import type {
  NeedsConfirmation,
  QuantityCandidate,
  QuantityResolutionResult,
  ResolvedQuantity,
  ServingDefinition,
} from "../types";
import { validateGrams } from "./validation";
import { canonicalServingUnit, isBowlUnit, isGramUnit, isPieceUnit, isSpoonUnit } from "./units";

/**
 * Resolves a portion candidate into an exact gram weight or returns needs_confirmation.
 *
 * Rules:
 * - Accept grams directly.
 * - Convert pieces/servings/bowls only with a specific serving definition or user-confirmed default.
 * - Return needs_confirmation when grams cannot be established.
 * - Reject zero, negative, NaN, infinite and unreasonable weights.
 */
export function resolveQuantity(
  candidate: QuantityCandidate,
  servingDefinition?: ServingDefinition
): QuantityResolutionResult {
  if (candidate.quantity === null || candidate.quantity === undefined) {
    const nc: NeedsConfirmation = {
      status: "needs_confirmation",
      reason: "missing_quantity",
      message: "Portion quantity was not specified.",
      candidate,
      suggestedServing: servingDefinition,
    };
    return nc;
  }

  // Sanity check candidate.quantity
  validateGrams(candidate.quantity, "quantity amount");

  if (!candidate.unit || !candidate.unit.trim()) {
    const nc: NeedsConfirmation = {
      status: "needs_confirmation",
      reason: "missing_unit",
      message: "Portion unit is missing. Please confirm weight in grams or select a serving size.",
      candidate,
      suggestedServing: servingDefinition,
    };
    return nc;
  }

  const rawUnit = candidate.unit.trim().toLowerCase();

  // 1. Grams directly
  if (isGramUnit(rawUnit)) {
    const grams = candidate.quantity;
    validateGrams(grams, "grams");
    const res: ResolvedQuantity = {
      status: "resolved",
      grams,
      unit: "g",
      originalQuantity: candidate.quantity,
      source: "direct_grams",
      needsConfirmation: false,
    };
    return res;
  }

  // 2. Pieces, bowls, or spoons
  const isServing = isPieceUnit(rawUnit) || isBowlUnit(rawUnit) || isSpoonUnit(rawUnit);
  if (isServing) {
    if (!servingDefinition) {
      if (isBowlUnit(rawUnit)) {
        const nc: NeedsConfirmation = {
          status: "needs_confirmation",
          reason: "bowl_volume_uncertain",
          message: `Bowl portion size varies by dish and container. Confirm gram weight.`,
          candidate,
        };
        return nc;
      }
      const nc: NeedsConfirmation = {
        status: "needs_confirmation",
        reason: "unit_requires_serving_definition",
        message: `Cannot convert "${candidate.unit}" to grams without a specific serving definition.`,
        candidate,
      };
      return nc;
    }

    if (canonicalServingUnit(rawUnit) !== canonicalServingUnit(servingDefinition.unit)) {
      return { status: "needs_confirmation", reason: "unit_requires_serving_definition",
        message: `A ${servingDefinition.unit} definition cannot resolve ${candidate.unit}. Select the matching serving or enter grams.`,
        candidate, suggestedServing: servingDefinition };
    }
    // Serving definition is available
    const totalGrams = candidate.quantity * servingDefinition.grams;
    validateGrams(totalGrams, "calculated serving weight");

    // If candidate has been explicitly confirmed by user
    if (candidate.userConfirmed === true) {
      const res: ResolvedQuantity = {
        status: "resolved",
        grams: totalGrams,
        unit: servingDefinition.unit,
        originalQuantity: candidate.quantity,
        source: "user_confirmed",
        needsConfirmation: false,
        servingDefinition,
      };
      return res;
    }

    // For bowl / katori portions, bowl volumes vary widely; surface confirmation unless confirmed
    if (isBowlUnit(rawUnit)) {
      const nc: NeedsConfirmation = {
        status: "needs_confirmation",
        reason: "bowl_volume_uncertain",
        message: `Estimated standard ${servingDefinition.unit} is ${servingDefinition.grams} g (${totalGrams} g total). Confirm this portion.`,
        candidate,
        suggestedServing: servingDefinition,
      };
      return nc;
    }

    // Standard piece (e.g. roti, egg) with serving definition
    const res: ResolvedQuantity = {
      status: "resolved",
      grams: totalGrams,
      unit: servingDefinition.unit,
      originalQuantity: candidate.quantity,
      source: "serving_definition",
      needsConfirmation: true, // Requires user portion review/confirmation before saving
      servingDefinition,
    };
    return res;
  }

  // 3. Unrecognized unit
  const nc: NeedsConfirmation = {
    status: "needs_confirmation",
    reason: "unrecognized_unit",
    message: `Unit "${candidate.unit}" is not recognized. Enter portion in grams.`,
    candidate,
    suggestedServing: servingDefinition,
  };
  return nc;
}
