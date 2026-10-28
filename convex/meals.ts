import { requireBackend } from "./gateway";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listByDate = query({
  args: { backendSecret: v.string(), ownerId: v.string(), date: v.string() },
  handler: async (ctx, args) => {
    requireBackend(args.backendSecret);
    return await ctx.db
      .query("meals")
      .withIndex("by_owner_date", (q: any) =>
        q.eq("ownerId", args.ownerId).eq("date", args.date)
      )
      .collect();
  },
});

export const getById = query({
  args: { backendSecret: v.string(), ownerId: v.string(), id: v.string() },
  handler: async (ctx, args) => {
    requireBackend(args.backendSecret);
    const meal = await ctx.db
      .query("meals")
      .withIndex("by_owner_meal_id", (q: any) =>
        q.eq("ownerId", args.ownerId).eq("id", args.id)
      )
      .first();
    return meal;
  },
});

export const listRange = query({
  args: { backendSecret: v.string(),
    ownerId: v.string(),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireBackend(args.backendSecret);
    const limit = args.limit ?? 50;
    const meals = await ctx.db
      .query("meals")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .collect();

    const ordered = meals.filter(m => (!args.from || m.date >= args.from) && (!args.to || m.date <= args.to))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
    const start = args.cursor ? ordered.findIndex(m => m.id === args.cursor) + 1 : 0;
    const page = ordered.slice(start, start + Math.min(Math.max(limit, 1), 100));
    return { meals: page, nextCursor: start + page.length < ordered.length ? page.at(-1)?.id ?? null : null };
  },
});

export const save = mutation({
  args: { backendSecret: v.string(),
    meal: v.object({
      id: v.string(),
      ownerId: v.string(),
      date: v.string(),
      timezone: v.string(),
      type: v.union(v.literal("Breakfast"), v.literal("Lunch"), v.literal("Dinner"), v.literal("Snack")),
      title: v.string(),
      inputType: v.union(v.literal("manual"), v.literal("text"), v.literal("image")),
      imageId: v.optional(v.string()),
      items: v.array(
        v.object({
          id: v.string(),
          foodId: v.string(),
          name: v.string(),
          grams: v.number(),
          nutrients: v.object({
            kcal: v.number(),
            protein: v.number(),
            carbs: v.number(),
            fat: v.number(),
          }),
          source: v.string(),
          sourceVersion: v.string(),
          basis: v.union(v.literal("raw"), v.literal("cooked"), v.literal("as-served")),
          confirmed: v.boolean(),
          recipeId: v.optional(v.string()),
          snapshot: v.optional(v.any()),
        })
      ),
      createdAt: v.string(),
      updatedAt: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    requireBackend(args.backendSecret);
    const existing = await ctx.db
      .query("meals")
      .withIndex("by_owner_meal_id", (q: any) =>
        q.eq("ownerId", args.meal.ownerId).eq("id", args.meal.id)
      )
      .first();

    if (existing) {
      await ctx.db.replace(existing._id, args.meal);
    } else {
      await ctx.db.insert("meals", args.meal);
    }

    return args.meal;
  },
});

export const deleteMeal = mutation({
  args: { backendSecret: v.string(), ownerId: v.string(), id: v.string() },
  handler: async (ctx, args) => {
    requireBackend(args.backendSecret);
    const existing = await ctx.db
      .query("meals")
      .withIndex("by_owner_meal_id", (q: any) =>
        q.eq("ownerId", args.ownerId).eq("id", args.id)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return true;
    }
    return false;
  },
});
