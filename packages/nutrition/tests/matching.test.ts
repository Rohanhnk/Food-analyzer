import { describe, expect, it } from "vitest";
import {
  InMemoryFoodRepository,
  isGenericCategoryQuery,
  normalizeText,
  searchFoods,
  tokenize,
} from "../src";

describe("Text Normalization Utilities", () => {
  it("normalizes case, accents, diacritics, and punctuation", () => {
    expect(normalizeText("  Roti / Chapati (Whole-Wheat)  ")).toBe("roti chapati whole wheat");
    expect(normalizeText("Café au lait")).toBe("cafe au lait");
    expect(normalizeText("Dahi, Plain [100g]")).toBe("dahi plain 100g");
  });

  it("splits text into unique non-empty tokens", () => {
    expect(tokenize("Toor  Dal   Cooked")).toEqual(["toor", "dal", "cooked"]);
    expect(tokenize("")).toEqual([]);
  });

  it("identifies generic culinary category umbrella terms", () => {
    expect(isGenericCategoryQuery("dal")).toBe(true);
    expect(isGenericCategoryQuery("sabzi")).toBe(true);
    expect(isGenericCategoryQuery("bhaji")).toBe(true);
    expect(isGenericCategoryQuery("curry")).toBe(true);
    expect(isGenericCategoryQuery("rice")).toBe(true);
    expect(isGenericCategoryQuery("palak paneer")).toBe(false);
  });
});

describe("Food Search and Alias Matching", () => {
  const repo = new InMemoryFoodRepository();

  it("matches common Indian aliases to the same canonical food record", async () => {
    const terms = ["roti", "chapati", "phulka", "chappathi", "rotli"];

    for (const term of terms) {
      const results = await searchFoods(term, repo);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].food.id).toBe("roti-chapati-cooked");
      expect(results[0].score).toBeGreaterThanOrEqual(0.85);
    }
  });

  it("matches curd and dahi aliases accurately", async () => {
    const terms = ["curd", "dahi", "plain curd", "plain yogurt", "thayir"];

    for (const term of terms) {
      const results = await searchFoods(term, repo);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].food.id).toBe("curd-dahi-whole-milk");
    }
  });

  it("flags generic queries like 'dal' as ambiguous without silent exact auto-selection", async () => {
    const results = await searchFoods("dal", repo);

    expect(results.length).toBeGreaterThan(1);
    // Ambiguity must be surfaced
    expect(results[0].isAmbiguous).toBe(true);

    const ids = results.map(r => r.food.id);
    expect(ids).toContain("toor-dal-cooked");
    expect(ids).toContain("moong-dal-cooked");
  });

  it("flags generic queries like 'sabzi' or 'bhaji' as ambiguous across distinct dishes", async () => {
    const results = await searchFoods("sabzi", repo);

    expect(results.length).toBeGreaterThan(1);
    expect(results[0].isAmbiguous).toBe(true);

    const ids = results.map(r => r.food.id);
    expect(ids).toContain("aloo-gobi-cooked");
    expect(ids).toContain("bhindi-masala-cooked");
  });

  it("returns unambiguous match for specific dishes", async () => {
    const results = await searchFoods("palak paneer", repo);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].food.id).toBe("palak-paneer-cooked");
    expect(results[0].isAmbiguous).toBe(false);
  });

  it("returns explicit empty list [] for unknown foods without inventing matches", async () => {
    const results = await searchFoods("nonexistent_exotic_dragonfruit_berry", repo);

    expect(results).toEqual([]);
  });

  it("handles empty or whitespace-only queries by returning []", async () => {
    expect(await searchFoods("", repo)).toEqual([]);
    expect(await searchFoods("    ", repo)).toEqual([]);
  });
});
