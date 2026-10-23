import { describe, expect, it } from "vitest";
import {
  InvalidQuantityError,
  isValidGrams,
  resolveQuantity,
  validateGrams,
} from "../src";
import type { ServingDefinition } from "../src";

describe("Quantity Validation Rules", () => {
  it("accepts valid finite positive weights up to 10,000 g", () => {
    expect(() => validateGrams(1)).not.toThrow();
    expect(() => validateGrams(150.5)).not.toThrow();
    expect(() => validateGrams(10000)).not.toThrow();

    expect(isValidGrams(250)).toBe(true);
  });

  it("rejects zero and negative numbers with typed error code", () => {
    expect(() => validateGrams(0)).toThrow(InvalidQuantityError);
    expect(() => validateGrams(-10)).toThrow(InvalidQuantityError);

    try {
      validateGrams(0);
    } catch (err) {
      expect((err as InvalidQuantityError).code).toBe("WEIGHT_ZERO_OR_NEGATIVE");
    }

    expect(isValidGrams(0)).toBe(false);
    expect(isValidGrams(-5)).toBe(false);
  });

  it("rejects non-finite values (NaN, Infinity, -Infinity)", () => {
    expect(() => validateGrams(NaN)).toThrow(InvalidQuantityError);
    expect(() => validateGrams(Infinity)).toThrow(InvalidQuantityError);
    expect(() => validateGrams(-Infinity)).toThrow(InvalidQuantityError);

    try {
      validateGrams(NaN);
    } catch (err) {
      expect((err as InvalidQuantityError).code).toBe("WEIGHT_NOT_FINITE");
    }

    expect(isValidGrams(NaN)).toBe(false);
  });

  it("rejects unreasonably large weights (>10,000 g)", () => {
    expect(() => validateGrams(10001)).toThrow(InvalidQuantityError);
    expect(() => validateGrams(50000)).toThrow(InvalidQuantityError);

    try {
      validateGrams(15000);
    } catch (err) {
      expect((err as InvalidQuantityError).code).toBe("WEIGHT_UNREASONABLE");
    }

    expect(isValidGrams(15000)).toBe(false);
  });
});

describe("Portion Resolution", () => {
  const rotiServing: ServingDefinition = {
    unit: "piece",
    grams: 35,
    description: "1 medium tawa roti (35g)",
  };

  const dalKatoriServing: ServingDefinition = {
    unit: "katori",
    grams: 150,
    description: "1 standard katori cooked dal (150g)",
  };

  it("resolves grams directly without requiring confirmation", () => {
    const res = resolveQuantity({ quantity: 150, unit: "g" });

    expect(res.status).toBe("resolved");
    if (res.status === "resolved") {
      expect(res.grams).toBe(150);
      expect(res.unit).toBe("g");
      expect(res.needsConfirmation).toBe(false);
      expect(res.source).toBe("direct_grams");
    }
  });

  it("converts pieces using serving definition and marks for review", () => {
    const res = resolveQuantity({ quantity: 2, unit: "piece" }, rotiServing);

    expect(res.status).toBe("resolved");
    if (res.status === "resolved") {
      expect(res.grams).toBe(70);
      expect(res.unit).toBe("piece");
      expect(res.needsConfirmation).toBe(true);
      expect(res.source).toBe("serving_definition");
    }
  });

  it("respects user confirmation flag for serving conversions", () => {
    const res = resolveQuantity(
      { quantity: 2, unit: "piece", userConfirmed: true },
      rotiServing
    );

    expect(res.status).toBe("resolved");
    if (res.status === "resolved") {
      expect(res.grams).toBe(70);
      expect(res.needsConfirmation).toBe(false);
      expect(res.source).toBe("user_confirmed");
    }
  });

  it("returns needs_confirmation when converting pieces without a serving definition", () => {
    const res = resolveQuantity({ quantity: 2, unit: "piece" });

    expect(res.status).toBe("needs_confirmation");
    if (res.status === "needs_confirmation") {
      expect(res.reason).toBe("unit_requires_serving_definition");
    }
  });

  it("surfaces needs_confirmation for unconfirmed bowl portions due to volume variance", () => {
    const res = resolveQuantity({ quantity: 1, unit: "bowl" }, dalKatoriServing);

    expect(res.status).toBe("needs_confirmation");
    if (res.status === "needs_confirmation") {
      expect(res.reason).toBe("bowl_volume_uncertain");
      expect(res.suggestedServing?.grams).toBe(150);
    }
  });

  it("resolves confirmed bowl portions", () => {
    const res = resolveQuantity(
      { quantity: 1, unit: "bowl", userConfirmed: true },
      dalKatoriServing
    );

    expect(res.status).toBe("resolved");
    if (res.status === "resolved") {
      expect(res.grams).toBe(150);
      expect(res.needsConfirmation).toBe(false);
      expect(res.source).toBe("user_confirmed");
    }
  });

  it("returns needs_confirmation for missing quantity or unit", () => {
    const missingQty = resolveQuantity({ quantity: null, unit: "g" });
    expect(missingQty.status).toBe("needs_confirmation");
    if (missingQty.status === "needs_confirmation") {
      expect(missingQty.reason).toBe("missing_quantity");
    }

    const missingUnit = resolveQuantity({ quantity: 100, unit: null });
    expect(missingUnit.status).toBe("needs_confirmation");
    if (missingUnit.status === "needs_confirmation") {
      expect(missingUnit.reason).toBe("missing_unit");
    }
  });

  it("returns needs_confirmation for unrecognized units", () => {
    const res = resolveQuantity({ quantity: 2, unit: "handfuls" });
    expect(res.status).toBe("needs_confirmation");
    if (res.status === "needs_confirmation") {
      expect(res.reason).toBe("unrecognized_unit");
    }
  });

  it("rejects non-finite and negative quantities in portion resolution", () => {
    expect(() => resolveQuantity({ quantity: 0, unit: "g" })).toThrow(InvalidQuantityError);
    expect(() => resolveQuantity({ quantity: -5, unit: "g" })).toThrow(InvalidQuantityError);
    expect(() => resolveQuantity({ quantity: NaN, unit: "g" })).toThrow(InvalidQuantityError);
  });
});
