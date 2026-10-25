/* eslint-disable @typescript-eslint/no-explicit-any */
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listByDate = query({
  args: { ownerId: v.string(), date: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("meals")
      .withIndex("by_owner_date", (q: any) =>
        q.eq("ownerId", args.ownerId).eq("date", args.date)
      )
      .collect();
  },
});

export const getById = query({
  args: { ownerId: v.string(), id: v.string() },
  handler: async (ctx, args) => {
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
  args: {
    ownerId: v.string(),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const meals = await ctx.db
      .query("meals")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .collect();

    return meals
      .filter((m) => {
        if (args.from && m.date < args.from) return false;
        if (args.to && m.date > args.to) return false;
        return true;
      })
      .slice(0, limit);
  },
});

export const save = mutation({
  args: {
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
          snapshot: v.optional(v.any()),
        })
      ),
      createdAt: v.string(),
      updatedAt: v.string(),
    }),
  },
  handler: async (ctx, args) => {
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
  args: { ownerId: v.string(), id: v.string() },
  handler: async (ctx, args) => {
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
