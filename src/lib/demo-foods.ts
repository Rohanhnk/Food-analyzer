import type { FoodRecord } from "./contracts";
// Illustrative UI fixtures only. Person 3 supplies licensed, verified reference data.
export const demoFoods: FoodRecord[] = [
  ["roti", "Roti / chapati", ["roti", "rotis", "chapati", "chapatis"], "Indian staple", 297, 9, 55, 5, 40, "1 medium roti", "cooked"],
  ["paneer", "Paneer", ["paneer"], "Protein", 265, 18, 3, 21, 100, "100 g", "as-served"],
  ["rice", "Steamed rice", ["rice", "chawal"], "Indian staple", 130, 2.7, 28, 0.3, 150, "1 bowl", "cooked"],
  ["dal", "Yellow dal", ["dal", "daal"], "Indian staple", 110, 6, 16, 2.5, 180, "1 bowl", "cooked"],
  ["curd", "Plain curd", ["curd", "dahi", "yogurt"], "Dairy", 61, 3.5, 4.7, 3.3, 150, "1 bowl", "as-served"],
  ["chicken", "Chicken curry", ["chicken curry", "chicken"], "Protein", 165, 20, 5, 7, 150, "1 serving", "cooked"],
  ["banana", "Banana", ["banana", "bananas"], "Fruit", 89, 1.1, 23, 0.3, 120, "1 medium banana", "raw"],
  ["oats", "Oats", ["oats"], "Breakfast", 389, 17, 66, 7, 40, "40 g dry oats", "raw"],
  ["egg", "Boiled egg", ["egg", "eggs"], "Protein", 155, 13, 1.1, 11, 50, "1 egg", "cooked"],
  ["idli", "Idli", ["idli", "idlis"], "Breakfast", 146, 4.5, 29, 1, 40, "1 idli", "cooked"],
  ["sabzi", "Mixed vegetable sabzi", ["sabzi", "bhaji", "vegetables"], "Vegetables", 95, 2.5, 12, 4, 150, "1 bowl", "cooked"],
  ["almonds", "Almonds", ["almond", "almonds", "badam"], "Snack", 579, 21, 22, 50, 20, "Small handful", "raw"],
].map(row => ({
  id: row[0] as string, name: row[1] as string, aliases: row[2] as string[], category: row[3] as string,
  per100g: { kcal: row[4] as number, protein: row[5] as number, carbs: row[6] as number, fat: row[7] as number },
  servingGrams: row[8] as number, servingLabel: row[9] as string, basis: row[10] as FoodRecord["basis"],
  source: "Illustrative demo fixture — not verified nutrition data", sourceVersion: "demo-v1",
}));
