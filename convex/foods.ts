import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("foods").collect();
  },
});

export const getById = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("foods")
      .withIndex("by_food_id", (q) => q.eq("id", args.id))
      .first();
  },
});

export const search = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const q = args.query.toLowerCase().trim();
    if (!q) return [];

    const all = await ctx.db.query("foods").collect();
    return all.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.aliases.some((a: string) => a.toLowerCase().includes(q))
    );
  },
});

export const importCatalog = mutation({
  args: {
    foods: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        aliases: v.array(v.string()),
        category: v.string(),
        basis: v.union(v.literal("raw"), v.literal("cooked"), v.literal("as-served")),
        per100g: v.object({
          kcal: v.number(),
          protein: v.number(),
          carbs: v.number(),
          fat: v.number(),
          fiber: v.optional(v.number()),
          sugar: v.optional(v.number()),
          sodium: v.optional(v.number()),
        }),
        standardServing: v.optional(
          v.object({
            unit: v.string(),
            grams: v.number(),
            description: v.optional(v.string()),
          })
        ),
        alternateServings: v.optional(
          v.array(
            v.object({
              unit: v.string(),
              grams: v.number(),
              description: v.optional(v.string()),
            })
          )
        ),
        source: v.string(),
        sourceVersion: v.string(),
        sourceId: v.optional(v.string()),
        attribution: v.string(),
        notes: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    let imported = 0;
    for (const food of args.foods) {
      const existing = await ctx.db
        .query("foods")
        .withIndex("by_food_id", (q) => q.eq("id", food.id))
        .first();

      if (existing) {
        await ctx.db.replace(existing._id, food);
      } else {
        await ctx.db.insert("foods", food);
      }
      imported++;
    }
    return { count: imported };
  },
});
