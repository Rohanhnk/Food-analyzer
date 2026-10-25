import { badRequest } from "./errors";
import { isValidGrams } from "@nourish/nutrition";

export const LOCAL_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function validateLocalDate(date: unknown, fieldName = "date"): string {
  if (typeof date !== "string" || !LOCAL_DATE_REGEX.test(date)) {
    throw badRequest(`Field "${fieldName}" must be formatted as YYYY-MM-DD.`, fieldName);
  }

  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw badRequest(`Field "${fieldName}" is not a valid calendar date.`, fieldName);
  }

  return date;
}

export function validateTimezone(tz: unknown, fieldName = "timezone"): string {
  if (typeof tz !== "string" || !tz.trim()) {
    return "Asia/Kolkata"; // default sensible Indian timezone
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz.trim();
  } catch {
    throw badRequest(`Field "${fieldName}" must be a valid IANA timezone string.`, fieldName);
  }
}

export const VALID_MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"] as const;
export type ValidMealType = typeof VALID_MEAL_TYPES[number];

export function validateMealType(type: unknown, fieldName = "type"): ValidMealType {
  if (typeof type !== "string" || !VALID_MEAL_TYPES.includes(type as ValidMealType)) {
    throw badRequest(`Field "${fieldName}" must be one of: ${VALID_MEAL_TYPES.join(", ")}.`, fieldName);
  }
  return type as ValidMealType;
}

export const VALID_INPUT_TYPES = ["manual", "text", "image"] as const;
export type ValidInputType = typeof VALID_INPUT_TYPES[number];

export function validateInputType(inputType: unknown, fieldName = "inputType"): ValidInputType {
  if (typeof inputType !== "string" || !VALID_INPUT_TYPES.includes(inputType as ValidInputType)) {
    throw badRequest(`Field "${fieldName}" must be one of: ${VALID_INPUT_TYPES.join(", ")}.`, fieldName);
  }
  return inputType as ValidInputType;
}

export function validateWeightGrams(grams: unknown, fieldName = "grams"): number {
  if (typeof grams !== "number" || !Number.isFinite(grams)) {
    throw badRequest(`Field "${fieldName}" must be a finite number.`, fieldName);
  }
  if (!isValidGrams(grams)) {
    throw badRequest(`Field "${fieldName}" must be greater than 0 and no more than 10,000 g.`, fieldName);
  }
  return grams;
}

export const VALID_GOAL_MODES = ["cut", "maintain", "bulk"] as const;
export type ValidGoalMode = typeof VALID_GOAL_MODES[number];

export function validateGoal(goal: unknown, fieldName = "goal"): {
  mode: ValidGoalMode;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
} {
  if (!goal || typeof goal !== "object") {
    throw badRequest(`Field "${fieldName}" must be an object.`, fieldName);
  }

  const g = goal as Record<string, unknown>;
  if (typeof g.mode !== "string" || !VALID_GOAL_MODES.includes(g.mode as ValidGoalMode)) {
    throw badRequest(`Field "${fieldName}.mode" must be one of: ${VALID_GOAL_MODES.join(", ")}.`, `${fieldName}.mode`);
  }

  const checkMacro = (key: string, min = 0) => {
    const val = g[key];
    if (typeof val !== "number" || !Number.isFinite(val) || val < min) {
      throw badRequest(`Field "${fieldName}.${key}" must be a non-negative finite number.`, `${fieldName}.${key}`);
    }
    return val;
  };

  const kcal = checkMacro("kcal", 1);
  const protein = checkMacro("protein", 0);
  const carbs = checkMacro("carbs", 0);
  const fat = checkMacro("fat", 0);

  return {
    mode: g.mode as ValidGoalMode,
    kcal,
    protein,
    carbs,
    fat,
  };
}
