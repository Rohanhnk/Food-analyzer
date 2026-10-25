import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { storage } from "@/server";
import { handleRouteError } from "@/server/errors";
import { validateLocalDate, validateTimezone } from "@/server/validation";
import type { Nutrients } from "@/lib/contracts";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const { searchParams } = new URL(req.url);

    const dateParam = searchParams.get("date");
    const date = validateLocalDate(dateParam, "date");
    validateTimezone(searchParams.get("timezone"), "timezone");

    // Fetch all meals logged for this local date
    const meals = await storage.listMealsByDate(user.userId, date);

    // Sum immutable snapshots from items
    let kcal = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;

    for (const meal of meals) {
      for (const item of meal.items) {
        kcal += item.nutrients.kcal;
        protein += item.nutrients.protein;
        carbs += item.nutrients.carbs;
        fat += item.nutrients.fat;
      }
    }

    const round = (val: number, dec: number) => {
      const p = Math.pow(10, dec);
      return Math.round((val + Number.EPSILON) * p) / p;
    };

    const consumed: Nutrients = {
      kcal: round(kcal, 1),
      protein: round(protein, 1),
      carbs: round(carbs, 1),
      fat: round(fat, 1),
    };

    // Get goal effective on this local date
    const { goal: target } = await storage.getEffectiveGoal(user.userId, date);

    const remaining: Nutrients = {
      kcal: round(target.kcal - consumed.kcal, 1),
      protein: round(target.protein - consumed.protein, 1),
      carbs: round(target.carbs - consumed.carbs, 1),
      fat: round(target.fat - consumed.fat, 1),
    };

    return NextResponse.json({
      date,
      consumed,
      target,
      remaining,
      mealCount: meals.length,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
