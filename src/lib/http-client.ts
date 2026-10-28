import type { FoodInput } from "./food-input";
import type { MealItem, Nutrients } from "./contracts";
import type {
  AnalysisResult,
  AppData,
  FoodRecord,
  Goal,
  Meal,
  Recipe,
  TrackerClient,
} from "./contracts";
import { localDate } from "./model";

export type HttpClientOptions = {
  baseUrl?: string;
  getToken?: () => Promise<string | null> | string | null;
  getTimezone?: () => string;
};

export class HttpClient implements TrackerClient {
  readonly mode = "live" as const;
  async saveFood(input: FoodInput, id?: string): Promise<FoodRecord> {
    return (await this.request<{ food: FoodRecord }>(id ? `/api/foods/${encodeURIComponent(id)}` : "/api/foods", { method: id ? "PATCH" : "POST", body: JSON.stringify(input) })).food;
  }
  previewMeal(items: MealItem[]) {
    return this.request<{ items: MealItem[]; totals: Nutrients; warnings: string[] }>("/api/meals/preview", { method: "POST", body: JSON.stringify({ items: items.map(i => ({ ...(i.recipeId ? { recipeId: i.recipeId } : { foodId: i.foodId }), grams: i.grams, confirmed: i.confirmed })) }) });
  }
  async getGoal(date: string) { return (await this.request<{ goal: Goal }>(`/api/goals?date=${encodeURIComponent(date)}`)).goal; }

  private readonly savedDrafts = new Map<string, string>();
  private readonly baseUrl: string;
  private readonly getToken?: () => Promise<string | null> | string | null;
  private readonly getTimezone: () => string;

  constructor(options: HttpClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? "";
    this.getToken = options.getToken;
    this.getTimezone = options.getTimezone ?? (() => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata");
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.getToken) {
      const token = await this.getToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const authHeaders = await this.getAuthHeaders();
    const url = `${this.baseUrl}${path}`;

    const res = await fetch(url, {
      ...options,
      headers: {
        ...authHeaders,
        ...(options.headers as Record<string, string> | undefined),
      },
    });

    if (res.status === 204) {
      return null as T;
    }

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg = json?.error?.message || `HTTP error ${res.status}`;
      const err = new Error(errorMsg);
      (err as unknown as { status: number; code?: string }).status = res.status;
      (err as unknown as { code?: string }).code = json?.error?.code;
      throw err;
    }

    return json as T;
  }

  private async loadMeals(timezone: string): Promise<Meal[]> {
    const meals: Meal[] = [];
    const seen = new Set<string>();
    let cursor: string | null = null;
    do {
      const page: { meals: Meal[]; nextCursor?: string | null } = await this.request(
        `/api/meals?timezone=${encodeURIComponent(timezone)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      meals.push(...page.meals);
      cursor = page.nextCursor ?? null;
      if (cursor && seen.has(cursor)) throw new Error("Meal pagination returned a repeated cursor.");
      if (cursor) seen.add(cursor);
    } while (cursor);
    return meals;
  }

  async load(): Promise<AppData> {
    const today = localDate();
    const tz = this.getTimezone();

    const [mealsRes, goalsRes, recipesRes] = await Promise.all([
      this.loadMeals(tz),
      this.request<{ goal: Goal }>(`/api/goals?date=${encodeURIComponent(today)}`),
      this.request<{ recipes: Recipe[] }>("/api/recipes"),
    ]);

    return {
      schemaVersion: 1,
      meals: mealsRes,
      goals: goalsRes.goal || { mode: "maintain", kcal: 2000, protein: 120, carbs: 220, fat: 65 },
      recipes: recipesRes.recipes || [],
    };
  }

  async searchFoods(query: string): Promise<FoodRecord[]> {
    const res = await this.request<{ foods: FoodRecord[] }>(
      `/api/foods/search?q=${encodeURIComponent(query)}`
    );
    return res.foods || [];
  }

  async analyzeText(text: string): Promise<AnalysisResult> {
    return this.request<AnalysisResult>("/api/analyze/text", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  }

  async analyzePhoto(file: File): Promise<AnalysisResult> {
    const form = new FormData(); form.append("file", file);
    const headers = await this.getAuthHeaders(); delete headers["Content-Type"];
    const response = await fetch(`${this.baseUrl}/api/uploads`, { method: "POST", headers, body: form });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error?.message ?? "Photo upload failed.");
    if (typeof result.imageId !== "string") throw new Error("Upload returned no image reference.");
    try {
      return await this.request<AnalysisResult>("/api/analyze/image", { method: "POST", body: JSON.stringify({ imageId: result.imageId }) });
    } finally {
      // Photos are temporary inputs, not attachments on saved meals in this workflow.
      await this.request<void>(`/api/uploads/${encodeURIComponent(result.imageId)}`, { method: "DELETE" });
    }
  }

  async saveMeal(meal: Meal): Promise<AppData> {
    const tz = this.getTimezone();
    const payload = {
      date: meal.date,
      timezone: tz,
      type: meal.type,
      title: meal.title,
      inputType: meal.inputType,
      imageId: meal.imageId,
      items: meal.items.map(i => ({
        ...(i.recipeId ? { recipeId: i.recipeId } : { foodId: i.foodId }),
        grams: i.grams,
        confirmed: i.confirmed,
      })),
    };

    const existingId = this.savedDrafts.get(meal.id) ?? (!meal.id.startsWith("temp_") ? meal.id : undefined);
    const response = await this.request<{ meal: Meal }>(existingId ? `/api/meals/${encodeURIComponent(existingId)}` : "/api/meals", {
      method: existingId ? "PATCH" : "POST",
      headers: existingId ? undefined : { "Idempotency-Key": meal.id },
      body: JSON.stringify(payload),
    });
    this.savedDrafts.set(meal.id, response.meal.id);

    return this.load();
  }

  async deleteMeal(id: string): Promise<AppData> {
    await this.request<void>(`/api/meals/${id}`, {
      method: "DELETE",
    });
    return this.load();
  }

  async saveGoals(goals: Goal): Promise<AppData> {
    const today = localDate();
    await this.request<{ goal: Goal }>("/api/goals", {
      method: "PUT",
      body: JSON.stringify({
        goal: goals,
        effectiveDate: today,
      }),
    });
    return this.load();
  }

  async saveRecipe(recipe: Recipe): Promise<AppData> {
    const existingId = this.savedDrafts.get(recipe.id) ?? (!recipe.id.startsWith("temp_") ? recipe.id : undefined);
    const response = await this.request<{ recipe: Recipe }>(existingId ? `/api/recipes/${encodeURIComponent(existingId)}` : "/api/recipes", {
      method: existingId ? "PATCH" : "POST",
      body: JSON.stringify({ name: recipe.name, cookedYieldGrams: recipe.cookedYieldGrams, ingredients: recipe.ingredients.map(i => ({ foodId: i.foodId, grams: i.grams })) }),
    });
    this.savedDrafts.set(recipe.id, response.recipe.id);

    return this.load();
  }

  async deleteRecipe(id: string): Promise<AppData> {
    await this.request<void>(`/api/recipes/${id}`, {
      method: "DELETE",
    });
    return this.load();
  }
}
