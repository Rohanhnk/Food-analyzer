import { requireBackend } from "./gateway";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getEffective = query({
  args: { backendSecret: v.string(), ownerId: v.string(), date: v.string() },
  handler: async (ctx, args) => {
    requireBackend(args.backendSecret);
    const goals = await ctx.db
      .query("goals")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .collect();

    const eligible = goals
      .filter((g) => g.effectiveDate <= args.date)
      .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));

    if (eligible.length > 0) {
      return eligible[0];
    }

    return null;
  },
});

export const save = mutation({
  args: { backendSecret: v.string(),
    ownerId: v.string(),
    effectiveDate: v.string(),
    mode: v.union(v.literal("cut"), v.literal("maintain"), v.literal("bulk")),
    kcal: v.number(),
    protein: v.number(),
    carbs: v.number(),
    fat: v.number(),
  },
  handler: async (ctx, args) => {
    requireBackend(args.backendSecret);
    const goals = await ctx.db
      .query("goals")
      .withIndex("by_owner_date", (q: any) =>
        q.eq("ownerId", args.ownerId).eq("effectiveDate", args.effectiveDate)
      )
      .first();

    const record = {
      ownerId: args.ownerId, effectiveDate: args.effectiveDate, mode: args.mode,
      kcal: args.kcal, protein: args.protein, carbs: args.carbs, fat: args.fat,
      createdAt: new Date().toISOString(),
    };

    if (goals) {
      await ctx.db.replace(goals._id, record);
    } else {
      await ctx.db.insert("goals", record);
    }

    return record;
  },
});
