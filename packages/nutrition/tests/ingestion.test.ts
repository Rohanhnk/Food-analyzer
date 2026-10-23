import { describe, expect, it } from "vitest";
import {
  CatalogImporter,
  InMemoryFoodRepository,
  validateCatalog,
  validateFoodRecord,
  VERIFIED_REFERENCE_FOODS,
} from "../src";

describe("Catalog Ingestion and Validation Pipeline", () => {
  it("validates the entire 30-item reference dataset with 0 errors", () => {
    const report = validateCatalog(VERIFIED_REFERENCE_FOODS);

    expect(report.totalRecords).toBe(30);
    expect(report.validRecords).toBe(30);
    expect(report.invalidRecords).toBe(0);
    expect(report.errors.length).toBe(0);
    expect(report.duplicateIds.length).toBe(0);
  });

  it("detects duplicate IDs across catalog records", () => {
    const records = [
      {
        id: "duplicate-id-1",
        name: "Item 1",
        aliases: ["item one"],
        category: "Test",
        basis: "cooked",
        per100g: { kcal: 100, protein: 5, carbs: 10, fat: 2 },
        source: "IFCT 2017",
        sourceVersion: "2017.1",
        attribution: "ICMR-NIN",
      },
      {
        id: "duplicate-id-1", // DUPLICATE ID
        name: "Item 2",
        aliases: ["item two"],
        category: "Test",
        basis: "cooked",
        per100g: { kcal: 120, protein: 6, carbs: 12, fat: 3 },
        source: "IFCT 2017",
        sourceVersion: "2017.1",
        attribution: "ICMR-NIN",
      },
    ];

    const report = validateCatalog(records);

    expect(report.duplicateIds).toContain("duplicate-id-1");
    expect(report.errors.some(e => e.message.includes("Duplicate food ID detected"))).toBe(true);
  });

  it("detects alias collisions across distinct foods", () => {
    const records = [
      {
        id: "dish-a",
        name: "Dish A",
        aliases: ["common-alias"],
        category: "Test",
        basis: "cooked",
        per100g: { kcal: 100, protein: 5, carbs: 10, fat: 2 },
        source: "IFCT 2017",
        sourceVersion: "2017.1",
        attribution: "ICMR-NIN",
      },
      {
        id: "dish-b",
        name: "Dish B",
        aliases: ["common-alias"], // COLLISION
        category: "Test",
        basis: "cooked",
        per100g: { kcal: 120, protein: 6, carbs: 12, fat: 3 },
        source: "IFCT 2017",
        sourceVersion: "2017.1",
        attribution: "ICMR-NIN",
      },
    ];

    const report = validateCatalog(records);

    expect(report.aliasCollisions.length).toBe(1);
    expect(report.aliasCollisions[0].alias).toBe("common-alias");
    expect(report.aliasCollisions[0].foodIds).toEqual(["dish-a", "dish-b"]);
  });

  it("rejects records with missing or negative nutrients", () => {
    const invalidNegative = {
      id: "neg-nutrient",
      name: "Negative Nutrient Food",
      aliases: [],
      category: "Test",
      basis: "cooked",
      per100g: { kcal: -50, protein: 10, carbs: 20, fat: 5 },
      source: "IFCT 2017",
      sourceVersion: "2017.1",
      attribution: "ICMR-NIN",
    };

    const res = validateFoodRecord(invalidNegative);
    expect(res.valid).toBe(false);
    expect(res.issues.some(i => i.message.includes("cannot be negative"))).toBe(true);
  });

  it("rejects records where sum of macros exceeds physical maximum (>100.5g/100g)", () => {
    const impossibleFood = {
      id: "impossible-food",
      name: "Impossible Food",
      aliases: [],
      category: "Test",
      basis: "cooked",
      per100g: { kcal: 500, protein: 60, carbs: 60, fat: 20 }, // 60 + 60 + 20 = 140g!
      source: "IFCT 2017",
      sourceVersion: "2017.1",
      attribution: "ICMR-NIN",
    };

    const res = validateFoodRecord(impossibleFood);
    expect(res.valid).toBe(false);
    expect(res.issues.some(i => i.message.includes("exceeds 100g"))).toBe(true);
  });

  it("rejects records missing source attribution", () => {
    const noAttribution = {
      id: "unattributed-food",
      name: "Unattributed Food",
      aliases: [],
      category: "Test",
      basis: "cooked",
      per100g: { kcal: 100, protein: 5, carbs: 10, fat: 2 },
      source: "", // EMPTY SOURCE
      sourceVersion: "1.0",
      attribution: "", // EMPTY ATTRIBUTION
    };

    const res = validateFoodRecord(noAttribution);
    expect(res.valid).toBe(false);
    expect(res.issues.some(i => i.path === "source")).toBe(true);
    expect(res.issues.some(i => i.path === "attribution")).toBe(true);
  });

  it("CatalogImporter loads validated records into target repository without Convex", async () => {
    const importer = new CatalogImporter();
    const repo = new InMemoryFoodRepository([]); // empty repo

    const result = await importer.importCatalog(VERIFIED_REFERENCE_FOODS, repo);

    expect(result.success).toBe(true);
    expect(result.importedCount).toBe(30);

    const loaded = await repo.listAll();
    expect(loaded.length).toBe(30);

    const roti = await repo.findById("roti-chapati-cooked");
    expect(roti?.name).toContain("Roti");
  });
});
