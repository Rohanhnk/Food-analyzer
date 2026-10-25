import type { FoodRecord, FoodRepository } from "@nourish/nutrition";
import { VERIFIED_REFERENCE_FOODS } from "@nourish/nutrition";

/**
 * Convex-backed implementation of FoodRepository.
 * If convexClient is provided, queries Convex; otherwise uses offline verified reference catalog.
 */
export class ConvexFoodRepository implements FoodRepository {
  constructor(
    private readonly convexClient?: {
      query: (name: string, args: Record<string, unknown>) => Promise<unknown>;
      mutation?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
    }
  ) {}

  async findById(id: string): Promise<FoodRecord | null> {
    if (this.convexClient) {
      const result = await this.convexClient.query("foods:getById", { id });
      return (result as FoodRecord) || null;
    }
    const found = VERIFIED_REFERENCE_FOODS.find((f) => f.id === id);
    return found ? { ...found } : null;
  }

  async findByNameOrAlias(term: string): Promise<readonly FoodRecord[]> {
    const clean = term.trim().toLowerCase();
    const all = await this.listAll();
    return all.filter(
      (f) =>
        f.name.toLowerCase() === clean ||
        f.aliases.some((a: string) => a.toLowerCase() === clean)
    );
  }

  async search(query: string): Promise<readonly FoodRecord[]> {
    if (this.convexClient) {
      const results = await this.convexClient.query("foods:search", { query });
      return (results as FoodRecord[]) || [];
    }
    const clean = query.trim().toLowerCase();
    if (!clean) return [];
    return VERIFIED_REFERENCE_FOODS.filter(
      (f) =>
        f.name.toLowerCase().includes(clean) ||
        f.aliases.some((a: string) => a.toLowerCase().includes(clean))
    );
  }

  async listAll(): Promise<readonly FoodRecord[]> {
    if (this.convexClient) {
      const results = await this.convexClient.query("foods:listAll", {});
      return (results as FoodRecord[]) || [];
    }
    return VERIFIED_REFERENCE_FOODS;
  }

  async addFood(food: FoodRecord): Promise<void> {
    if (this.convexClient?.mutation) {
      await this.convexClient.mutation("foods:importCatalog", {
        foods: [food],
      });
    }
  }

  /**
   * Controlled catalog import operation for Person 3's verified catalog
   */
  async importPerson3Catalog(): Promise<{ count: number }> {
    if (this.convexClient?.mutation) {
      const result = (await this.convexClient.mutation("foods:importCatalog", {
        foods: [...VERIFIED_REFERENCE_FOODS],
      })) as { count?: number };
      return { count: result?.count ?? VERIFIED_REFERENCE_FOODS.length };
    }
    return { count: VERIFIED_REFERENCE_FOODS.length };
  }
}
