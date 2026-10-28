import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import schema from "../../convex/schema";
import { ConvexStorageRepository, type ConvexTransport } from "@/server/storage/convex-storage";
const modules = {
  "../../convex/_generated/server.ts": () => import("../../convex/_generated/server"),
  "../../convex/meals.ts": () => import("../../convex/meals"),
  "../../convex/recipes.ts": () => import("../../convex/recipes"),
  "../../convex/goals.ts": () => import("../../convex/goals"),
  "../../convex/foods.ts": () => import("../../convex/foods"),
  "../../convex/assets.ts": () => import("../../convex/assets"),
  "../../convex/idempotency.ts": () => import("../../convex/idempotency"),
};
const secret = "fixture-only-capability-01234567890123456789";
beforeEach(() => vi.stubEnv("NOURISH_BACKEND_SECRET", secret));
afterEach(() => vi.unstubAllEnvs());
it("rejects direct database access even with forged owner IDs", async () => {
  const t = convexTest(schema, modules);
  for (const name of ["meals:listByDate", "recipes:listByOwner"]) {
    const args = name.startsWith("meals") ? { ownerId: "victim", date: "2026-10-26", backendSecret: "wrong" } : { ownerId: "victim", backendSecret: "wrong" };
    await expect(t.query(makeFunctionReference<"query">(name), args)).rejects.toThrow("Unauthorized");
  }
  await expect(t.mutation(makeFunctionReference<"mutation">("foods:importCatalog"), { backendSecret: "wrong", foods: [] })).rejects.toThrow("Unauthorized");
});
it("persists across repository instances and isolates owners", async () => {
  const t = convexTest(schema, modules);
  const clean = (args: Record<string, unknown>) => JSON.parse(JSON.stringify({ ...args, backendSecret: secret }));
  const transport: ConvexTransport = {
    query: (name, args) => t.query(makeFunctionReference<"query">(name), clean(args)),
    mutation: (name, args) => t.mutation(makeFunctionReference<"mutation">(name), clean(args)),
  };
  const first = new ConvexStorageRepository(transport);
  await first.saveMeal("alice", { id: "m", title: "Meal", date: "2026-10-26", type: "Lunch", inputType: "manual", createdAt: "2026-10-26T12:00:00Z", items: [] });
  const next = new ConvexStorageRepository(transport);
  expect((await next.listMealsByDate("alice", "2026-10-26"))[0].title).toBe("Meal");
  expect(await next.findMealById("bob", "m")).toBeNull();
  expect(await next.deleteMeal("bob", "m")).toBe(false);
  await next.saveGoal("alice", { mode: "bulk", kcal: 2500, protein: 150, carbs: 300, fat: 70 }, "2027-01-01");
  expect((await next.getEffectiveGoal("alice", "2026-10-26")).goal.kcal).toBe(2000);
  await next.saveRecipe("alice", { id: "recipe", name: "Dal", cookedYieldGrams: 200, ingredients: [] });
  expect((await first.listRecipes("alice"))[0].name).toBe("Dal");
  await next.saveIdempotencyRecord("alice", "request", 201, "saved");
  expect(await first.getIdempotencyRecord("alice", "request")).toMatchObject({ responseBody: "saved" });
  expect(await first.getIdempotencyRecord("bob", "request")).toBeNull();
});

it("persists photo bytes and deletes them only for their owner", async () => {
  const t = convexTest(schema, modules);
  const storageId = await t.run(ctx => ctx.storage.store(new Blob(["image fixture"])));
  await t.mutation(makeFunctionReference<"mutation">("assets:save"), { backendSecret: secret, record: { id: "photo", ownerId: "alice", storageId, originalName: "photo.png", mimeType: "image/png", sizeBytes: 13, status: "pending", createdAt: new Date().toISOString() } });
  expect(await t.query(makeFunctionReference<"query">("assets:get"), { backendSecret: secret, ownerId: "bob", id: "photo" })).toBeNull();
  expect(await t.mutation(makeFunctionReference<"mutation">("assets:remove"), { backendSecret: secret, ownerId: "bob", id: "photo" })).toBe(false);
  expect(await t.run(async ctx => (await ctx.storage.get(storageId))?.text())).toBe("image fixture");
  expect(await t.mutation(makeFunctionReference<"mutation">("assets:remove"), { backendSecret: secret, ownerId: "alice", id: "photo" })).toBe(true);
  expect(await t.run(async ctx => (await ctx.storage.get(storageId)) === null)).toBe(true);
});
