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

  async load(): Promise<AppData> {
    const today = localDate();
    const tz = this.getTimezone();

    const [mealsRes, goalsRes, recipesRes] = await Promise.all([
      this.request<{ meals: Meal[] }>(`/api/meals?timezone=${encodeURIComponent(tz)}`),
      this.request<{ goal: Goal }>(`/api/goals?date=${encodeURIComponent(today)}`),
      this.request<{ recipes: Recipe[] }>("/api/recipes"),
    ]);

    return {
      schemaVersion: 1,
      meals: mealsRes.meals || [],
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
        foodId: i.foodId,
        grams: i.grams,
        confirmed: i.confirmed,
      })),
    };

    // If existing meal has an ID, check if it can be updated via PATCH, else create via POST
    const isExisting = Boolean(meal.id && !meal.id.includes("temp_"));
    if (isExisting) {
      try {
        await this.request<{ meal: Meal }>(`/api/meals/${meal.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } catch (err) {
        if ((err as unknown as { status?: number }).status === 404) {
          // If not found on server, create via POST
          await this.request<{ meal: Meal }>("/api/meals", {
            method: "POST",
            body: JSON.stringify(payload),
          });
        } else {
          throw err;
        }
      }
    } else {
      await this.request<{ meal: Meal }>("/api/meals", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }

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
    const isExisting = Boolean(recipe.id && !recipe.id.includes("temp_"));
    if (isExisting) {
      try {
        await this.request<{ recipe: Recipe }>(`/api/recipes/${recipe.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: recipe.name,
            cookedYieldGrams: recipe.cookedYieldGrams,
            ingredients: recipe.ingredients,
          }),
        });
      } catch (err) {
        if ((err as unknown as { status?: number }).status === 404) {
          await this.request<{ recipe: Recipe }>("/api/recipes", {
            method: "POST",
            body: JSON.stringify({
              name: recipe.name,
              cookedYieldGrams: recipe.cookedYieldGrams,
              ingredients: recipe.ingredients.map(i => ({ foodId: i.foodId, grams: i.grams })),
            }),
          });
        } else {
          throw err;
        }
      }
    } else {
      await this.request<{ recipe: Recipe }>("/api/recipes", {
        method: "POST",
        body: JSON.stringify({
          name: recipe.name,
          cookedYieldGrams: recipe.cookedYieldGrams,
          ingredients: recipe.ingredients.map(i => ({ foodId: i.foodId, grams: i.grams })),
        }),
      });
    }

    return this.load();
  }

  async deleteRecipe(id: string): Promise<AppData> {
    await this.request<void>(`/api/recipes/${id}`, {
      method: "DELETE",
    });
    return this.load();
  }
}
