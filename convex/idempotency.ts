import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireBackend } from "./gateway";
export const get = query({
  args: { backendSecret: v.string(), ownerId: v.string(), key: v.string() },
  handler: async (ctx, args) => { requireBackend(args.backendSecret); return ctx.db.query("idempotencyKeys").withIndex("by_owner_key", q => q.eq("ownerId", args.ownerId).eq("key", args.key)).first(); },
});
export const save = mutation({
  args: { backendSecret: v.string(), ownerId: v.string(), key: v.string(), statusCode: v.number(), responseBody: v.string() },
  handler: async (ctx, args) => {
    requireBackend(args.backendSecret);
    const old = await ctx.db.query("idempotencyKeys").withIndex("by_owner_key", q => q.eq("ownerId", args.ownerId).eq("key", args.key)).first();
    if (!old) await ctx.db.insert("idempotencyKeys", { ownerId: args.ownerId, key: args.key, statusCode: args.statusCode, responseBody: args.responseBody, createdAt: new Date().toISOString() });
  },
});
