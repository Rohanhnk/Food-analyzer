import { requireBackend } from "./gateway";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listByOwner = query({
  args: { backendSecret: v.string(), ownerId: v.string() },
  handler: async (ctx, args) => {
    requireBackend(args.backendSecret);
    return await ctx.db
      .query("recipes")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .collect();
  },
});

export const getById = query({
  args: { backendSecret: v.string(), ownerId: v.string(), id: v.string() },
  handler: async (ctx, args) => {
    requireBackend(args.backendSecret);
    return await ctx.db
      .query("recipes")
      .withIndex("by_owner_recipe_id", (q: any) =>
        q.eq("ownerId", args.ownerId).eq("id", args.id)
      )
      .first();
  },
});

export const save = mutation({
  args: { backendSecret: v.string(),
    recipe: v.object({
      id: v.string(),
      ownerId: v.string(),
      name: v.string(),
      cookedYieldGrams: v.number(),
      rawTotalGrams: v.optional(v.number()),
      ingredients: v.array(
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
      version: v.optional(v.string()),
      notes: v.optional(v.string()),
      createdAt: v.string(),
      updatedAt: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    requireBackend(args.backendSecret);
    const existing = await ctx.db
      .query("recipes")
      .withIndex("by_owner_recipe_id", (q: any) =>
        q.eq("ownerId", args.recipe.ownerId).eq("id", args.recipe.id)
      )
      .first();

    if (existing) {
      await ctx.db.replace(existing._id, args.recipe);
    } else {
      await ctx.db.insert("recipes", args.recipe);
    }

    return args.recipe;
  },
});

export const deleteRecipe = mutation({
  args: { backendSecret: v.string(), ownerId: v.string(), id: v.string() },
  handler: async (ctx, args) => {
    requireBackend(args.backendSecret);
    const existing = await ctx.db
      .query("recipes")
      .withIndex("by_owner_recipe_id", (q: any) =>
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
